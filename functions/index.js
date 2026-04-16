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

// ===================== SINTEGRA MS =====================

const SINTEGRA_MS_URL =
  "https://servicos.efazenda.ms.gov.br/consultapublica/Home/Consulta";
const SINTEGRA_MS_PAGE_URL =
  "https://servicos.efazenda.ms.gov.br/consultapublica/";
const SINTEGRA_MS_RECAPTCHA_SITE_KEY =
  "6Ld76NYcAAAAAIpOB-nhuk_M3bDpNUVw_qcNxvtZ";

/**
 * Solve reCAPTCHA v2 for Sintegra MS.
 */
async function solveSintegraRecaptcha(apiKey) {
  const createRes = await fetch("https://api.capsolver.com/createTask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientKey: apiKey,
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
  throw new Error("Timeout resolvendo reCAPTCHA do Sintegra");
}

/**
 * Query Sintegra MS with IE and recaptcha token.
 */
async function querySintegraMS(inscricaoEstadual, recaptchaToken) {
  const params = new URLSearchParams({
    documentoIE: inscricaoEstadual,
    documentoCNPJ: "",
    "g-recaptcha-response": recaptchaToken,
  });

  const res = await fetch(SINTEGRA_MS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
      Referer: SINTEGRA_MS_PAGE_URL,
    },
    body: params.toString(),
    redirect: "manual",
  });

  console.log("Sintegra response status:", res.status);
  console.log(
    "Sintegra response location:",
    res.headers.get("location")
  );

  // If redirect, follow it
  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get("location");

    // Redirect to Index = IE not found
    if (location && location.includes("/Home/Index")) {
      throw new Error("Inscrição estadual não encontrada");
    }

    const cookies = [];
    if (typeof res.headers.getSetCookie === "function") {
      res.headers.getSetCookie().forEach((c) => {
        const nameValue = c.split(";")[0].trim();
        if (nameValue) cookies.push(nameValue);
      });
    }

    const fullUrl = location.startsWith("http")
      ? location
      : `https://servicos.efazenda.ms.gov.br${location}`;

    console.log("Following redirect to:", fullUrl);

    const res2 = await fetch(fullUrl, {
      headers: {
        "User-Agent": USER_AGENT,
        Referer: SINTEGRA_MS_URL,
        Cookie: cookies.join("; "),
      },
    });
    return res2.text();
  }

  if (!res.ok) {
    throw new Error(`Sintegra MS HTTP ${res.status}`);
  }

  return res.text();
}

/**
 * Parse Sintegra MS HTML response into structured JSON.
 */
function parseSintegraHtml(html) {
  // Check for error messages
  const errorMatch = html.match(
    /id=["']error["'][^>]*value=["']([^"']+)["']/i
  );
  if (errorMatch && errorMatch[1]) {
    const errorMsg = errorMatch[1]
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(code))
      .trim();
    if (
      errorMsg.includes("robo") ||
      errorMsg.includes("Marque") ||
      errorMsg.includes("captcha")
    ) {
      return null; // captcha needed
    }
    throw new Error(errorMsg);
  }

  // Try to extract data from table rows or labeled fields
  function extractByLabel(label) {
    // Pattern: <label>Text:</label> ... <value> or <td>Label</td><td>Value</td>
    const patterns = [
      new RegExp(
        `(?:<td[^>]*>\\s*)?<b>\\s*${label}\\s*:?\\s*</b>\\s*</td>\\s*<td[^>]*>\\s*([^<]+)`,
        "i"
      ),
      new RegExp(
        `(?:<td[^>]*>\\s*)?${label}\\s*:?\\s*</td>\\s*<td[^>]*>\\s*([^<]+)`,
        "i"
      ),
      new RegExp(
        `<label[^>]*>\\s*${label}\\s*:?\\s*</label>[^<]*<[^>]*>\\s*([^<]+)`,
        "i"
      ),
      new RegExp(
        `${label}\\s*:?\\s*</?(b|strong|td|th|label)[^>]*>[^<]*<[^>]*>\\s*([^<]+)`,
        "i"
      ),
      new RegExp(`${label}\\s*:?\\s*([^<\\n]+)`, "i"),
    ];

    for (const regex of patterns) {
      const match = regex.exec(html);
      if (match) {
        const raw = match[2] || match[1];
      if (!raw) continue;
      const val = raw.trim();
        if (val && val !== "&nbsp;" && val.length > 0) return val;
      }
    }
    return null;
  }

  // Check if this looks like a result page (not the form page)
  const hasResult =
    html.includes("Raz") ||
    html.includes("Situa") ||
    html.includes("CNPJ") ||
    html.includes("Inscri") ||
    html.includes("Endere") ||
    html.includes("comprovante");

  if (!hasResult) {
    return null;
  }

  return {
    inscricaoEstadual: extractByLabel("Inscri..{1,5}o Estadual"),
    razaoSocial: extractByLabel("Raz..{1,3}o Social|Nome|Contribuinte"),
    nomeFantasia: extractByLabel("Nome Fantasia|Fantasia"),
    cnpjCpf: extractByLabel("CNPJ|CPF"),
    situacao: extractByLabel("Situa..{1,5}o Cadastral|Situa..{1,5}o"),
    dataCredenciamento: extractByLabel("Data.{0,5}Credenciamento"),
    endereco: extractByLabel("Endere..o|Logradouro"),
    numero: extractByLabel("N..mero|N\\."),
    complemento: extractByLabel("Complemento"),
    bairro: extractByLabel("Bairro|Distrito"),
    municipio: extractByLabel("Munic..pio|Cidade"),
    uf: extractByLabel("UF|Estado"),
    cep: extractByLabel("CEP"),
    telefone: extractByLabel("Telefone|Fone"),
    atividadePrincipal: extractByLabel(
      "Atividade Principal|Atividade Econ..mica|CNAE"
    ),
    regimeApuracao: extractByLabel("Regime.{0,5}Apura..{1,3}o|Regime"),
  };
}

exports.consultarSintegra = onRequest(
  {
    region: "southamerica-east1",
    timeoutSeconds: 300,
    memory: "256MiB",
    cors: true,
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const { inscricaoEstadual } = req.body;
    if (
      !inscricaoEstadual ||
      typeof inscricaoEstadual !== "string" ||
      inscricaoEstadual.replace(/\D/g, "").length < 7
    ) {
      res.status(400).json({ error: "Inscrição estadual inválida" });
      return;
    }

    try {
      // Step 1: Solve reCAPTCHA
      console.log("Resolvendo reCAPTCHA do Sintegra MS...");
      const recaptchaToken = await solveSintegraRecaptcha(CAPSOLVER_API_KEY);

      // Step 2: Query with captcha
      const numbersOnly = inscricaoEstadual.replace(/\D/g, "");
      const html = await querySintegraMS(numbersOnly, recaptchaToken);
      const data = parseSintegraHtml(html);

      if (!data) {
        throw new Error(
          "Consulta falhou — contribuinte não encontrado ou resposta inesperada"
        );
      }

      res.json({ data, source: "sintegra-ms" });
    } catch (error) {
      console.error("Erro na consulta Sintegra:", error);
      res.status(500).json({
        error: error.message || "Erro interno na consulta Sintegra",
      });
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
