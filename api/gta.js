export const config = { runtime: "edge" };

const ESANIAGRO_AUTH_URL = "https://api.ms.gov.br/api-esaniagro/auth/token";
const ESANIAGRO_API_URL = "https://api.ms.gov.br/api-esaniagro/v1";
const AUTH_BODY =
  "chave=4D0530300330390380300390310390300300300310380370&pessoa=03980919000187&grant_type=password";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

let cachedToken = null;
let tokenExpiry = 0;

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const res = await fetch(ESANIAGRO_AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: AUTH_BODY,
  });

  if (!res.ok) throw new Error("Falha ao obter token eSaniagro");

  const data = await res.json();
  cachedToken = `${data.token_type} ${data.access_token}`;
  tokenExpiry = Date.now() + data.expires_in * 1000 - 60000;
  return cachedToken;
}

export default async function handler(request) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  try {
    const { barcode, recaptchaToken } = await request.json();

    if (!barcode) {
      return new Response(JSON.stringify({ error: "barcode é obrigatório" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const token = await getToken();

    const apiRes = await fetch(
      `${ESANIAGRO_API_URL}/AutenticidadeGta/Digital`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token,
        },
        body: JSON.stringify({
          gRecaptchaResponse: recaptchaToken || "",
          qrcode: "",
          barcode,
        }),
      },
    );

    const responseBody = await apiRes.text();

    return new Response(responseBody, {
      status: apiRes.status,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Erro no proxy: " + (error.message || "desconhecido"),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      },
    );
  }
}
