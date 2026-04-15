const { onRequest } = require("firebase-functions/v2/https");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const chromium = require("@sparticuz/chromium");

puppeteer.use(StealthPlugin());

const IAGRO_GTA_URL = "https://www.servicos.iagro.ms.gov.br/gta";

exports.consultarGTA = onRequest(
  {
    region: "southamerica-east1",
    timeoutSeconds: 60,
    memory: "1GiB",
    cors: true,
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const { barcode } = req.body;
    if (!barcode || typeof barcode !== "string") {
      res.status(400).json({ error: "barcode e obrigatorio" });
      return;
    }

    let browser;
    try {
      browser = await puppeteer.launch({
        args: [...chromium.args, "--disable-blink-features=AutomationControlled"],
        defaultViewport: { width: 1366, height: 768 },
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      });

      const page = await browser.newPage();

      // Set a realistic user agent
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
      );

      // Interceptar respostas da API para capturar os dados da GTA
      let gtaData = null;
      let apiError = null;

      page.on("response", async (response) => {
        const url = response.url();
        if (url.includes("AutenticidadeGta/Digital")) {
          try {
            const json = await response.json();
            if (json.status?.codigo === 200) {
              gtaData = json.data;
            } else {
              apiError = json.status?.mensagem || "Erro na API IAGRO";
            }
          } catch {
            // response might not be JSON
          }
        }
      });

      await page.goto(IAGRO_GTA_URL, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      // Esperar o campo de barcode aparecer
      const barcodeInput = await page.waitForSelector(
        'input[formcontrolname="barcode"], input[name="barcode"], input[type="text"]',
        { timeout: 15000 },
      );

      if (!barcodeInput) {
        throw new Error("Campo de codigo de barras nao encontrado");
      }

      // Clicar em "digitar codigo" se houver esse botao
      try {
        const digitarBtn = await page.$('button:has-text("Digitar")');
        if (digitarBtn) await digitarBtn.click();
        await new Promise((r) => setTimeout(r, 500));
      } catch {
        // pode nao existir - OK
      }

      // Preencher o codigo de barras
      await barcodeInput.click({ clickCount: 3 });
      await barcodeInput.type(barcode, { delay: 10 });

      // Esperar o reCAPTCHA v3 executar e clicar em pesquisar
      const searchBtn = await page.waitForSelector(
        'button.btn-primary, button[type="submit"]',
        { timeout: 10000 },
      );

      if (searchBtn) {
        await searchBtn.click();
      }

      // Aguardar resultado (interceptado via response listener)
      await page
        .waitForResponse(
          (response) => response.url().includes("AutenticidadeGta"),
          { timeout: 20000 },
        )
        .catch(() => null);

      // Dar tempo extra para processamento
      await new Promise((r) => setTimeout(r, 2000));

      if (apiError) {
        res.status(400).json({ error: apiError });
        return;
      }

      if (!gtaData) {
        // Fallback: tentar extrair dados da pagina renderizada
        const pageData = await extractFromPage(page);
        if (pageData) {
          res.json({ data: pageData, source: "scraping" });
          return;
        }
        throw new Error("Nenhum dado retornado. Verifique o codigo de barras.");
      }

      res.json({ data: gtaData, source: "api" });
    } catch (error) {
      console.error("Erro na consulta GTA:", error);
      res.status(500).json({
        error: error.message || "Erro interno na consulta GTA",
      });
    } finally {
      if (browser) await browser.close();
    }
  },
);

async function extractFromPage(page) {
  try {
    return await page.evaluate(() => {
      const getText = (selector) => {
        const el = document.querySelector(selector);
        return el ? el.textContent.trim() : null;
      };

      // Tentar extrair dados visíveis da página
      const cards = document.querySelectorAll(".card, .alert");
      if (!cards.length) return null;

      const result = {};
      const allText = document.body.innerText;

      // Extrair campos comuns
      const patterns = [
        { key: "numero", regex: /N[uú]mero[:\s]*(\S+)/i },
        { key: "serie", regex: /S[eé]rie[:\s]*(\S+)/i },
        { key: "dataEmissao", regex: /Emiss[aã]o[:\s]*(\d{2}\/\d{2}\/\d{4})/i },
        { key: "dataValidade", regex: /Validade[:\s]*(\d{2}\/\d{2}\/\d{4})/i },
        { key: "finalidade", regex: /Finalidade[:\s]*([^\n]+)/i },
        { key: "situacao", regex: /Situa[cç][aã]o[:\s]*([^\n]+)/i },
        { key: "totalAnimais", regex: /Total.*?Animais[:\s]*(\d+)/i },
      ];

      patterns.forEach(({ key, regex }) => {
        const match = allText.match(regex);
        if (match) result[key] = match[1].trim();
      });

      return Object.keys(result).length > 0 ? result : null;
    });
  } catch {
    return null;
  }
}
