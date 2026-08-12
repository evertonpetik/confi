const fs = require("fs");
const content = `/**
 * Parser de e-GTA — tenta pdfjs-dist, cai em extração nativa com DecompressionStream.
 */
import { GTA, GtaAnimal } from "./weighing.types";

// ─── Método 1: pdfjs-dist (precisa do worker externo) ────────────────────────

async function extractViaPdfjs(buffer: ArrayBuffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc =
    \`https://unpkg.com/pdfjs-dist@\${pdfjs.version}/build/pdf.worker.min.mjs\`;

  const pdf = await pdfjs.getDocument({ data: buffer, verbosity: 0 }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page  = await pdf.getPage(i);
    const tc    = await page.getTextContent();
    let lastY: number | null = null;
    for (const item of tc.items) {
      if (!("str" in item)) continue;
      const y = (item as any).transform?.[5] ?? 0;
      if (lastY !== null && Math.abs(y - lastY) > 2) parts.push("\\n");
      parts.push((item as any).str);
      lastY = y;
    }
    parts.push("\\n");
  }
  return parts.join("").replace(/[ \\t]+/g, " ").trim();
}

// ─── Método 2: extração nativa (sem dependências) ────────────────────────────

async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const modes = ["deflate", "deflate-raw"] as const;
  for (const mode of modes) {
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
    } catch { /* try next mode */ }
  }
  throw new Error("Não foi possível descomprimir stream PDF");
}

function bytesToLatin1(bytes: Uint8Array): string {
  let s = "";
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode(...bytes.subarray(i, Math.min(i + CHUNK, bytes.length)));
  }
  return s;
}

function extractBtEt(content: string): string {
  const parts: string[] = [];
  // Operador Tj: (text)Tj
  content.replace(/\\(([^)]*)\\)\\s*Tj/g, (_, t) => { parts.push(decodePdfStr(t)); return ""; });
  // Operador TJ: [(text)-kern...]TJ
  content.replace(/\\[([^\\]]*)\\]\\s*TJ/g, (_, inner) => {
    inner.replace(/\\(([^)]*)\\)/g, (_2: string, t: string) => { parts.push(decodePdfStr(t)); return ""; });
    parts.push(" ");
    return "";
  });
  return parts.join("").replace(/\\s+/g, " ");
}

function decodePdfStr(s: string): string {
  // Converte escapes octais e mantém printable
  return s.replace(/\\\\([0-7]{1,3})/g, (_: string, oct: string) =>
    String.fromCharCode(parseInt(oct, 8))
  ).replace(/\\\\n/g, "\\n").replace(/\\\\r/g, " ").replace(/\\\\t/g, " ");
}

async function extractViaNative(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  const raw = bytesToLatin1(bytes);
  const allContent: string[] = [];

  // Procura todos os content streams com FlateDecode
  const dictRe = /(<<[^>]*\\/FlateDecode[^>]*>>)\\s*stream\\r?\\n/g;
  let m: RegExpExecArray | null;
  while ((m = dictRe.exec(raw)) !== null) {
    const streamStart = m.index + m[0].length;
    // Extrai /Length do dicionário
    const lenMatch = /\\/Length\\s+(\\d+)/.exec(m[1]);
    if (!lenMatch) continue;
    const len = parseInt(lenMatch[1], 10);
    const streamBytes = bytes.slice(streamStart, streamStart + len);
    try {
      const decompressed = await deflate(streamBytes);
      allContent.push(bytesToLatin1(decompressed));
    } catch {
      console.warn("[GTA] deflate falhou para um stream, pulando");
    }
  }

  if (allContent.length === 0) {
    // Fallback: tenta ler streams sem comprimir
    const rawStreamRe = /stream\\r?\\n([\\s\\S]*?)\\r?\\nendstream/g;
    while ((m = rawStreamRe.exec(raw)) !== null) {
      allContent.push(m[1]);
    }
  }

  return allContent.map(extractBtEt).join("\\n").replace(/[ \\t]+/g, " ").trim();
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
  const buffer = await file.arrayBuffer();
  let text = "";

  // Tenta pdfjs-dist primeiro (melhor qualidade)
  try {
    text = await extractViaPdfjs(buffer);
    console.log("[GTA] pdfjs-dist OK, chars:", text.length);
  } catch (e1) {
    console.warn("[GTA] pdfjs-dist falhou, tentando extração nativa:", (e1 as any)?.message);
    try {
      text = await extractViaNative(buffer);
      console.log("[GTA] extração nativa OK, chars:", text.length);
    } catch (e2) {
      console.error("[GTA] Ambos os métodos falharam:", e2);
    }
  }

  if (!text) return {};
  console.log("[GTA] texto extraído (primeiros 600):", text.slice(0, 600));
  return parseGtaText(text);
}
`;
fs.writeFileSync("src/services/gtaPdfParser.web.ts", content, "utf8");
console.log(
  "OK",
  fs.statSync("src/services/gtaPdfParser.web.ts").size,
  "bytes",
);
