export const config = { maxDuration: 60 };

const FIREBASE_FUNCTION_URL =
  "https://resolvercaptchasintegra-vof422eeva-rj.a.run.app";

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
    const apiRes = await fetch(FIREBASE_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const responseBody = await apiRes.text();

    res.status(apiRes.status).setHeader("Content-Type", "application/json");
    return res.send(responseBody);
  } catch (error) {
    return res.status(500).json({
      error: "Erro no proxy: " + (error.message || "desconhecido"),
    });
  }
}
