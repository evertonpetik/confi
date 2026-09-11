/**
 * Verifica a extração de texto de PDF da Cloud Function `extrairTextoGta`.
 *
 * Monta um PDF com stream FlateDecode contendo os operadores de texto na mesma
 * forma que a e-GTA do IAGRO, e confere que o texto extraído volta íntegro —
 * inclusive acentos e parênteses escapados, que são onde a extração costuma
 * corromper o conteúdo.
 *
 * Rodar:  node scripts/verificar-extracao-pdf.js
 */
const zlib = require("zlib");

let falhas = 0;
function checar(nome, obtido, esperado) {
  const ok = String(obtido) === String(esperado);
  if (!ok) falhas++;
  console.log(`  ${ok ? "ok  " : "FALHA"}  ${nome}${ok ? "" : `\n         obtido:   ${obtido}\n         esperado: ${esperado}`}`);
}

// Reaproveita a implementação real da function
const mod = require("../functions/index.js");
// extrairTextoPdf não é exportada; recarrega o arquivo isolando a função
const fs = require("fs");
const fonte = fs.readFileSync("functions/index.js", "utf8");
const inicio = fonte.indexOf("function inflatePdfStream");
const fim = fonte.indexOf("exports.extrairTextoGta");
const extrairTextoPdf = new Function(
  "zlib",
  `${fonte.slice(inicio, fim)}; return extrairTextoPdf;`
)(zlib);

/** Monta um PDF de uma página com o texto dado, comprimido em FlateDecode. */
function montarPdf(linhas) {
  const content =
    "BT /F1 10 Tf\n" +
    linhas.map((l) => `(${l.replace(/[()\\]/g, (c) => "\\" + c)}) Tj`).join("\n") +
    "\nET";
  const comprimido = zlib.deflateSync(Buffer.from(content, "latin1"));

  const partes = [
    Buffer.from("%PDF-1.4\n", "latin1"),
    Buffer.from(`4 0 obj\n<< /Length ${comprimido.length} /Filter /FlateDecode >>\nstream\n`, "latin1"),
    comprimido,
    Buffer.from("\nendstream\nendobj\n%%EOF\n", "latin1"),
  ];
  return Buffer.concat(partes);
}

console.log("\n1. Texto simples volta íntegro");
const simples = extrairTextoPdf(montarPdf(["ANIMAIS QUANTIDADE", "BOVINO MACHO 13 A 24 MESES", "20"]));
checar("linhas concatenadas na ordem", simples, "ANIMAIS QUANTIDADE BOVINO MACHO 13 A 24 MESES 20");

console.log("\n2. Campos reais da e-GTA IAGRO, com acentos");
const gta = extrairTextoPdf(
  montarPdf([
    "Guia de Trânsito Animal (e-GTA)",
    "UF",
    "MS",
    "Número",
    "596411",
    "Série",
    "Q",
    "PROCEDÊNCIA",
    "Nome: JORGE VEIMAR SAYD PINTO",
    "Estabelecimento: FAZENDA FORMOSA",
  ])
);
checar("parênteses escapados preservados", gta.includes("(e-GTA)"), true);
checar("acentos preservados", gta.includes("PROCEDÊNCIA") && gta.includes("Trânsito"), true);
checar("número da GTA presente", gta.includes("596411"), true);

console.log("\n3. O texto extraído alimenta o parser de campos");
// Confere que o formato de saída é o que parseGtaText espera (uma linha só,
// espaços normalizados) — é o contrato entre a function e o cliente.
checar("sem quebras de linha internas", /\n/.test(gta), false);
checar("sem espaços duplicados", /  /.test(gta), false);

console.log("\n4. PDF sem stream comprimido não quebra");
checar("retorna vazio em vez de lançar", extrairTextoPdf(Buffer.from("%PDF-1.4\nsem streams\n%%EOF")), "");

console.log("\n5. A function está exportada");
checar("extrairTextoGta exportada", typeof mod.extrairTextoGta, "function");

console.log(
  falhas === 0
    ? "\nTodas as verificações passaram.\n"
    : `\n${falhas} verificação(ões) falharam.\n`
);
process.exit(falhas === 0 ? 0 : 1);
