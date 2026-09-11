/**
 * Parser de e-GTA (PDF) — extração nativa via DecompressionStream (sem dependências externas).
 * Opera diretamente em bytes binários para evitar corrupção de encoding.
 */
import { parseGtaText } from "./gtaParser";
import { GTA } from "./weighing.types";

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

async function tryInflate(data: Uint8Array, mode: "deflate" | "deflate-raw"): Promise<Uint8Array> {
  const src = new ReadableStream<Uint8Array>({
    start(ctrl) { ctrl.enqueue(data); ctrl.close(); },
  });
  const stream: ReadableStream<Uint8Array> = src.pipeThrough(new DecompressionStream(mode) as unknown as ReadableWritablePair<Uint8Array, Uint8Array>);
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

async function decompressZlib(data: Uint8Array): Promise<Uint8Array> {
  // Usa pipeThrough + Response para evitar travamentos em dados inválidos.
  // Tenta também pequenos deslocamentos iniciais, pois delimitação incorreta do
  // stream (ex: /Length indireto) pode deixar 1-3 bytes de lixo antes do cabeçalho zlib real.
  for (const offset of [0, 1, 2, 3]) {
    if (offset >= data.length) break;
    const slice = offset === 0 ? data : data.subarray(offset);
    for (const mode of ["deflate", "deflate-raw"] as const) {
      try {
        return await tryInflate(slice, mode);
      } catch { /* tenta próxima combinação */ }
    }
  }
  throw new Error("deflate falhou");
}

// ─── Extração de texto dos content streams ────────────────────────────────────

function decodePdfStr(s: string): string {
  return s
    .replace(/\\([0-7]{1,3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)))
    .replace(/\\n/g, "\n").replace(/\\r/g, " ").replace(/\\t/g, " ")
    .replace(/\\(.)/g, "$1"); // desescapa \( \) \\ remanescentes (strings PDF literais)
}

function extractBtEt(content: string): string {
  const parts: string[] = [];
  // Processa Tj e TJ na ordem real do stream (evita embaralhar campos)
  const opRe = /\(((?:\\.|[^()\\])*)\)\s*Tj|\[((?:[^\[\]])*)\]\s*TJ/g;
  let m: RegExpExecArray | null;
  while ((m = opRe.exec(content)) !== null) {
    if (m[1] !== undefined) {
      parts.push(decodePdfStr(m[1]));
    } else if (m[2] !== undefined) {
      const pRe = /\(((?:\\.|[^()\\])*)\)/g;
      let p: RegExpExecArray | null;
      while ((p = pRe.exec(m[2])) !== null) parts.push(decodePdfStr(p[1]));
    }
    parts.push(" "); // separa campos distintos desenhados em Tj/TJ isolados
  }
  return parts.join("");
}

// ─── Varredura binária do PDF para streams FlateDecode ───────────────────────

function findStreamStart(bytes: Uint8Array, from: number, stnl: Uint8Array, stcrnl: Uint8Array): { matchAt: number; dataStart: number } | null {
  let pos = from;
  while (pos <= bytes.length) {
    const nlPos = findSeq(bytes, stnl, pos);
    const crnlPos = findSeq(bytes, stcrnl, pos);
    if (nlPos === -1 && crnlPos === -1) return null;

    let matchAt: number, dataStart: number;
    if (nlPos === -1 || (crnlPos !== -1 && crnlPos < nlPos)) {
      matchAt = crnlPos; dataStart = crnlPos + stcrnl.length;
    } else {
      matchAt = nlPos; dataStart = nlPos + stnl.length;
    }

    // Evita falso positivo: "endstream\n" contém "stream\n" como substring
    const precedeEnd = matchAt >= 3 && bytes[matchAt - 3] === 0x65 && bytes[matchAt - 2] === 0x6e && bytes[matchAt - 1] === 0x64;
    if (precedeEnd) { pos = matchAt + 1; continue; }

    return { matchAt, dataStart };
  }
  return null;
}

export async function extrairTextoDoPdf(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  const dec = new TextDecoder("latin1");
  const STNL = ab("stream\n");
  const STCRNL = ab("stream\r\n");
  const ENDST = ab("endstream");

  const allContent: string[] = [];
  let pos = 0;

  while (pos < bytes.length) {
    const found = findStreamStart(bytes, pos, STNL, STCRNL);
    if (!found) break;
    const { matchAt, dataStart } = found;

    // Lê o cabeçalho (último 1KB antes de "stream") para extrair /FlateDecode e /Length
    const hdrStart = Math.max(0, matchAt - 1024);
    const hdr = dec.decode(bytes.slice(hdrStart, matchAt));

    if (!hdr.includes("/FlateDecode")) {
      // Stream sem compressão — pula para o próximo endstream
      const esPos = findSeq(bytes, ENDST, dataStart);
      pos = esPos === -1 ? bytes.length : esPos + ENDST.length;
      continue;
    }

    // Prioriza /Length direto (mais confiável que buscar "endstream" em binário,
    // que pode colidir com bytes coincidentes dentro dos dados comprimidos)
    let dataEnd = -1;
    const lenIndirect = /\/Length\s+\d+\s+\d+\s+R\b/.test(hdr);
    if (!lenIndirect) {
      const lm = /\/Length\s+(\d+)\b/.exec(hdr);
      if (lm) {
        const candidateEnd = dataStart + parseInt(lm[1], 10);
        let checkPos = candidateEnd;
        while (checkPos < bytes.length && (bytes[checkPos] === 0x0A || bytes[checkPos] === 0x0D || bytes[checkPos] === 0x20)) checkPos++;
        if (findSeq(bytes, ENDST, checkPos) === checkPos) dataEnd = candidateEnd;
      }
    }

    if (dataEnd === -1) {
      // Fallback: busca literal por "endstream" em binário
      const esPos = findSeq(bytes, ENDST, dataStart);
      if (esPos === -1) { pos = bytes.length; break; }
      dataEnd = esPos;
      while (dataEnd > dataStart && (bytes[dataEnd - 1] === 0x0A || bytes[dataEnd - 1] === 0x0D)) dataEnd--;
    }

    const streamData = bytes.slice(dataStart, dataEnd);
    const hexSnippet = Array.from(streamData.slice(0, 8)).map((b) => b.toString(16).padStart(2, "0")).join(" ");
    console.log(`[GTA] stream ${allContent.length + 1}: ${streamData.length} bytes | primeiros bytes: ${hexSnippet}`);
    try {
      const decompressed = await decompressZlib(streamData);
      allContent.push(dec.decode(decompressed));
      console.log(`[GTA] stream ${allContent.length} descomprimido: ${decompressed.length} bytes`);
    } catch (e) {
      console.warn("[GTA] stream falhou:", (e as Error).message.slice(0, 80));
      console.warn("[GTA] hdr trecho:", hdr.slice(-300));
    }

    // Avança para depois do "endstream" real, evitando reprocessar o mesmo trecho
    const esAfter = findSeq(bytes, ENDST, dataEnd);
    pos = esAfter === -1 ? Math.max(dataEnd + 1, dataStart + 1) : esAfter + ENDST.length;
  }

  const combined = allContent.map(extractBtEt).join("\n");
  return combined.replace(/[ \t]+/g, " ").trim();
}

// ─── Ponto de entrada ─────────────────────────────────────────────────────────

export { parseGtaText };

export async function parseGtaFromFile(file: File): Promise<Partial<GTA>> {
  try {
    const text = await extrairTextoDoPdf(await file.arrayBuffer());
    console.log("[GTA] extraído chars:", text.length, "| texto completo:", text);
    if (!text) return {};
    return parseGtaText(text);
  } catch (e) {
    console.error("[GTA] falha na extração:", e);
    return {};
  }
}
