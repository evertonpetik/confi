/**
 * Verificação do parser de e-GTA contra o texto das GTAs reais
 * série Q nº 596380, 596396 e 596411 (IAGRO/MS, emitidas em 20/07/2026).
 *
 * O texto abaixo reproduz a ordem em que os campos saem do content stream do
 * PDF — que não corresponde à ordem visual da página.
 *
 * Rodar:  npx tsx scripts/verificar-gta.ts
 */
import { conferirProcesso, faixasDoProcesso, saldoDasFaixas } from "../src/services/faixasProcesso";

import { conferirLoteDeGtas, parseGtaText } from "../src/services/gtaParser";
import { dataNascimentoPorFaixa, parseFaixaEtaria } from "../src/services/sisbov";
import { GTA } from "../src/services/weighing.types";

let falhas = 0;

function checar(nome: string, obtido: unknown, esperado: unknown) {
  const ok = String(obtido) === String(esperado);
  if (!ok) falhas++;
  console.log(`  ${ok ? "ok  " : "FALHA"}  ${nome}${ok ? "" : `  →  obtido "${obtido}", esperado "${esperado}"`}`);
}

const cabecalho = (numero: string, grupos: string) => `Ministério da Agricultura, Pecuária e Abastecimento Secretaria de Defesa Agropecuária Departamento de Saúde Animal ANIMAIS QUANTIDADE ${grupos} FINALIDADE: ENGORDA MEIO DE TRANSPORTE: RODOVIÁRIO DESTINO CPF/CNPJ: 80398987149 Região:PLANALTO Nome: RENATO FELIPE PINHEIRO MARTINS Estabelecimento: FAZENDA RINCÃO - GLEBA A / B Código MAPA: 500001918750001 Insc. Estadual: 288599276 Municipio: 5007406 - RIO VERDE DE MATO GROSSO UF: MS Guia de Trânsito Animal (e-GTA) (Válida em todo o Território Nacional) UF MS Número ${numero} Série Q PROCEDÊNCIA CPF/CNPJ: 00575410191 Região: PLANALTO Nome: JORGE VEIMAR SAYD PINTO Estabelecimento: FAZENDA FORMOSA Código MAPA:500000139360001 Insc.Estadual: 285722930 Municipio: 5007307 - RIO NEGRO UF: MS Macho 20 Total 20 Fêmea 0 Total por Extenso VINTE ANIMAIS ROTA rio negro-rio verde EMISSÃO Data: 20/07/2026 16:27:25 Validade: 23/07/2026 Unidade Expedidora: ESCRITÓRIO LOCAL DE RIO NEGRO`;

const GTAS = [
  { nome: "Q-596380", numero: "596380", grupos: "BOVINO MACHO 25 A 36 MESES 20", esperado: [["25 A 36 MESES", 20]] },
  { nome: "Q-596396", numero: "596396", grupos: "BOVINO MACHO 13 A 24 MESES 20", esperado: [["13 A 24 MESES", 20]] },
  {
    nome: "Q-596411",
    numero: "596411",
    grupos: "BOVINO MACHO 13 A 24 MESES 13 BOVINO MACHO 25 A 36 MESES 7",
    esperado: [["13 A 24 MESES", 13], ["25 A 36 MESES", 7]],
  },
] as const;

const faixasAcumuladas = new Map<string, number>();

for (const gta of GTAS) {
  console.log(`\n${gta.nome}`);
  const r = parseGtaText(cabecalho(gta.numero, gta.grupos));

  checar("número", r.numero, gta.numero);
  checar("série", r.serie, "Q");
  checar("procedência", r.procNome, "JORGE VEIMAR SAYD PINTO");
  checar("fazenda de origem", r.procFazenda, "FAZENDA FORMOSA");
  checar("código MAPA origem", r.procCodigoMapa, "500000139360001");
  checar("destino", r.destNome, "RENATO FELIPE PINHEIRO MARTINS");
  checar("data de emissão", r.dataEmissao, "2026-07-20");
  checar("total de animais", r.total, 20);

  checar("grupos de animais extraídos", r.animais?.length, gta.esperado.length);
  const soma = (r.animais ?? []).reduce((s, a) => s + a.quantidade, 0);
  checar("soma das quantidades dos grupos", soma, 20);

  for (const [faixaEsperada, qtdEsperada] of gta.esperado) {
    const achado = (r.animais ?? []).find((a) => a.descricao.includes(faixaEsperada));
    checar(`grupo "${faixaEsperada}" = ${qtdEsperada}`, achado?.quantidade, qtdEsperada);
    if (achado) {
      const faixa = parseFaixaEtaria(achado.descricao);
      checar(`  faixa reconhecida`, faixa !== null, true);
      if (faixa) {
        faixasAcumuladas.set(faixa.label, (faixasAcumuladas.get(faixa.label) ?? 0) + achado.quantidade);
      }
    }
  }
}

console.log("\nFaixas consolidadas do processo (3 GTAs) e data de nascimento estimada");
for (const [label, qtd] of faixasAcumuladas) {
  const faixa = parseFaixaEtaria(label)!;
  console.log(`  ${label.padEnd(16)} ${String(qtd).padStart(3)} animais   nasc. ${dataNascimentoPorFaixa(faixa, "2026-07-20")}`);
}
const totalProcesso = [...faixasAcumuladas.values()].reduce((s, q) => s + q, 0);
checar("total do processo (3 GTAs)", totalProcesso, 60);

// ─── Faixas como o mangueiro as apresenta ───────────────────────────────────

console.log("\nBotões de faixa no mangueiro");
const gtasDoProcesso: GTA[] = GTAS.map((g, i) => ({
  ...(parseGtaText(cabecalho(g.numero, g.grupos)) as GTA),
  id: `gta-${i}`,
  dataEmissao: "2026-07-20",
}));
const faixas = faixasDoProcesso(gtasDoProcesso);

checar("duas faixas distintas no processo", faixas.length, 2);
checar("mais novos primeiro", faixas.map((f) => f.label).join(" | "), "13 a 24 meses | 25 a 36 meses");
checar("13 a 24 meses soma 20 + 13", faixas[0].previsto, 33);
checar("25 a 36 meses soma 20 + 7", faixas[1].previsto, 27);
checar("faixa 13-24 cita as 2 GTAs de origem", faixas[0].gtaIds.length, 2);
checar("nascimento da faixa 13-24", faixas[0].dataNascimento, "2025-01-05");
checar("nascimento da faixa 25-36", faixas[1].dataNascimento, "2024-01-05");

console.log("\nConferência contra a GTA durante o manejo");
const parcial = saldoDasFaixas(faixas, { "13 a 24 meses": 33, "25 a 36 meses": 12 });
checar("faixa esgotada trava", parcial[0].completa, true);
checar("faixa em andamento mostra o que falta", parcial[1].restam, 15);

const meio = conferirProcesso(faixas, { "13 a 24 meses": 33, "25 a 36 meses": 12 });
checar("processo incompleto não fecha", meio.ok, false);
checar("aponta a pendência", meio.pendencias[0], "25 a 36 meses: faltam 15 de 27");

const completo = conferirProcesso(faixas, { "13 a 24 meses": 33, "25 a 36 meses": 27 });
checar("processo completo fecha", completo.ok, true);
checar("total manejado bate com as GTAs", completo.manejados, 60);

const excedido = conferirProcesso(faixas, { "13 a 24 meses": 35, "25 a 36 meses": 27 });
checar("excesso é acusado", excedido.pendencias[0], "13 a 24 meses: 2 a mais que o declarado na GTA");

console.log("\nConferência do lote de GTAs importadas");
checar("lote coerente não gera aviso", conferirLoteDeGtas(gtasDoProcesso).length, 0);

const comOrigemTrocada = [
  gtasDoProcesso[0],
  { ...gtasDoProcesso[1], procCodigoMapa: "500009999990001" },
];
checar(
  "PDF de outra origem no lote é acusado",
  conferirLoteDeGtas(comOrigemTrocada)[0]?.startsWith("GTAs com origens diferentes"),
  true
);

const comRepetida = [gtasDoProcesso[0], { ...gtasDoProcesso[0] }];
checar("GTA repetida é acusada", conferirLoteDeGtas(comRepetida).includes("GTA repetida no lote: Q596380"), true);

console.log(
  falhas === 0
    ? "\nTodas as verificações passaram.\n"
    : `\n${falhas} verificação(ões) falharam.\n`
);
process.exit(falhas === 0 ? 0 : 1);
