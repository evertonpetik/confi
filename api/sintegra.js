export const config = { maxDuration: 60 };

const SEFAZ_URL =
  "https://servicos.efazenda.ms.gov.br/consultapublica/Home/Consulta";
const SEFAZ_PAGE =
  "https://servicos.efazenda.ms.gov.br/consultapublica/";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default async function handler(req, res) {
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { inscricaoEstadual, captchaToken } = req.body;

    if (!inscricaoEstadual || !captchaToken) {
      return res
        .status(400)
        .json({ error: "inscricaoEstadual e captchaToken são obrigatórios" });
    }

    // Step 1: Visit page to get session cookies
    const pageRes = await fetch(SEFAZ_PAGE, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      redirect: "manual",
    });

    const cookies = [];
    const setCookies = pageRes.headers.get("set-cookie");
    if (setCookies) {
      setCookies.split(/,\s*(?=[A-Za-z_]+=)/).forEach((c) => {
        const nameValue = c.split(";")[0].trim();
        if (nameValue) cookies.push(nameValue);
      });
    }

    // Step 2: POST the form
    const params = new URLSearchParams({
      documentoIE: inscricaoEstadual,
      documentoCNPJ: "",
      "g-recaptcha-response": captchaToken,
    });

    const postRes = await fetch(SEFAZ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Referer: SEFAZ_PAGE,
        Cookie: cookies.join("; "),
      },
      body: params.toString(),
      redirect: "manual",
    });

    // Collect cookies from POST
    const postSetCookies = postRes.headers.get("set-cookie");
    if (postSetCookies) {
      postSetCookies.split(/,\s*(?=[A-Za-z_]+=)/).forEach((c) => {
        const nameValue = c.split(";")[0].trim();
        if (nameValue) cookies.push(nameValue);
      });
    }

    // Step 3: Follow redirect with GET
    if (postRes.status >= 300 && postRes.status < 400) {
      const location = postRes.headers.get("location");
      const fullUrl = location.startsWith("http")
        ? location
        : `https://servicos.efazenda.ms.gov.br${location}`;

      const resultRes = await fetch(fullUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Referer: SEFAZ_URL,
          Cookie: cookies.join("; "),
        },
      });

      const html = await resultRes.text();
      return res
        .status(200)
        .setHeader("Content-Type", "text/html; charset=utf-8")
        .send(html);
    }

    const html = await postRes.text();
    return res
      .status(200)
      .setHeader("Content-Type", "text/html; charset=utf-8")
      .send(html);
  } catch (error) {
    return res.status(500).json({
      error: "Erro no proxy: " + (error.message || "desconhecido"),
    });
  }
}
