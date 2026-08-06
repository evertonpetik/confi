/**
 * Parser de e-GTA (PDF) para uso no browser via Web File API.
 * Extrai texto cru do PDF binary (funciona com PDFs não-criptografados, como os e-GTAs do IAGRO/MAPA).
 */
import { GTA, GtaAnimal } from "./weighing.types";

// ─── Extração de texto do PDF ─────────────────────────────────────────────────

function decodeOctal(str: string): string {
  return str.replace(/\\([0-7]{3})/g, (_, oct) =>
    String.fromCharCode(parseInt(oct, 8))
  );
}

function extractRawText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const latin1 = Array.from(bytes, (b) => String.fromCharCode(b)).join("");

  const parts: string[] = [];

  // Extrai todas as strings literais entre BT...ET
  const btEt = /BT([\s\S]*?)ET/g;
  let m: RegExpExecArray | null;
  while ((m = btEt.exec(latin1)) !== null) {
    const block = m[1];

    // Operador Tj: (texto) Tj
    const tj = /\(([^)]*)\)\s*Tj/g;
    let t: RegExpExecArray | null;
    while ((t = tj.exec(block)) !== null) {
      parts.push(decodeOctal(t[1]));
    }

    // Operador TJ: [(str) kern (str) ...] TJ
    const tjArr = /\[([\s\S]*?)\]\s*TJ/g;
    let ta: RegExpExecArray | null;
    while ((ta = tjArr.exec(block)) !== null) {
      const inner = ta[1];
      const pieces = inner.match(/\(([^)]*)\)/g) ?? [];
      parts.push(pieces.map((p) => decodeOctal(p.slice(1, -1))).join(""));
    }
  }

  // Fallback: extrai strings fora de BT/ET (Tj livre)
  const loose = /\(([^)]{2,120})\)\s*Tj/g;
  while ((m = loose.exec(latin1)) !== null) {
    parts.push(decodeOctal(m[1]));
  }

  return parts.join(" ").replace(/\s+/g, " ");
}

// ─── Parser dos campos da GTA ────────────────────────────────────────────────

function campo(text: string, pattern: RegExp): string {
  const m = pattern.exec(text);
  return m ? m[1].trim() : "";
}

function parseData(str: string): string {
  // "30/07/2026" → ISO 8601
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(str);
  if (!m) return "";
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export async function parseGtaFromFile(file: File): Promise<Partial<GTA>> {
  const buffer = await file.arrayBuffer();
  const text = extractRawText(buffer);

  // Número, série e UF
  const numero = campo(text, /N[uú]mero\s+(\d{5,8})/i);
  const serie = campo(text, /S[eé]rie\s+([A-Z])/i);
  const uf = campo(text, /\bUF\s+([A-Z]{2})\b/i) || "MS";

  // Procedência
  const procCpfCnpj = campo(text, /PROCED[EÊ]NCIA[\s\S]{0,200}?CPF\/CNPJ:\s*([\d./-]+)/i);
  const procNome = campo(text, /PROCED[EÊ]NCIA[\s\S]{0,400}?Nome:\s*([^\n\r]+)/i);
  const procFazenda = campo(text, /PROCED[EÊ]NCIA[\s\S]{0,600}?Estabelecimento:\s*([^\n\r]+)/i);
  const procCodigoMapa = campo(text, /PROCED[EÊ]NCIA[\s\S]{0,800}?C[oó]digo MAPA:\s*(\d+)/i);
  const procInsc = campo(text, /PROCED[EÊ]NCIA[\s\S]{0,1000}?Insc\.\s*Estadual:\s*([\d./-]+)/i);
  const procMunRaw = campo(text, /PROCED[EÊ]NCIA[\s\S]{0,1200}?Municipio:\s*(\d+ - [^\n\r]+)/i);
  const procMun = procMunRaw.replace(/\s*UF:.*$/, "").trim();
  const procUf = campo(text, /PROCED[EÊ]NCIA[\s\S]{0,1200}?UF:\s*([A-Z]{2})/i) || "MS";
  const procRegiao = campo(text, /PROCED[EÊ]NCIA[\s\S]{0,200}?Regi[aã]o:\s*([^\n\r]+)/i);

  // Destino (os mesmos campos, mas depois da palavra DESTINO)
  const destIdx = text.search(/DESTINO/i);
  const textDest = destIdx >= 0 ? text.slice(destIdx) : text;

  const destCpfCnpj = campo(textDest, /CPF\/CNPJ:\s*([\d./-]+)/i);
  const destNome = campo(textDest, /Nome:\s*([^\n\r]+)/i);
  const destFazenda = campo(textDest, /Estabelecimento:\s*([^\n\r]+)/i);
  const destCodigoMapa = campo(textDest, /C[oó]digo MAPA:\s*(\d+)/i);
  const destInsc = campo(textDest, /Insc\.\s*Estadual:\s*([\d./-]+)/i);
  const destMunRaw = campo(textDest, /Municipio:\s*(\d+ - [^\n\r]+)/i);
  const destMun = destMunRaw.replace(/\s*UF:.*$/, "").trim();
  const destUf = campo(textDest, /UF:\s*([A-Z]{2})/i) || "MS";
  const destRegiao = campo(textDest, /Regi[aã]o:\s*([^\n\r]+)/i);

  // Finalidade / transporte
  const finalidade = campo(text, /FINALIDADE:\s*([A-ZÁÉÍÓÚ]+)/i);
  const transporte = campo(text, /MEIO DE TRANSPORTE:\s*([A-ZÁÉÍÓÚ]+)/i);

  // Rota
  const rota = campo(text, /ROTA\s+([^\n\r]+)/i);

  // Datas
  const dataEmissao = parseData(campo(text, /Data:\s*(\d{2}\/\d{2}\/\d{4})/i));
  const dataValidade = parseData(campo(text, /Validade:\s*(\d{2}\/\d{2}\/\d{4})/i));

  // Unidade expedidora
  const unidade = campo(text, /Unidade Expedidora:\s*([^\n\r]+)/i);

  // Animais (linhas com "BOVINO ...")
  const animais: GtaAnimal[] = [];
  const animalRe = /(BOVINO\s+[A-ZÁÉÍÓÚ ]+?)\s+(\d+)/gi;
  let am: RegExpExecArray | null;
  let totalMachos = 0;
  let totalFemeas = 0;

  while ((am = animalRe.exec(text)) !== null) {
    const desc = am[1].trim();
    const qtd = parseInt(am[2], 10);
    const sexo: "M" | "F" | "ambos" = /f[eê]mea/i.test(desc)
      ? "F"
      : /macho/i.test(desc)
        ? "M"
        : "ambos";

    const idadeM = /(\d+ MESES|ACIMA DE \d+ MESES|ATÉ \d+ MESES)/i.exec(desc);
    const idadeCategoria = idadeM ? idadeM[1] : undefined;

    animais.push({ descricao: desc, quantidade: qtd, sexo, idadeCategoria });
    if (sexo === "M") totalMachos += qtd;
    else if (sexo === "F") totalFemeas += qtd;
    else { totalMachos += qtd; }
  }

  // Total (fallback a partir das linhas Macho/Fêmea/Total)
  const mMacho = /Macho\s+(\d+)/i.exec(text);
  const mFemea = /F[eê]mea\s+(\d+)/i.exec(text);
  const mTotal = /\bTotal\s+(\d+)/i.exec(text);

  if (mMacho) totalMachos = parseInt(mMacho[1], 10);
  if (mFemea) totalFemeas = parseInt(mFemea[1], 10);
  const total = mTotal ? parseInt(mTotal[1], 10) : totalMachos + totalFemeas;

  return {
    numero,
    serie,
    uf,
    procCpfCnpj,
    procNome,
    procFazenda,
    procCodigoMapa,
    procInscricaoEstadual: procInsc,
    procMunicipio: procMun,
    procUf,
    procRegiao,
    destCpfCnpj,
    destNome,
    destFazenda,
    destCodigoMapa,
    destInscricaoEstadual: destInsc,
    destMunicipio: destMun,
    destUf,
    destRegiao,
    finalidade,
    transporte,
    animais,
    totalMachos,
    totalFemeas,
    total,
    rota,
    dataEmissao,
    dataValidade,
    unidadeExpedidora: unidade,
    status: "ativa",
  };
}
