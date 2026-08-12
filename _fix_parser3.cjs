const fs = require("fs");
const content = `/**
 * Parser de e-GTA (PDF) — extração nativa via DecompressionStream (sem dependências externas).
 * Opera diretamente em bytes binários para evitar corrupção de encoding.
 */
import { GTA, GtaAnimal } from "./weighing.types";

// ─── Busca binária em Uint8Array ──────────────────────────────────────────────

function findSeq(hay: Uint8Array, needle: Uint8Array, from = 0): number {
  outer: for (let i = from; i <= hay.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (hay[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

function ab(s: string): Uint8Array {
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b;
}

// ─── Descompressão zlib (FlateDecode) ────────────────────────────────────────

async function decompressZlib(data: Uint8Array): Promise<Uint8Array> {
  for (const mode of ["deflate", "deflate-raw"] as const) {
    try {
      const ds = new DecompressionStream(mode);
      const writer = ds.writable.getWriter();
      const reader = ds.readable.getReader();
      writer.write(data);
      writer.close();
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }
      const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
      let off = 0;
      for (const c of chunks) { out.set(c, off); off += c.length; }
      return out;
    } catch { /* tenta próximo modo */ }
  }
  throw new Error("deflate falhou");
}

// ─── Extração de texto dos content streams ────────────────────────────────────

function decodePdfStr(s: string): string {
  return s
    .replace(/\\\\([0-7]{1,3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)))
    .replace(/\\\\n/g, "\\n").replace(/\\\\r/g, " ").replace(/\\\\t/g, " ");
}

function extractBtEt(content: string): string {
  const parts: string[] = [];
  const tjRe    = /\\(([^)]*)\\)\\s*Tj/g;
  const tjArrRe = /\\[([\\s\\S]*?)\\]\\s*TJ/g;
  let m: RegExpExecArray | null;
  while ((m = tjRe.exec(content))    !== null) parts.push(decodePdfStr(m[1]));
  while ((m = tjArrRe.exec(content)) !== null) {
    const inner = m[1];
    const pRe = /\\(([^)]*)\\)/g;
    let p: RegExpExecArray | null;
    while ((p = pRe.exec(inner)) !== null) parts.push(decodePdfStr(p[1]));
    parts.push(" ");
  }
  return parts.join("");
}

// ─── Varredura binária do PDF para streams FlateDecode ───────────────────────

async function extractText(buffer: ArrayBuffer): Promise<string> {
  const bytes  = new Uint8Array(buffer);
  const dec    = new TextDecoder("latin1");
  const STNL   = ab("stream\\n");
  const STCRNL = ab("stream\\r\\n");
  const ENDST  = ab("endstream");

  const allContent: string[] = [];
  let pos = 0;

  while (pos < bytes.length) {
    const nlPos   = findSeq(bytes, STNL,   pos);
    const crnlPos = findSeq(bytes, STCRNL, pos);
    if (nlPos === -1 && crnlPos === -1) break;

    let matchAt: number, dataStart: number;
    if (nlPos === -1 || (crnlPos !== -1 && crnlPos < nlPos)) {
      matchAt = crnlPos; dataStart = crnlPos + STCRNL.length;
    } else {
      matchAt = nlPos;   dataStart = nlPos   + STNL.length;
    }

    // Lê o cabeçalho (último 1KB antes de "stream") para extrair /FlateDecode e /Length
    const hdrStart = Math.max(0, matchAt - 1024);
    const hdr = dec.decode(bytes.slice(hdrStart, matchAt));

    if (!hdr.includes("/FlateDecode")) {
      // Stream sem compressão — pula para o próximo endstream
      const esPos = findSeq(bytes, ENDST, dataStart);
      pos = esPos === -1 ? bytes.length : esPos + ENDST.length;
      continue;
    }

    // Extrai /Length para ler os bytes exatos
    const lenMatch = /\\/Length\\s+(\\d+)/.exec(hdr);
    let dataEnd: number;
    if (lenMatch) {
      dataEnd = dataStart + parseInt(lenMatch[1], 10);
    } else {
      // Fallback: encontra endstream em bytes
      const esPos = findSeq(bytes, ENDST, dataStart);
      if (esPos === -1) { pos = bytes.length; break; }
      dataEnd = esPos;
      while (dataEnd > dataStart && (bytes[dataEnd - 1] === 0x0A || bytes[dataEnd - 1] === 0x0D)) dataEnd--;
    }

    const streamData = bytes.slice(dataStart, dataEnd);
    try {
      const decompressed = await decompressZlib(streamData);
      allContent.push(dec.decode(decompressed));
    } catch (e) {
      console.warn("[GTA] stream falhou:", (e as Error).message.slice(0, 80));
    }

    pos = Math.max(dataEnd + 1, dataStart + 1); // avança sempre
  }

  const combined = allContent.map(extractBtEt).join("\\n");
  return combined.replace(/[ \\t]+/g, " ").trim();
}

// ─── Helpers de parsing ───────────────────────────────────────────────────────

function campo(text: string, re: RegExp): string {
  const m = re.exec(text);
  return m ? m[1].trim() : "";
}

function parseDataBr(s: string): string {
  const m = /(\\d{2})\\/(\\d{2})\\/(\\d{4})/.exec(s);
  return m ? \`\${m[3]}-\${m[2]}-\${m[1]}\` : "";
}

// ─── Parser dos campos da e-GTA IAGRO ────────────────────────────────────────

function parseGtaText(text: string): Partial<GTA> {
  const uf     = campo(text, /\\bUF\\b[\\s\\n]+([A-Z]{2})\\b/i);
  const numero = campo(text, /N.mero\\b[\\s\\n]+(\\d{5,8})/i);
  const serie  = campo(text, /S.rie\\b[\\s\\n]+([A-Z])/i);

  const idxDest  = text.search(/\\bDESTINO\\b/i);
  const blocProc = idxDest > 0 ? text.slice(0, idxDest) : text;
  const blocDest = idxDest >= 0 ? text.slice(idxDest) : "";

  const procCpfCnpj    = campo(blocProc, /CPF\\/CNPJ:\\s*([\\d.\\-\\/]+)/i);
  const procRegiao     = campo(blocProc, /Regi.o:\\s*([^\\n\\r,]+)/i);
  const procNome       = campo(blocProc, /Nome:\\s*([^\\n\\r]+)/i);
  const procFazenda    = campo(blocProc, /Estabelecimento:\\s*([^\\n\\r]+)/i);
  const procCodigoMapa = campo(blocProc, /C.digo MAPA:\\s*(\\d+)/i);
  const procInsc       = campo(blocProc, /Insc\\.?\\s*Estadual:\\s*([\\d.\\-\\/]+)/i);
  const procMunRaw     = campo(blocProc, /Municipio:\\s*(\\d{7}\\s*-\\s*[^\\n\\r]+)/i);
  const procMunicipio  = procMunRaw.replace(/\\s*UF:.*$/, "").trim();
  const procUf         = campo(blocProc, /Municipio:.*?UF:\\s*([A-Z]{2})/i) || uf;

  const destCpfCnpj    = campo(blocDest, /CPF\\/CNPJ:\\s*([\\d.\\-\\/]+)/i);
  const destRegiao     = campo(blocDest, /Regi.o:\\s*([^\\n\\r,]+)/i);
  const destNome       = campo(blocDest, /Nome:\\s*([^\\n\\r]+)/i);
  const destFazenda    = campo(blocDest, /Estabelecimento:\\s*([^\\n\\r]+)/i);
  const destCodigoMapa = campo(blocDest, /C.digo MAPA:\\s*(\\d+)/i);
  const destInsc       = campo(blocDest, /Insc\\.?\\s*Estadual:\\s*([\\d.\\-\\/]+)/i);
  const destMunRaw     = campo(blocDest, /Municipio:\\s*(\\d{7}\\s*-\\s*[^\\n\\r]+)/i);
  const destMunicipio  = destMunRaw.replace(/\\s*UF:.*$/, "").trim();
  const destUf         = campo(blocDest, /Municipio:.*?UF:\\s*([A-Z]{2})/i) || uf;

  const finalidade        = campo(text, /FINALIDADE:\\s*(\\S+)/i);
  const transporte        = campo(text, /MEIO DE TRANSPORTE:\\s*(\\S+)/i);
  const rota              = campo(text, /ROTA\\s+([^\\n\\r]+)/i);
  const dataEmissao       = parseDataBr(campo(text, /(?:Data|Emiss.o):\\s*(\\d{2}\\/\\d{2}\\/\\d{4})/i));
  const dataValidade      = parseDataBr(campo(text, /Validade:\\s*(\\d{2}\\/\\d{2}\\/\\d{4})/i));
  const unidadeExpedidora = campo(text, /Unidade Expedidora:\\s*([^\\n\\r]+)/i);

  const animais: GtaAnimal[] = [];
  const animalRe = /\\b(BOVINO\\s+(?:MACHO|F.MEA|MISTO)\\s+[A-Z0-9 ]+?)\\s{1,6}(\\d{1,6})\\b/gi;
  let am: RegExpExecArray | null;
  while ((am = animalRe.exec(text)) !== null) {
    const desc = am[1].replace(/\\s+/g, " ").trim();
    const qtd  = parseInt(am[2], 10);
    if (qtd <= 0 || qtd > 99999) continue;
    const sexo: "M" | "F" | "ambos" = /f.mea/i.test(desc) ? "F" : /macho/i.test(desc) ? "M" : "ambos";
    const idadeM = /((?:\\d+\\s+A\\s+\\d+|\\d+|ACIMA DE \\d+)\\s+MESES)/i.exec(desc);
    animais.push({ descricao: desc, quantidade: qtd, sexo, idadeCategoria: idadeM?.[1] });
  }

  let totalMachos = animais.filter((a) => a.sexo === "M" || a.sexo === "ambos").reduce((s, a) => s + a.quantidade, 0);
  let totalFemeas = animais.filter((a) => a.sexo === "F").reduce((s, a) => s + a.quantidade, 0);
  const mM = /\\bMacho\\b[\\s\\n]+(\\d+)/i.exec(text);
  const mF = /\\bF.mea\\b[\\s\\n]+(\\d+)/i.exec(text);
  const mT = /\\bTotal\\b[\\s\\n]+(\\d+)/i.exec(text);
  if (mM) totalMachos = parseInt(mM[1], 10);
  if (mF) totalFemeas = parseInt(mF[1], 10);
  const total = mT ? parseInt(mT[1], 10) : totalMachos + totalFemeas;

  return {
    numero, serie, uf: uf || procUf,
    procCpfCnpj, procNome, procFazenda, procCodigoMapa,
    procInscricaoEstadual: procInsc, procMunicipio, procUf, procRegiao,
    destCpfCnpj, destNome, destFazenda, destCodigoMapa,
    destInscricaoEstadual: destInsc, destMunicipio, destUf, destRegiao,
    finalidade, transporte, animais, totalMachos, totalFemeas, total,
    rota, dataEmissao, dataValidade, unidadeExpedidora, status: "ativa",
  };
}

// ─── Ponto de entrada ─────────────────────────────────────────────────────────

export async function parseGtaFromFile(file: File): Promise<Partial<GTA>> {
  try {
    const text = await extractText(await file.arrayBuffer());
    console.log("[GTA] extraído chars:", text.length, "| amostra:", text.slice(0, 400));
    if (!text) return {};
    return parseGtaText(text);
  } catch (e) {
    console.error("[GTA] falha na extração:", e);
    return {};
  }
}
`;
fs.writeFileSync("src/services/gtaPdfParser.web.ts", content, "utf8");
console.log(
  "OK",
  fs.statSync("src/services/gtaPdfParser.web.ts").size,
  "bytes",
);
