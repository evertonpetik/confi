/**
 * Importação de e-GTA a partir do PDF, nos dois ambientes.
 *
 * O texto do PDF sai por dois caminhos:
 *   web    — extração local (DecompressionStream), sem rede, com o servidor
 *            como reserva quando o PDF resiste
 *   nativo — sempre pelo servidor: React Native não tem DecompressionStream
 *
 * A leitura dos campos é sempre a mesma (./gtaParser), então os dois ambientes
 * produzem exatamente o mesmo resultado a partir do mesmo PDF.
 */
import { Platform } from "react-native";
import { conferirLoteDeGtas, parseGtaText } from "./gtaParser";
import { GTA } from "./weighing.types";

// Reexportado para quem importa a conferência junto da importação.
export { conferirLoteDeGtas };

// Mesmo esquema de ./gtaService: caminho relativo no web, absoluto no app.
const URL_EXTRACAO =
  Platform.OS === "web"
    ? "/api/gta-texto"
    : "https://confi-gilt.vercel.app/api/gta-texto";

/** Limite da function; acima disso o lote é enviado em partes. */
const PDFS_POR_REQUISICAO = 20;

export interface GtaImportada {
  arquivo: string;
  gta?: Partial<GTA>;
  /** PDF original em base64, para arquivar junto do processo. */
  pdfBase64?: string;
  erro?: string;
}

// ─── Conversões ───────────────────────────────────────────────────────────────

function bytesParaBase64(bytes: Uint8Array): string {
  let binario = "";
  // Em blocos: `String.fromCharCode(...bytes)` estoura a pilha em PDFs grandes.
  const BLOCO = 0x8000;
  for (let i = 0; i < bytes.length; i += BLOCO) {
    binario += String.fromCharCode(...bytes.subarray(i, i + BLOCO));
  }
  return typeof btoa === "function" ? btoa(binario) : Buffer.from(bytes).toString("base64");
}

// ─── Extração do texto ────────────────────────────────────────────────────────

async function extrairNoServidor(base64s: string[]): Promise<(string | null)[]> {
  const textos: (string | null)[] = [];

  for (let i = 0; i < base64s.length; i += PDFS_POR_REQUISICAO) {
    const parte = base64s.slice(i, i + PDFS_POR_REQUISICAO);
    const res = await fetch(URL_EXTRACAO, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pdfs: parte }),
    });
    if (!res.ok) throw new Error(`Servidor respondeu ${res.status}`);

    const { resultados } = (await res.json()) as {
      resultados: { indice: number; texto?: string; erro?: string }[];
    };
    for (let j = 0; j < parte.length; j++) {
      textos.push(resultados.find((r) => r.indice === j)?.texto ?? null);
    }
  }

  return textos;
}

async function extrairNoNavegador(bytes: Uint8Array): Promise<string | null> {
  try {
    const { extrairTextoDoPdf } = await import("./gtaPdfParser.web");
    const copia = new Uint8Array(bytes);
    const texto = await extrairTextoDoPdf(copia.buffer as ArrayBuffer);
    return texto || null;
  } catch {
    return null;
  }
}

// ─── Importação ───────────────────────────────────────────────────────────────

export interface ArquivoPdf {
  nome: string;
  bytes: Uint8Array;
}

/**
 * Lê um lote de PDFs de GTA e devolve os dados já estruturados.
 *
 * Importar as guias de um embarque de uma vez é o caso comum: um lote de 60
 * animais costuma vir em três guias, e conferir guia por guia é onde entra
 * erro de digitação.
 */
export async function importarGtas(arquivos: ArquivoPdf[]): Promise<GtaImportada[]> {
  if (arquivos.length === 0) return [];

  const base64s = arquivos.map((a) => bytesParaBase64(a.bytes));
  const textos: (string | null)[] = new Array(arquivos.length).fill(null);

  // No navegador, tenta local primeiro: é instantâneo e funciona sem rede.
  if (Platform.OS === "web") {
    await Promise.all(
      arquivos.map(async (a, i) => {
        textos[i] = await extrairNoNavegador(a.bytes);
      })
    );
  }

  const pendentes = textos
    .map((t, i) => (t === null ? i : -1))
    .filter((i) => i >= 0);

  if (pendentes.length > 0) {
    try {
      const doServidor = await extrairNoServidor(pendentes.map((i) => base64s[i]));
      pendentes.forEach((indice, k) => {
        textos[indice] = doServidor[k];
      });
    } catch (e) {
      console.warn("[GTA] extração no servidor falhou:", e);
    }
  }

  return arquivos.map((arquivo, i) => {
    const texto = textos[i];
    if (!texto) {
      return {
        arquivo: arquivo.nome,
        erro: "Não foi possível ler o texto deste PDF",
        pdfBase64: base64s[i],
      };
    }

    const gta = parseGtaText(texto);
    if (!gta.numero) {
      return {
        arquivo: arquivo.nome,
        gta,
        pdfBase64: base64s[i],
        erro: "PDF lido, mas o número da GTA não foi encontrado — confira os campos",
      };
    }
    return { arquivo: arquivo.nome, gta, pdfBase64: base64s[i] };
  });
}
