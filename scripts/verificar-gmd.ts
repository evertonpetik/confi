/**
 * Verifica o cálculo de GMD pelo consumo (src/utils/gmdCalc.ts) contra os
 * valores calculados pela própria planilha de controle do confinamento.
 *
 * Casos: Lote 1 da planilha (Nelore, macho inteiro, tamanho corporal 5 →
 * GEC 0,83, sem implante, sem compensatório, perdas de 2 %, dietas com
 * monensina = 1,12). CMS, PV e GMD são as células das linhas 1225, 1869 e
 * 1666 da aba Resumo; o NDT é a linha 36 da aba Plan2.
 *
 * Rodar:  npx tsx scripts/verificar-gmd.ts
 */
import { calcGmdDetalhado, calcGmdNRC, type LoteFatores } from "../src/utils/gmdCalc";

let falhas = 0;
function checar(nome: string, obtido: number, esperado: number, tolerancia = 1e-9) {
  const ok = Math.abs(obtido - esperado) <= tolerancia;
  if (!ok) falhas++;
  console.log(`  ${ok ? "ok  " : "FALHA"}  ${nome}${ok ? "" : `  →  obtido ${obtido}, esperado ${esperado}`}`);
}

const LOTE_1: LoteFatores = {
  fatorRaca: 0.89,
  fatorGec: 0.83,
  fatorImplante: 0.95,
  fatorCompensatorio: 1,
  fatorAditivo: 1.12,
  perdas: 0.02,
};

console.log("\nEnergia da dieta (Plan2, linhas 37–39)");
const energia = calcGmdDetalhado(10, 500, 77.5, LOTE_1);
checar("EM  — NDT 77,5 %", energia.em, 2.7962);
checar("NEm — NDT 77,5 %, monensina", energia.nem, 2.115190309445278);
checar("NEg — NDT 77,5 %", energia.neg, 1.226869699381762);

console.log("\nGMD do Lote 1 (Resumo, linha 1666)");
const CASOS = [
  { dia: "R1-26 Adap, dia 1", cms: 8.8334042553191487, pv: 615.74, ndt: 75, gmd: 0.94396732737105027 },
  { dia: "R1-26 Adap, dia 5", cms: 12.908297872340425, pv: 620.40214210348154, ndt: 75, gmd: 1.6503862385045633 },
  { dia: "R14-25 Term", cms: 16.594468085106381, pv: 701.70217078681139, ndt: 80.8, gmd: 2.3390878819111998 },
  { dia: "R4-26 Term", cms: 15.227234042553192, pv: 723.58493463294258, ndt: 79, gmd: 1.9581305169375347 },
];
for (const c of CASOS) {
  checar(`${c.dia}: CMS ${c.cms.toFixed(2)} kg, PV ${c.pv.toFixed(1)} kg`, calcGmdNRC(c.cms, c.pv, c.ndt, LOTE_1), c.gmd);
}

console.log("\nEtapas (CMS 10 kg, perdas 2 %)");
checar("CMS efetivo", energia.cmsEfetivo, 9.8);
checar("CMS mantença = ELm / NEm", energia.cmsMantenca, energia.elm / energia.nem);
checar("CMS ganho = efetivo − mantença", energia.cmsGanho, 9.8 - energia.elm / energia.nem);

console.log("\nLimites");
checar("consumo abaixo da mantença → 0", calcGmdNRC(2, 615.74, 75, LOTE_1), 0);
checar("sem consumo → 0", calcGmdNRC(0, 615.74, 75, LOTE_1), 0);
checar("sem peso → 0", calcGmdNRC(10, 0, 75, LOTE_1), 0);
checar("sem NDT → 0", calcGmdNRC(10, 615.74, 0, LOTE_1), 0);
checar("perdas inválidas usam o padrão de 2 %", calcGmdNRC(10, 500, 77.5, { ...LOTE_1, perdas: NaN }), energia.gmd);

console.log(falhas === 0 ? "\nTudo certo.\n" : `\n${falhas} falha(s).\n`);
process.exit(falhas === 0 ? 0 : 1);
