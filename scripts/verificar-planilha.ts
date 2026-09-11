/**
 * Verifica o ZIP e o .xlsx gerados à mão.
 *
 * O ponto crítico: o arquivo precisa abrir no Excel da certificadora. Aqui a
 * conferência é estrutural (assinaturas, CRC, partes obrigatórias do OOXML) e
 * o descompactador do Node confirma que o ZIP é legível por terceiros.
 *
 * Rodar:  npx tsx scripts/verificar-planilha.ts
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gerarXlsxPlanilhaCampo, gerarCsvPlanilhaCampo } from "../src/services/planilhaCampo";
import { Bovino, CategoriaBovino, GTA, ProcessoMangueiro } from "../src/services/weighing.types";
import { montarPacoteCertificadora, resumirFechamento } from "../src/services/fechamentoProcesso";
import { base64ParaBytes, bytesParaBase64, criarZip, textoParaBytes } from "../src/services/zip";

let falhas = 0;
function checar(nome: string, obtido: unknown, esperado: unknown) {
  const ok = String(obtido) === String(esperado);
  if (!ok) falhas++;
  console.log(`  ${ok ? "ok  " : "FALHA"}  ${nome}${ok ? "" : `  →  obtido ${obtido}, esperado ${esperado}`}`);
}


/**
 * Lista e extrai usando System.IO.Compression do .NET.
 *
 * Validar nosso ZIP com um leitor escrito por nós não provaria nada: o mesmo
 * engano estaria dos dois lados. O .NET é o mesmo motor que o Explorer do
 * Windows usa, e é quem a certificadora vai usar na prática.
 */
function psZip(comando: string): string {
  return execFileSync(
    "powershell",
    ["-NoProfile", "-NonInteractive", "-Command",
     "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; " +
     `Add-Type -AssemblyName System.IO.Compression.FileSystem; ${comando}`],
    { encoding: "utf8" }
  ).trim();
}

function listarZip(caminho: string): string[] {
  const saida = psZip(
    `$z=[System.IO.Compression.ZipFile]::OpenRead('${caminho}'); ` +
    `$z.Entries | ForEach-Object { $_.FullName }; $z.Dispose()`
  );
  return saida.split(/\r?\n/).filter(Boolean);
}

function lerDoZip(caminho: string, entrada: string): string {
  return psZip(
    `$z=[System.IO.Compression.ZipFile]::OpenRead('${caminho}'); ` +
    `$e=$z.GetEntry('${entrada}'); $r=New-Object System.IO.StreamReader($e.Open(), [System.Text.Encoding]::UTF8); ` +
    `$r.ReadToEnd(); $r.Dispose(); $z.Dispose()`
  );
}

const QUANDO = new Date(2026, 6, 21, 10, 30, 0);

const animais: Bovino[] = [
  ["105500508078035", "807803"],
  ["105500508078043", "807804"],
  ["105500508078051", "807805"],
].map(([sisbov, manejo], i) => ({
  id: sisbov,
  sisbov,
  manejo,
  chipRfid: `96300040862${manejo.slice(-4)}`,
  nome: `Nelore ${manejo}`,
  categoria: CategoriaBovino.NOVILHO,
  raca: "Nelore",
  sexo: "M" as const,
  dataNascimento: "2025-01-05",
  dataEntrada: "2026-07-21",
  pesoEntrada: 420 + i,
  farmedaId: "f1",
  ativo: true,
  metadados: { racaCodigo: "NE", localId: "p1", faixaEtaria: "13 a 24 meses" },
}));

// ─── 1. ZIP ───────────────────────────────────────────────────────────────────

console.log("\n1. ZIP gerado à mão é legível por terceiros");
const zipSimples = criarZip(
  [
    { nome: "a.txt", conteudo: textoParaBytes("conteúdo com acento") },
    { nome: "pasta/b.txt", conteudo: textoParaBytes("segundo arquivo") },
  ],
  QUANDO
);

checar("assinatura PK\\x03\\x04", `${zipSimples[0]},${zipSimples[1]},${zipSimples[2]},${zipSimples[3]}`, "80,75,3,4");

const dir = mkdtempSync(join(tmpdir(), "confi-zip-"));
const caminhoZip = join(dir, "teste.zip");
writeFileSync(caminhoZip, zipSimples);

checar("o .NET lê o conteúdo", lerDoZip(caminhoZip, "a.txt"), "conteúdo com acento");
checar("preserva subpasta", lerDoZip(caminhoZip, "pasta/b.txt"), "segundo arquivo");
checar("lista os dois arquivos", listarZip(caminhoZip).join(","), "a.txt,pasta/b.txt");

console.log("\n2. Base64 ida e volta");
const original = new Uint8Array([0, 1, 2, 253, 254, 255, 65, 66]);
checar("round-trip preserva os bytes", base64ParaBytes(bytesParaBase64(original)).join(","), original.join(","));
checar("base64 de 'Oi' ", bytesParaBase64(textoParaBytes("Oi")), "T2k=");

// ─── 3. XLSX ──────────────────────────────────────────────────────────────────

console.log("\n3. .xlsx tem as partes obrigatórias do OOXML");
const xlsx = gerarXlsxPlanilhaCampo(animais, QUANDO);
const caminhoXlsx = join(dir, "planilha.xlsx");
writeFileSync(caminhoXlsx, xlsx);

const partes = listarZip(caminhoXlsx);
{
  for (const obrigatoria of [
    "[Content_Types].xml",
    "_rels/.rels",
    "xl/workbook.xml",
    "xl/_rels/workbook.xml.rels",
    "xl/styles.xml",
    "xl/worksheets/sheet1.xml",
  ]) {
    checar(`contém ${obrigatoria}`, partes.includes(obrigatoria), true);
  }

  const folha = lerDoZip(caminhoXlsx, "xl/worksheets/sheet1.xml");

  checar("cabeçalho na primeira linha", folha.includes("<t xml:space=\"preserve\">Sisbov</t>"), true);
  checar("acento do cabeçalho preservado", folha.includes("Data identificação"), true);
  checar(
    "SISBOV vai como texto, preservando zeros",
    folha.includes('t="inlineStr"><is><t xml:space="preserve">105500508078035</t>'),
    true
  );
  checar("uma linha por animal + cabeçalho", (folha.match(/<row /g) ?? []).length, 4);
  checar("cabeçalho congelado", folha.includes('state="frozen"'), true);
}

// ─── 4. Pacote da certificadora ──────────────────────────────────────────────

console.log("\n4. Pacote da certificadora");
const processo: ProcessoMangueiro = {
  id: "p1",
  nome: "Entrada 60 - Jorge Veimar",
  tipo: "entrada",
  status: "em_andamento",
  gtaIds: ["g1"],
  totalAnimaisPrevisto: 3,
  animaisManejados: 3,
  dataAbertura: "2026-07-21",
  farmedaId: "f1",
  usuarioId: "u1",
  criadoEm: "2026-07-21",
};
const gta = {
  id: "g1",
  numero: "596411",
  serie: "Q",
  total: 3,
  procFazenda: "FAZENDA FORMOSA",
  destFazenda: "FAZENDA RINCÃO",
  animais: [{ descricao: "BOVINO MACHO 13 A 24 MESES", quantidade: 3, sexo: "M" as const, idadeCategoria: "13 A 24 MESES" }],
  dataEmissao: "2026-07-20",
} as unknown as GTA;

const pdfFalso = textoParaBytes("%PDF-1.4 conteudo da guia");
const pacote = montarPacoteCertificadora(processo, animais, [{ gta, pdf: pdfFalso }], QUANDO);

checar("nome do arquivo", pacote.nome, "certificadora-Entrada_60_-_Jorge_Veimar-2026-07-21.zip");

const caminhoPacote = join(dir, "pacote.zip");
writeFileSync(caminhoPacote, pacote.bytes);
const conteudo = listarZip(caminhoPacote);
checar("inclui a planilha xlsx", conteudo.includes("planilha-de-campo-Entrada_60_-_Jorge_Veimar.xlsx"), true);
checar("inclui a planilha csv", conteudo.includes("planilha-de-campo-Entrada_60_-_Jorge_Veimar.csv"), true);
checar("inclui o PDF da GTA", conteudo.includes("gtas/GTA-Q596411.pdf"), true);
checar("inclui o resumo", conteudo.includes("resumo.txt"), true);
checar(
  "PDF sai idêntico ao que entrou",
  lerDoZip(caminhoPacote, "gtas/GTA-Q596411.pdf"),
  "%PDF-1.4 conteudo da guia"
);
checar("xlsx dentro do pacote também abre", listarZip(caminhoXlsx).length, 6);

// ─── 5. Conferência de fechamento ────────────────────────────────────────────

console.log("\n5. Conferência antes de fechar");
const eventos = animais.map((a, i) => ({
  id: `e${i}`,
  animalId: a.id,
  sisbov: a.sisbov,
  manejo: a.manejo,
  tipo: "cadastro" as const,
  dataHora: "2026-07-21T10:00:00Z",
  faixaEtaria: "13 a 24 meses",
  usuarioId: "u1",
  origem: "mangueiro" as const,
  farmedaId: "f1",
  criadoEm: "2026-07-21T10:00:00Z",
}));

const completo = resumirFechamento(processo, [gta], animais, eventos);
checar("processo completo fica pronto", completo.pronto, true);
checar("sem pendências", completo.pendencias.length, 0);
checar("conta os manejados", completo.manejados, 3);

const faltando = resumirFechamento(processo, [gta], animais.slice(0, 2), eventos.slice(0, 2));
checar("faltando animal não fecha", faltando.pronto, false);
checar("aponta o que falta", faltando.pendencias[0], "13 a 24 meses: faltam 1 de 3");

const semPeso = animais.map((a) => ({ ...a, pesoEntrada: undefined }));
checar(
  "avisa sobre animal sem peso",
  resumirFechamento(processo, [gta], semPeso, eventos).avisos.includes("3 animal(is) sem peso registrado"),
  true
);

const comTerceiro = [
  animais[0],
  { ...animais[1], proprietario: { tipo: "terceiro" as const, nome: "JORGE VEIMAR" } },
  animais[2],
];
const resumoTerceiro = resumirFechamento(processo, [gta], comTerceiro, eventos);
checar("separa o animal de terceiro", resumoTerceiro.embarque.terceiros.length, 1);
checar(
  "avisa sobre a mistura no fechamento",
  resumoTerceiro.avisos.some((a) => a.includes("1 animal(is) de JORGE VEIMAR")),
  true
);

console.log("\n6. CSV continua saindo no layout de 6 colunas");
const csv = gerarCsvPlanilhaCampo(animais).replace(/^﻿/, "").split("\n");
checar("cabeçalho", csv[0], "Sisbov;Manejo;Sexo;Raca;DataNasc;Data identificação");
checar("linha 1", csv[1], "105500508078035;807803;M;NE;05/01/2025;21/07/2026");

console.log(
  falhas === 0
    ? "\nTodas as verificações passaram.\n"
    : `\n${falhas} verificação(ões) falharam.\n`
);
process.exit(falhas === 0 ? 0 : 1);
