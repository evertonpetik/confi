/**
 * Proxy para a Cloud Function `extrairTextoGta`.
 *
 * Mesmo papel de api/gta.js: dá ao app um endpoint estável e resolve CORS,
 * sem o cliente precisar conhecer a URL gerada no deploy da function.
 *
 * Runtime Node (não edge): PDFs em base64 passam do limite de corpo do edge.
 */
const FIREBASE_FUNCTION_URL =
  process.env.EXTRAIR_TEXTO_GTA_URL ||
  "https://southamerica-east1-confi-5c988.cloudfunctions.net/extrairTextoGta";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const config = {
  api: {
    bodyParser: { sizeLimit: "25mb" },
  },
};

export default async function handler(req, res) {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const apiRes = await fetch(FIREBASE_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    const corpo = await apiRes.text();
    res.status(apiRes.status).setHeader("Content-Type", "application/json").send(corpo);
  } catch (error) {
    res.status(500).json({ error: error.message || "Erro ao extrair texto da GTA" });
  }
}
