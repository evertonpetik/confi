/**
 * Verificação das regras de numeração SISBOV contra dados reais.
 *
 * Fonte dos dados: planilha de campo do lote 807803–807862 (60 animais,
 * pedido Animalltag) e as 3 GTAs série Q nº 596380 / 596396 / 596411.
 *
 * Rodar:  npx tsx scripts/verificar-sisbov.ts
 */
import {
  conferirEmbarque,
  filtrarPorProprietario,
  mensagemConfirmacaoEmbarque,
  nomeProprietario,
} from "../src/services/embarque";
import { semEstornados } from "../src/services/eventoUtils";
import { gerarCsvPlanilhaCampo } from "../src/services/planilhaCampo";
import {
  aplicacoesDosProtocolos,
  carenciaAtiva,
  eventoSanitarioDaAplicacao,
} from "../src/services/protocoloUtils";
import {
  chipConfereComManejo,
  dataNascimentoPorFaixa,
  dvSisbov,
  manejoFromSisbov,
  parseFaixaEtaria,
  sisbovByIndex,
  totalSisbov,
  validarSisbov,
} from "../src/services/sisbov";
import { Bovino, CategoriaBovino, Evento, ProtocoloSanitario } from "../src/services/weighing.types";

let falhas = 0;

function checar(nome: string, obtido: unknown, esperado: unknown) {
  const ok = String(obtido) === String(esperado);
  if (!ok) falhas++;
  console.log(`  ${ok ? "ok  " : "FALHA"}  ${nome}${ok ? "" : `  →  obtido ${obtido}, esperado ${esperado}`}`);
}

// ─── Amostra real: coluna Sisbov da planilha de campo ────────────────────────

const PLANILHA: [string, string][] = [
  ["105500508078035", "807803"], ["105500508078043", "807804"],
  ["105500508078051", "807805"], ["105500508078060", "807806"],
  ["105500508078078", "807807"], ["105500508078086", "807808"],
  ["105500508078094", "807809"], ["105500508078108", "807810"],
  ["105500508078116", "807811"], ["105500508078124", "807812"],
  ["105500508078132", "807813"], ["105500508078140", "807814"],
  ["105500508078159", "807815"], ["105500508078167", "807816"],
  ["105500508078175", "807817"], ["105500508078183", "807818"],
  ["105500508078191", "807819"], ["105500508078205", "807820"],
  ["105500508078213", "807821"], ["105500508078221", "807822"],
  ["105500508078230", "807823"], ["105500508078248", "807824"],
  ["105500508078256", "807825"], ["105500508078264", "807826"],
  ["105500508078272", "807827"], ["105500508078280", "807828"],
  ["105500508078299", "807829"], ["105500508078302", "807830"],
  ["105500508078310", "807831"], ["105500508078329", "807832"],
  ["105500508078337", "807833"], ["105500508078345", "807834"],
  ["105500508078353", "807835"], ["105500508078361", "807836"],
  ["105500508078370", "807837"], ["105500508078388", "807838"],
  ["105500508078396", "807839"], ["105500508078400", "807840"],
  ["105500508078418", "807841"], ["105500508078426", "807842"],
  ["105500508078434", "807843"], ["105500508078442", "807844"],
  ["105500508078450", "807845"], ["105500508078469", "807846"],
  ["105500508078477", "807847"], ["105500508078485", "807848"],
  ["105500508078493", "807849"], ["105500508078507", "807850"],
  ["105500508078515", "807851"], ["105500508078523", "807852"],
  ["105500508078531", "807853"], ["105500508078540", "807854"],
  ["105500508078558", "807855"], ["105500508078566", "807856"],
  ["105500508078574", "807857"], ["105500508078582", "807858"],
  ["105500508078590", "807859"], ["105500508078604", "807860"],
  ["105500508078612", "807861"], ["105500508078620", "807862"],
];

console.log("\n1. Dígito verificador e número de manejo (60 registros da planilha)");
let dvOk = 0;
let manejoOk = 0;
for (const [sisbov, manejo] of PLANILHA) {
  if (validarSisbov(sisbov)) dvOk++;
  if (manejoFromSisbov(sisbov) === manejo) manejoOk++;
}
checar(`DV válido em ${dvOk}/${PLANILHA.length}`, dvOk, PLANILHA.length);
checar(`manejo correto em ${manejoOk}/${PLANILHA.length}`, manejoOk, PLANILHA.length);

console.log("\n2. Sequência a partir do brinco inicial do pedido");
const inicial = PLANILHA[0][0];
let seqOk = 0;
for (let i = 0; i < PLANILHA.length; i++) {
  if (sisbovByIndex(inicial, i) === PLANILHA[i][0]) seqOk++;
}
checar(`sisbovByIndex reproduz ${seqOk}/${PLANILHA.length} da planilha`, seqOk, PLANILHA.length);

console.log("\n3. Total de brincos do pedido");
checar("totalSisbov(807803 … 807862)", totalSisbov(inicial, PLANILHA[PLANILHA.length - 1][0]), 60);

console.log("\n4. Exemplo informado separadamente (SISBOV / brinco / chip)");
checar("validarSisbov(105500508091406)", validarSisbov("105500508091406"), true);
checar("manejo de 105500508091406", manejoFromSisbov("105500508091406"), "809140");
checar("chip 963000408629140 confere com manejo 809140", chipConfereComManejo("963000408629140", "809140"), true);
checar("chip de outro animal é rejeitado", chipConfereComManejo("963000408627815", "809140"), false);

console.log("\n5. DV rejeita número adulterado");
checar("105500508078036 (DV trocado) é inválido", validarSisbov("105500508078036"), false);
checar("dvSisbov('10550050807803')", dvSisbov("10550050807803"), 5);

console.log("\n6. Faixa etária das GTAs → data de nascimento (ponto médio)");
// GTA Q-596380 emitida em 20/07/2026
const faixa1 = parseFaixaEtaria("BOVINO MACHO 13 A 24 MESES")!;
const faixa2 = parseFaixaEtaria("BOVINO MACHO 25 A 36 MESES")!;
checar("faixa 13 a 24 meses", `${faixa1.minMeses}-${faixa1.maxMeses}`, "13-24");
checar("faixa 25 a 36 meses", `${faixa2.minMeses}-${faixa2.maxMeses}`, "25-36");
checar("nascimento 13-24m em 20/07/2026", dataNascimentoPorFaixa(faixa1, "2026-07-20"), "2025-01-05");
checar("nascimento 25-36m em 20/07/2026", dataNascimentoPorFaixa(faixa2, "2026-07-20"), "2024-01-05");

const aberta = parseFaixaEtaria("BOVINO MACHO ACIMA DE 36 MESES")!;
checar("faixa aberta detectada", aberta.aberta, true);
checar("nascimento faixa aberta usa o limite inferior", dataNascimentoPorFaixa(aberta, "2026-07-20"), "2023-07-20");

console.log("\n7. Planilha de campo — layout de 6 colunas da certificadora");
const animaisPlanilha: Bovino[] = PLANILHA.slice(0, 3).map(([sisbov, manejo], i) => ({
  id: sisbov,
  sisbov,
  manejo,
  chipRfid: `96300040862${manejo.slice(-4)}`,
  nome: `Nelore ${manejo}`,
  categoria: CategoriaBovino.NOVILHO,
  raca: "Nelore",
  sexo: "M",
  dataNascimento: "2025-01-05",
  dataEntrada: "2026-07-21",
  farmedaId: "fazenda-teste",
  ativo: true,
  metadados: { racaCodigo: i === 2 ? "XX" : "NE" },
}));

const csv = gerarCsvPlanilhaCampo(animaisPlanilha);
const linhas = csv.replace(/^﻿/, "").split("\n");

checar("cabeçalho", linhas[0], "Sisbov;Manejo;Sexo;Raca;DataNasc;Data identificação");
checar("1ª linha", linhas[1], "105500508078035;807803;M;NE;05/01/2025;21/07/2026");
checar("3ª linha usa o código de raça XX", linhas[3], "105500508078051;807805;M;XX;05/01/2025;21/07/2026");
checar("uma linha por animal + cabeçalho", linhas.length, 4);

console.log("\n8. Linha do tempo — eventos estornados saem da leitura");
const base = { animalId: "a1", sisbov: PLANILHA[0][0], manejo: "807803", usuarioId: "u1", farmedaId: "f", criadoEm: "", origem: "mangueiro" as const };
const timeline: Evento[] = [
  { ...base, id: "e1", tipo: "cadastro", dataHora: "2026-07-21T08:00:00Z" },
  { ...base, id: "e2", tipo: "pesagem", dataHora: "2026-07-21T08:00:00Z", peso: 427.5 },
  { ...base, id: "e3", tipo: "pesagem", dataHora: "2026-07-21T08:05:00Z", peso: 999 },
  { ...base, id: "e4", tipo: "estorno", dataHora: "2026-07-21T08:06:00Z", eventoEstornadoId: "e3" },
];
const visiveis = semEstornados(timeline);

checar("evento errado e seu estorno somem", visiveis.length, 2);
checar("sobra o cadastro e a pesagem boa", visiveis.map((e) => e.id).join(","), "e1,e2");
checar("a pesagem de 999 kg não aparece", visiveis.some((e) => e.peso === 999), false);

console.log("\n9. Conferência de embarque — animais de terceiros");
const animal = (i: number, proprietario?: Bovino["proprietario"]): Bovino => ({
  ...animaisPlanilha[0],
  id: `a${i}`,
  sisbov: PLANILHA[i][0],
  manejo: PLANILHA[i][1],
  proprietario,
});

const soProprios = [animal(0), animal(1, { tipo: "proprio", nome: "Fazenda Rincão" })];
checar("embarque só de próprios libera", conferirEmbarque(soProprios).liberado, true);
checar("nenhum aviso", conferirEmbarque(soProprios).avisos.length, 0);

const jorge = { tipo: "terceiro" as const, nome: "JORGE VEIMAR SAYD PINTO", cpfCnpj: "00575410191" };
const renato = { tipo: "terceiro" as const, nome: "RENATO FELIPE PINHEIRO MARTINS" };
const misto = [animal(0), animal(1, jorge), animal(2, jorge), animal(3, renato)];
const conf = conferirEmbarque(misto);

checar("embarque com terceiro não libera", conf.liberado, false);
checar("separa próprios", conf.proprios.length, 1);
checar("separa terceiros", conf.terceiros.length, 3);
checar("agrupa por dono", conf.porProprietario.length, 2);
checar("dono com mais animais vem primeiro", conf.porProprietario[0].nome, jorge.nome);
checar("conta os animais de cada dono", conf.porProprietario[0].animais.length, 2);
checar(
  "avisa sobre a mistura",
  conf.avisos.includes("Embarque mistura animais próprios e de terceiros"),
  true
);
checar(
  "mensagem nomeia o dono e o CPF",
  mensagemConfirmacaoEmbarque(conf).includes("2 de JORGE VEIMAR SAYD PINTO (00575410191)"),
  true
);

checar("filtro de próprios", filtrarPorProprietario(misto, "proprios").length, 1);
checar("filtro de terceiros", filtrarPorProprietario(misto, "terceiros").length, 3);
checar("filtro todos", filtrarPorProprietario(misto, "todos").length, 4);
checar("animal sem proprietário conta como próprio", nomeProprietario(animal(0)), "Próprio");

console.log("\n10. Protocolos sanitários");
const entradaPadrao: ProtocoloSanitario = {
  id: "prot1",
  nome: "Entrada Padrão",
  ativo: true,
  farmedaId: "f",
  criadoEm: "",
  itens: [
    { tipo: "vacinacao", produto: "Febre Aftosa", dose: "5ml", via: "subcutanea", repetirEmDias: 180 },
    { tipo: "vermifugacao", produto: "Ivermectina", dose: "1ml/50kg", carenciaDias: 35 },
  ],
};
const brucelose: ProtocoloSanitario = {
  id: "prot2",
  nome: "Brucelose",
  ativo: true,
  farmedaId: "f",
  criadoEm: "",
  itens: [{ tipo: "vacinacao", produto: "B19", dose: "2ml" }],
};

const aplicadoEm = "2026-07-21T10:00:00.000Z";
const aplicacoes = aplicacoesDosProtocolos([entradaPadrao, brucelose], aplicadoEm);

checar("um evento por produto dos protocolos marcados", aplicacoes.length, 3);
checar("guarda de qual protocolo veio", aplicacoes[0].protocoloNome, "Entrada Padrão");
checar("carência calculada na gravação", aplicacoes[1].carenciaAte?.slice(0, 10), "2026-08-25");
checar("próxima dose calculada", aplicacoes[0].proximaEm?.slice(0, 10), "2027-01-17");
checar("produto sem carência não inventa data", aplicacoes[2].carenciaAte, undefined);

const fichaSanitaria = aplicacoes.map((a) =>
  eventoSanitarioDaAplicacao(a, "105500508078035", aplicadoEm, "f", "tec1")
);
checar("vira registro na ficha do animal", fichaSanitaria.length, 3);
checar("reentrada recebe a carência", fichaSanitaria[1].reentrada?.slice(0, 10), "2026-08-25");
checar("cita o protocolo na observação", fichaSanitaria[0].observacoes, "Protocolo Entrada Padrão");

// A carência que vale é a mais distante, não a última aplicada.
const hoje = new Date("2026-07-22T00:00:00.000Z");
checar("carência ativa é a mais longa", carenciaAtiva(fichaSanitaria, hoje)?.slice(0, 10), "2026-08-25");
checar(
  "sem carência futura o animal está liberado",
  carenciaAtiva(fichaSanitaria, new Date("2026-12-01T00:00:00.000Z")),
  null
);

console.log(
  falhas === 0
    ? "\nTodas as verificações passaram.\n"
    : `\n${falhas} verificação(ões) falharam.\n`
);
process.exit(falhas === 0 ? 0 : 1);
