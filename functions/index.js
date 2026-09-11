const { onRequest } = require("firebase-functions/v2/https");

const CAPSOLVER_API_KEY = process.env.CAPSOLVER_API_KEY;

const MAPA_PAGE_URL =
  "https://pga.agricultura.gov.br/sispga/webclient/consultaPublica.jsp";
const MAPA_IFRAME_URL =
  "https://pga.agricultura.gov.br/sispga/webclient/consultaIFrame.jsp";
const MAPA_RECAPTCHA_SITE_KEY = "6LdJvfoUAAAAAP9V1pnZB59RXpP9-FzIp_a5d-td";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

/**
 * Get session cookies from MAPA.
 */
async function getMapaSession() {
  const res = await fetch(MAPA_PAGE_URL + "?_=" + Date.now(), {
    headers: {
      "User-Agent": USER_AGENT,
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
  });

  const cookies = [];

  if (typeof res.headers.getSetCookie === "function") {
    res.headers.getSetCookie().forEach((c) => {
      const nameValue = c.split(";")[0].trim();
      if (nameValue) cookies.push(nameValue);
    });
  }

  if (cookies.length === 0) {
    const raw = res.headers.get("set-cookie");
    if (raw) {
      raw.split(/,\s*(?=[A-Za-z_]+=)/).forEach((c) => {
        const nameValue = c.split(";")[0].trim();
        if (nameValue) cookies.push(nameValue);
      });
    }
  }

  return cookies.join("; ");
}

/**
 * Submit barcode to MAPA and return HTML response.
 */
async function queryMapa(cookies, barcode, recaptchaToken) {
  const params = { codigoBarras: barcode };
  if (recaptchaToken) {
    params["g-recaptcha-response"] = recaptchaToken;
  }

  const queryRes = await fetch(MAPA_IFRAME_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
      Referer: MAPA_PAGE_URL,
      Cookie: cookies,
    },
    body: new URLSearchParams(params).toString(),
  });

  if (!queryRes.ok) {
    throw new Error(`MAPA HTTP ${queryRes.status}`);
  }

  return queryRes.text();
}

/**
 * Solve reCAPTCHA v2 using Capsolver API.
 */
async function solveRecaptcha(apiKey) {
  const createRes = await fetch("https://api.capsolver.com/createTask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientKey: apiKey,
      task: {
        type: "ReCaptchaV2TaskProxyLess",
        websiteURL: MAPA_PAGE_URL,
        websiteKey: MAPA_RECAPTCHA_SITE_KEY,
      },
    }),
  });
  const createData = await createRes.json();
  if (createData.errorId !== 0) {
    throw new Error(`Capsolver: ${createData.errorDescription}`);
  }

  const taskId = createData.taskId;

  // Poll every 3s, max ~90 seconds
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 3000));

    const resultRes = await fetch("https://api.capsolver.com/getTaskResult", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientKey: apiKey, taskId }),
    });
    const resultData = await resultRes.json();

    if (resultData.status === "ready") {
      return resultData.solution.gRecaptchaResponse;
    }
    if (resultData.errorId !== 0) {
      throw new Error(`Capsolver: ${resultData.errorDescription}`);
    }
  }
  throw new Error("Timeout resolvendo reCAPTCHA");
}

/**
 * Parse MAPA GTA HTML response into structured JSON.
 */
function parseGtaHtml(html) {
  function extractField(name, occurrence = 0) {
    const regex = new RegExp(
      `name=["']${name}["'][^>]*value=["']([^"']*)["']`,
      "gi"
    );
    let match;
    let idx = 0;
    while ((match = regex.exec(html)) !== null) {
      if (idx === occurrence) return match[1].trim();
      idx++;
    }
    return null;
  }

  const animais = [];
  const stratRegex =
    /name=["']dsEstratificacao["'][^>]*value=["']([^"']*)["'][^]*?name=["']qtEnviada["'][^>]*value=["'](\d+)["'][^]*?name=["']qtRecebida["'][^>]*value=["'](\d+)["']/gi;
  let stratMatch;
  while ((stratMatch = stratRegex.exec(html)) !== null) {
    const desc = stratMatch[1].trim();
    const parts = desc.split(",").map((s) => s.trim());
    animais.push({
      descricao: desc,
      especie: parts[0] || null,
      sexo: parts[1] || null,
      faixaEtaria: parts[2] || null,
      qtdEnviada: parseInt(stratMatch[2], 10),
      qtdRecebida: parseInt(stratMatch[3], 10),
    });
  }

  const numero = extractField("id2numgta");
  if (!numero) {
    if (html.includes("não encontrad") || html.includes("Nenhum")) {
      throw new Error("GTA não encontrada para o código de barras informado");
    }
    return null; // signals captcha needed or unexpected response
  }

  return {
    identificacao: {
      situacao: extractField("protocolo", 0),
      protocolo: extractField("protocolo", 1),
      numero,
      serie: extractField("id2serie"),
      uf: extractField("id2adduf"),
      codigoBarras: extractField("id2codbarra"),
    },
    especie: {
      grupo: extractField("grupoEspecie"),
      especie: extractField("especie"),
      finalidade: extractField("finalidade"),
    },
    emissao: {
      localidade: extractField("localidade"),
      municipio: extractField("municipio"),
      emitente: extractField("emitente"),
      dataEmissao: extractField("dataEmissao"),
      dataRecebimento: extractField("dataRecebimento"),
      dataValidade: extractField("dataValidade"),
      observacao: extractField("observacao"),
    },
    origem: {
      tipo: extractField("tipoOrigem"),
      codigo: extractField("codigoOrigem"),
      nome: extractField("nomeEstabelecimento"),
      cpfCnpj: extractField("cpfCnpjOrigem"),
      nomeProdutor: extractField("nomeCpfCnpjOrigem"),
      uf: extractField("ufOrigem"),
      municipio: extractField("municipioOrigem"),
    },
    destino: {
      tipo: extractField("tipoDestino"),
      codigo: extractField("codigoDestino"),
      nome: extractField("nomeEstabelemcimentoDestino"),
      cpfCnpj: extractField("cpfCnpjDestino"),
      nomeProdutor: extractField("nomeCpfCnpjDestino"),
      uf: extractField("ufDestino"),
      municipio: extractField("municipioDestino"),
    },
    animais,
    totalAnimais: animais.reduce((sum, a) => sum + a.qtdEnviada, 0),
  };
}

// ===================== SINTEGRA CAPTCHA =====================

const SINTEGRA_MS_PAGE_URL =
  "https://servicos.efazenda.ms.gov.br/consultapublica/";
const SINTEGRA_MS_RECAPTCHA_SITE_KEY =
  "6Ld76NYcAAAAAIpOB-nhuk_M3bDpNUVw_qcNxvtZ";

/**
 * Solve reCAPTCHA v2 for Sintegra MS and return the token.
 */
exports.resolverCaptchaSintegra = onRequest(
  {
    region: "southamerica-east1",
    timeoutSeconds: 120,
    memory: "256MiB",
    cors: true,
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    try {
      const createRes = await fetch("https://api.capsolver.com/createTask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientKey: CAPSOLVER_API_KEY,
          task: {
            type: "ReCaptchaV2TaskProxyLess",
            websiteURL: SINTEGRA_MS_PAGE_URL,
            websiteKey: SINTEGRA_MS_RECAPTCHA_SITE_KEY,
            isInvisible: false,
          },
        }),
      });
      const createData = await createRes.json();
      if (createData.errorId !== 0) {
        throw new Error(`Capsolver: ${createData.errorDescription}`);
      }

      const taskId = createData.taskId;

      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 3000));

        const resultRes = await fetch(
          "https://api.capsolver.com/getTaskResult",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clientKey: CAPSOLVER_API_KEY, taskId }),
          }
        );
        const resultData = await resultRes.json();

        if (resultData.status === "ready") {
          res.json({ token: resultData.solution.gRecaptchaResponse });
          return;
        }
        if (resultData.errorId !== 0) {
          throw new Error(`Capsolver: ${resultData.errorDescription}`);
        }
      }
      throw new Error("Timeout resolvendo reCAPTCHA");
    } catch (error) {
      console.error("Erro resolvendo captcha:", error);
      res
        .status(500)
        .json({ error: error.message || "Erro resolvendo captcha" });
    }
  }
);

exports.consultarGTA = onRequest(
  {
    region: "southamerica-east1",
    timeoutSeconds: 120,
    memory: "256MiB",
    cors: true,
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const { barcode } = req.body;
    if (!barcode || typeof barcode !== "string" || barcode.length < 30) {
      res.status(400).json({ error: "Codigo de barras invalido" });
      return;
    }

    try {
      // Step 1: Get session cookies
      const cookies = await getMapaSession();

      // Step 2: Try WITHOUT captcha first (fast path ~1s)
      const html = await queryMapa(cookies, barcode, null);
      let data = parseGtaHtml(html);

      if (data) {
        res.json({ data, source: "mapa" });
        return;
      }

      // Step 3: Captcha required — solve and retry
      console.log("Captcha required, solving via Capsolver...");
      const recaptchaToken = await solveRecaptcha(CAPSOLVER_API_KEY);

      // Get fresh session + submit with captcha
      const freshCookies = await getMapaSession();
      const html2 = await queryMapa(freshCookies, barcode, recaptchaToken);
      data = parseGtaHtml(html2);

      if (!data) {
        throw new Error("Consulta falhou mesmo com captcha");
      }

      res.json({ data, source: "mapa" });
    } catch (error) {
      console.error("Erro na consulta GTA:", error);
      res
        .status(500)
        .json({ error: error.message || "Erro interno na consulta GTA" });
    }
  }
);

// ─── Extração de texto de PDF de e-GTA ───────────────────────────────────────
//
// Só converte PDF em texto. A leitura dos campos fica no cliente
// (src/services/gtaParser.ts), num lugar só, testada contra GTAs reais.
//
// Existe porque o navegador extrai via DecompressionStream, API que não há em
// React Native — sem isto, importar GTA no celular seria impossível.

const zlib = require("zlib");

/** Descomprime um stream FlateDecode, tolerando lixo antes do cabeçalho zlib. */
function inflatePdfStream(buf) {
  for (const offset of [0, 1, 2, 3]) {
    if (offset >= buf.length) break;
    const slice = offset === 0 ? buf : buf.subarray(offset);
    for (const fn of [zlib.inflateSync, zlib.inflateRawSync]) {
      try {
        return fn(slice);
      } catch {
        /* tenta a próxima combinação */
      }
    }
  }
  return null;
}

/** Concatena as strings desenhadas pelos operadores Tj e TJ, na ordem do stream. */
function extrairTextoDesenhado(content) {
  const partes = [];
  const opRe = /\(((?:\\.|[^()\\])*)\)\s*Tj|\[((?:[^[\]])*)\]\s*TJ/g;
  const desescapar = (s) =>
    s
      .replace(/\\([0-7]{1,3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)))
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, " ")
      .replace(/\\t/g, " ")
      .replace(/\\(.)/g, "$1");

  let m;
  while ((m = opRe.exec(content)) !== null) {
    if (m[1] !== undefined) {
      partes.push(desescapar(m[1]));
    } else if (m[2] !== undefined) {
      const pRe = /\(((?:\\.|[^()\\])*)\)/g;
      let p;
      while ((p = pRe.exec(m[2])) !== null) partes.push(desescapar(p[1]));
    }
    partes.push(" ");
  }
  return partes.join("");
}

function extrairTextoPdf(buffer) {
  const conteudos = [];
  let pos = 0;

  while (pos < buffer.length) {
    const match = buffer.indexOf("stream", pos);
    if (match === -1) break;

    // "endstream" contém "stream": ignora essa ocorrência
    if (match >= 3 && buffer.toString("latin1", match - 3, match) === "end") {
      pos = match + 1;
      continue;
    }

    let dataStart = match + "stream".length;
    if (buffer[dataStart] === 0x0d) dataStart++;
    if (buffer[dataStart] === 0x0a) dataStart++;

    const hdr = buffer.toString("latin1", Math.max(0, match - 1024), match);
    const fim = buffer.indexOf("endstream", dataStart);
    if (fim === -1) break;

    if (hdr.includes("/FlateDecode")) {
      let dataEnd = fim;
      while (dataEnd > dataStart && (buffer[dataEnd - 1] === 0x0a || buffer[dataEnd - 1] === 0x0d)) {
        dataEnd--;
      }
      const inflado = inflatePdfStream(buffer.subarray(dataStart, dataEnd));
      if (inflado) conteudos.push(inflado.toString("latin1"));
    }

    pos = fim + "endstream".length;
  }

  return conteudos
    .map(extrairTextoDesenhado)
    .join("\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

exports.extrairTextoGta = onRequest(
  {
    region: "southamerica-east1",
    timeoutSeconds: 60,
    memory: "512MiB",
    cors: true,
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    try {
      // Um envio pode trazer várias GTAs: o operador joga os PDFs do lote de
      // uma vez em vez de importar guia por guia.
      const pdfs = Array.isArray(req.body?.pdfs) ? req.body.pdfs : [req.body?.pdf];
      if (!pdfs.length || !pdfs[0]) {
        res.status(400).json({ error: "Envie 'pdf' (base64) ou 'pdfs' (lista de base64)" });
        return;
      }
      if (pdfs.length > 20) {
        res.status(400).json({ error: "Máximo de 20 PDFs por requisição" });
        return;
      }

      const resultados = pdfs.map((b64, i) => {
        try {
          const texto = extrairTextoPdf(Buffer.from(b64, "base64"));
          if (!texto) return { indice: i, erro: "Não foi possível extrair texto do PDF" };
          return { indice: i, texto };
        } catch (e) {
          return { indice: i, erro: e.message || "Falha na extração" };
        }
      });

      res.json({ resultados });
    } catch (error) {
      console.error("Erro ao extrair texto da GTA:", error);
      res.status(500).json({ error: error.message || "Erro interno" });
    }
  }
);
