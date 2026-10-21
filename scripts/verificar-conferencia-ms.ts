/**
 * Verifica o cálculo da conferência de matéria seca por secagem.
 *
 * Os números são os da planilha de campo que o app substitui (bagaço de cana,
 * 21/10/2026): tara 1306 g, peso inicial bruto 1605 g, pesagens 1510 → 1490 →
 * 1480 → 1480 g, resultado 58,2%.
 *
 * Rodar:  npx tsx scripts/verificar-conferencia-ms.ts
 */
import type { ConferenciaMS } from "../src/components/InsumoCard";
import {
  calcPercentualMS,
  calcPesoLiquido,
  calcResultadoSecagem,
  dataUltimaConferencia,
  formatarGramas,
  formatarMS,
  msVigente,
  proximoTempoPesagem,
} from "../src/utils/materiaSecaCalc";

let falhas = 0;
function checar(nome: string, obtido: unknown, esperado: unknown) {
  const ok = String(obtido) === String(esperado);
  if (!ok) falhas++;
  console.log(`  ${ok ? "ok  " : "FALHA"}  ${nome}${ok ? "" : `  →  obtido ${obtido}, esperado ${esperado}`}`);
}

console.log("\nPlanilha: bagaço de cana");
const TARA = 1306;
const BRUTO = 1605;
const PESAGENS = [
  { tempoMin: 60, pesoBruto: 1510 },
  { tempoMin: 10, pesoBruto: 1490 },
  { tempoMin: 10, pesoBruto: 1480 },
  { tempoMin: 10, pesoBruto: 1480 },
];

checar("peso inicial líquido", calcPesoLiquido(BRUTO, TARA), 299);
checar("%MS 1ª pesagem (1510 g)", calcPercentualMS(TARA, BRUTO, 1510), 68.2);
checar("%MS 2ª pesagem (1490 g)", calcPercentualMS(TARA, BRUTO, 1490), 61.5);
checar("%MS 3ª pesagem (1480 g)", calcPercentualMS(TARA, BRUTO, 1480), 58.2);

const res = calcResultadoSecagem(TARA, BRUTO, PESAGENS);
checar("etapas", res.etapas.length, 4);
checar("tempo acumulado final", res.etapas[3].tempoAcumuladoMin, 90);
checar("peso final", res.pesoFinalBruto, 1480);
checar("%MS final", res.percentualMSFinal, 58.2);
checar("estabilizou (1480 = 1480)", res.estabilizou, true);
checar("formatação %MS", formatarMS(res.percentualMSFinal), "58,2%");
checar("formatação gramas", formatarGramas(1306), "1.306 g");

console.log("\nSecagem incompleta");
const parcial = calcResultadoSecagem(TARA, BRUTO, PESAGENS.slice(0, 3));
checar("não estabilizou (1490 ≠ 1480)", parcial.estabilizou, false);
checar("%MS parcial", parcial.percentualMSFinal, 58.2);
const vazia = calcResultadoSecagem(TARA, BRUTO, []);
checar("sem pesagens: peso final nulo", vazia.pesoFinalBruto, null);
checar("sem pesagens: %MS nula", vazia.percentualMSFinal, null);
checar("sem pesagens: não estabilizou", vazia.estabilizou, false);

console.log("\nTempos sugeridos");
checar("primeira pesagem", proximoTempoPesagem([]), 60);
checar("seguintes", proximoTempoPesagem(PESAGENS.slice(0, 1)), 10);

console.log("\nCasos inválidos");
checar("líquido inicial zero", calcPercentualMS(100, 100, 90), null);
checar("líquido inicial negativo", calcPercentualMS(200, 100, 90), null);
checar("peso abaixo da tara dá %MS negativa", calcPercentualMS(100, 200, 90), -10);

console.log("\nMS vigente do insumo");
const confs: ConferenciaMS[] = [
  { id: "a", data: "2026-10-01", percentualMS: 50 },
  { id: "b", data: "2026-10-20", percentualMS: 58.2, tara: TARA, pesoInicialBruto: BRUTO, pesagens: PESAGENS, finalizada: true },
  { id: "c", data: "2026-10-21", percentualMS: 40, finalizada: false },
  { id: "d", data: "2026-10-10", percentualMS: 70 },
];
checar("ignora em andamento, usa a mais recente finalizada", msVigente(confs), 58.2);
checar("conferência antiga sem flag conta como finalizada", msVigente([confs[0]]), 50);
checar("só em andamento → null", msVigente([confs[2]]), null);
checar("lista vazia → null", msVigente([]), null);
checar("empate de data: vence a última gravada",
  msVigente([{ id: "x", data: "2026-10-05", percentualMS: 30 }, { id: "y", data: "2026-10-05", percentualMS: 35 }]), 35);
checar("data da última finalizada", dataUltimaConferencia(confs), "2026-10-20");
checar("data da última: só em andamento → null", dataUltimaConferencia([confs[2]]), null);

console.log(falhas === 0 ? "\nTudo certo." : `\n${falhas} falha(s).`);
if (falhas > 0) process.exit(1);
