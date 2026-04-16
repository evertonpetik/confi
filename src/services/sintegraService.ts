import { Platform } from "react-native";

const CAPTCHA_API =
  "https://resolvercaptchasintegra-vof422eeva-rj.a.run.app";

const SEFAZ_PROXY =
  Platform.OS === "web"
    ? "/api/sintegra"
    : "https://confi-gilt.vercel.app/api/sintegra";

export type SintegraData = {
  inscricaoEstadual: string | null;
  dataInclusao: string | null;
  nomePropriedade: string | null;
  cpfCnpj: string | null;
  razaoSocial: string | null;
  nomeDocumentosFiscais: string | null;
  descricaoAtividade: string | null;
  localizacaoPropriedade: string | null;
  municipio: string | null;
  domicilioFiscal: string | null;
  situacaoCadastral: string | null;
  motivoSituacao: string | null;
  dataAtualizacao: string | null;
  condominos: string[];
};

function formatIE(ie: string): string {
  const digits = ie.replace(/\D/g, "");
  if (digits.length === 9) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}-${digits.slice(8)}`;
  }
  return ie;
}

function parseSintegraHtml(html: string): SintegraData | null {
  const clean = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

  // Check for errors
  const errorMatch = html.match(
    /id=["']error["'][^>]*value=["']([^"']+)["']/i,
  );
  if (errorMatch && errorMatch[1]) {
    const msg = errorMatch[1]
      .replace(/&#(\d+);/g, (_, c: string) =>
        String.fromCharCode(parseInt(c)),
      )
      .trim();
    if (msg.length > 0) throw new Error(msg);
  }

  // Check if result page
  if (
    !clean.includes("Propriedade") &&
    !clean.includes("HABILITADO") &&
    !clean.includes("CANCELADO") &&
    !clean.includes("ATIV")
  ) {
    return null;
  }

  function extractField(label: string): string | null {
    const regex = new RegExp(
      `${label}[\\s:]*(?:</[^>]+>)?\\s*(?:<[^>]+>)*\\s*([^<]+)`,
      "i",
    );
    const match = regex.exec(clean);
    if (match && match[1]) {
      const val = match[1]
        .replace(/&nbsp;/g, " ")
        .replace(/&#(\d+);/g, (_, c: string) =>
          String.fromCharCode(parseInt(c)),
        )
        .trim();
      if (val.length > 0 && val !== "-") return val;
    }
    return null;
  }

  // Extract condôminos
  const condominos: string[] = [];
  const condRegex =
    /\*{3}[.\d]*\*{2}\s*-\s*([A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ\s]+)/gi;
  let condMatch: RegExpExecArray | null;
  while ((condMatch = condRegex.exec(clean)) !== null) {
    condominos.push(condMatch[0].trim());
  }

  return {
    inscricaoEstadual:
      extractField("Incri..{0,3}o Estadual") ??
      extractField("Inscri..{0,3}o Estadual"),
    dataInclusao: extractField("Data de Inclus"),
    nomePropriedade: extractField("Nome da Propriedade"),
    cpfCnpj: extractField("CPF/CNPJ"),
    razaoSocial:
      extractField("Raz..{0,3}o Social/Nome") ??
      extractField("Raz..{0,3}o Social"),
    nomeDocumentosFiscais: extractField(
      "Nome a Constar em Documentos Fiscais",
    ),
    descricaoAtividade: extractField("Descri..{0,5}o da Atividade"),
    localizacaoPropriedade: extractField("Localiza..{0,5}o da Propriedade"),
    municipio: extractField("Munic..pio"),
    domicilioFiscal: extractField("Domic..lio Fiscal"),
    situacaoCadastral: extractField("Situa..{0,5}o Cadastral"),
    motivoSituacao: extractField("Motivo da Situa"),
    dataAtualizacao: extractField("Data Atualiza"),
    condominos,
  };
}

export async function consultarSintegra(
  inscricaoEstadual: string,
): Promise<SintegraData> {
  const ie = formatIE(inscricaoEstadual);

  // Step 1: Get captcha token from Firebase Function (direct, has cors: true)
  const captchaRes = await fetch(CAPTCHA_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  if (!captchaRes.ok) {
    const err = await captchaRes.json().catch(() => ({}));
    throw new Error((err as any).error || "Erro ao resolver captcha");
  }

  const { token } = (await captchaRes.json()) as { token: string };

  // Step 2: Query SEFAZ via Vercel proxy (avoids CORS + GCP IP block)
  const sefazRes = await fetch(SEFAZ_PROXY, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inscricaoEstadual: ie, captchaToken: token }),
  });

  if (!sefazRes.ok) {
    const err = await sefazRes.json().catch(() => ({}));
    throw new Error(
      (err as any).error || `Erro na consulta (${sefazRes.status})`,
    );
  }

  const html = await sefazRes.text();
  const data = parseSintegraHtml(html);

  if (!data) {
    throw new Error("Contribuinte não encontrado ou resposta inesperada");
  }

  return data;
}
