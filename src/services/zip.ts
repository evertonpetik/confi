/**
 * Escritor de ZIP mínimo, sem dependências.
 *
 * Grava no modo "store" (sem compressão): o formato ZIP permite, e isso evita
 * puxar uma biblioteca de deflate só para empacotar arquivos. Serve para dois
 * usos: montar o .xlsx (que é um ZIP de XMLs) e o pacote que vai à
 * certificadora (planilha + PDFs das GTAs).
 *
 * Só manipulação de bytes, então roda igual no navegador e no React Native.
 */

export interface ArquivoZip {
  /** Caminho dentro do zip, com "/" como separador. */
  nome: string;
  conteudo: Uint8Array;
}

// ─── CRC-32 ───────────────────────────────────────────────────────────────────

const TABELA_CRC = (() => {
  const tabela = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabela[i] = c >>> 0;
  }
  return tabela;
})();

function crc32(dados: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < dados.length; i++) {
    crc = TABELA_CRC[(crc ^ dados[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ─── Escrita ──────────────────────────────────────────────────────────────────

export function textoParaBytes(texto: string): Uint8Array {
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(texto);
  // Fallback UTF-8 manual para ambientes sem TextEncoder
  const bytes: number[] = [];
  for (const ch of texto) {
    const cp = ch.codePointAt(0)!;
    if (cp < 0x80) bytes.push(cp);
    else if (cp < 0x800) bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    else if (cp < 0x10000) bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    else bytes.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
  }
  return new Uint8Array(bytes);
}

/** Converte data para o formato MS-DOS usado nos cabeçalhos do ZIP. */
function dataDos(d: Date): { hora: number; data: number } {
  return {
    hora: (d.getHours() << 11) | (d.getMinutes() << 5) | (Math.floor(d.getSeconds() / 2) & 0x1f),
    // O ano do ZIP conta a partir de 1980; datas anteriores não são representáveis.
    data: ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

class Buffer16 {
  private partes: Uint8Array[] = [];
  private _tamanho = 0;

  get tamanho() {
    return this._tamanho;
  }

  push(bytes: Uint8Array) {
    this.partes.push(bytes);
    this._tamanho += bytes.length;
  }

  u16(v: number) {
    this.push(new Uint8Array([v & 0xff, (v >> 8) & 0xff]));
  }

  u32(v: number) {
    this.push(new Uint8Array([v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff]));
  }

  concluir(): Uint8Array {
    const saida = new Uint8Array(this._tamanho);
    let pos = 0;
    for (const parte of this.partes) {
      saida.set(parte, pos);
      pos += parte.length;
    }
    return saida;
  }
}

/** Monta o ZIP com os arquivos dados. */
export function criarZip(arquivos: ArquivoZip[], quando = new Date()): Uint8Array {
  const { hora, data } = dataDos(quando);
  const corpo = new Buffer16();
  const diretorio = new Buffer16();

  for (const arquivo of arquivos) {
    const nome = textoParaBytes(arquivo.nome);
    const crc = crc32(arquivo.conteudo);
    const offset = corpo.tamanho;

    // Local file header
    corpo.u32(0x04034b50);
    corpo.u16(20); // versão mínima
    corpo.u16(0x0800); // nomes em UTF-8
    corpo.u16(0); // método 0 = store
    corpo.u16(hora);
    corpo.u16(data);
    corpo.u32(crc);
    corpo.u32(arquivo.conteudo.length);
    corpo.u32(arquivo.conteudo.length);
    corpo.u16(nome.length);
    corpo.u16(0);
    corpo.push(nome);
    corpo.push(arquivo.conteudo);

    // Central directory header
    diretorio.u32(0x02014b50);
    diretorio.u16(20); // versão de criação
    diretorio.u16(20);
    diretorio.u16(0x0800);
    diretorio.u16(0);
    diretorio.u16(hora);
    diretorio.u16(data);
    diretorio.u32(crc);
    diretorio.u32(arquivo.conteudo.length);
    diretorio.u32(arquivo.conteudo.length);
    diretorio.u16(nome.length);
    diretorio.u16(0);
    diretorio.u16(0);
    diretorio.u16(0);
    diretorio.u16(0);
    diretorio.u32(0);
    diretorio.u32(offset);
    diretorio.push(nome);
  }

  const inicioDiretorio = corpo.tamanho;
  const bytesDiretorio = diretorio.concluir();

  const fim = new Buffer16();
  fim.u32(0x06054b50);
  fim.u16(0);
  fim.u16(0);
  fim.u16(arquivos.length);
  fim.u16(arquivos.length);
  fim.u32(bytesDiretorio.length);
  fim.u32(inicioDiretorio);
  fim.u16(0);

  const bytesCorpo = corpo.concluir();
  const bytesFim = fim.concluir();

  const total = new Uint8Array(bytesCorpo.length + bytesDiretorio.length + bytesFim.length);
  total.set(bytesCorpo, 0);
  total.set(bytesDiretorio, bytesCorpo.length);
  total.set(bytesFim, bytesCorpo.length + bytesDiretorio.length);
  return total;
}

// ─── Base64 ───────────────────────────────────────────────────────────────────

const ALFABETO_B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function bytesParaBase64(bytes: Uint8Array): string {
  let saida = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    saida += ALFABETO_B64[a >> 2];
    saida += ALFABETO_B64[((a & 3) << 4) | ((b ?? 0) >> 4)];
    saida += b === undefined ? "=" : ALFABETO_B64[((b & 15) << 2) | ((c ?? 0) >> 6)];
    saida += c === undefined ? "=" : ALFABETO_B64[c & 63];
  }
  return saida;
}

export function base64ParaBytes(base64: string): Uint8Array {
  const limpo = base64.replace(/[^A-Za-z0-9+/]/g, "");
  const tamanho = Math.floor((limpo.length * 3) / 4);
  const bytes = new Uint8Array(tamanho);
  let pos = 0;

  for (let i = 0; i < limpo.length; i += 4) {
    const n =
      (ALFABETO_B64.indexOf(limpo[i]) << 18) |
      (ALFABETO_B64.indexOf(limpo[i + 1]) << 12) |
      ((limpo[i + 2] ? ALFABETO_B64.indexOf(limpo[i + 2]) : 0) << 6) |
      (limpo[i + 3] ? ALFABETO_B64.indexOf(limpo[i + 3]) : 0);

    if (pos < tamanho) bytes[pos++] = (n >> 16) & 0xff;
    if (pos < tamanho) bytes[pos++] = (n >> 8) & 0xff;
    if (pos < tamanho) bytes[pos++] = n & 0xff;
  }
  return bytes;
}
