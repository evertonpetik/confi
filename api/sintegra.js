export const config = { runtime: "edge" };

const FIREBASE_FUNCTION_URL =
  "https://consultarsintegra-vof422eeva-rj.a.run.app";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

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
    const { inscricaoEstadual } = await request.json();

    if (!inscricaoEstadual) {
      return new Response(
        JSON.stringify({ error: "inscricaoEstadual é obrigatório" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        },
      );
    }

    const apiRes = await fetch(FIREBASE_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inscricaoEstadual }),
    });

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
