/**
 * Cálculo da conferência de matéria seca (MS) por secagem.
 *
 * Reproduz a planilha de campo: pesa-se a amostra em um recipiente de tara
 * conhecida, leva-se ao forno/micro-ondas e repesa-se em intervalos (60 min na
 * primeira etapa, 10 min nas seguintes) até o peso estabilizar. A %MS de cada
 * etapa é o peso líquido atual dividido pelo peso líquido inicial.
 *
 * Todos os pesos são em gramas e os percentuais de 0 a 100.
 */
import type { ConferenciaMS, PesagemMS } from "@/components/InsumoCard";

export const TEMPO_PRIMEIRA_PESAGEM_MIN = 60;
export const TEMPO_PESAGEM_SEGUINTE_MIN = 10;

export type EtapaSecagem = {
  indice: number;
  tempoMin: number;
  tempoAcumuladoMin: number;
  pesoBruto: number;
  pesoLiquido: number;
  /** null quando o peso inicial líquido não permite calcular. */
  percentualMS: number | null;
};

export type ResultadoSecagem = {
  pesoInicialLiquido: number;
  etapas: EtapaSecagem[];
  pesoFinalBruto: number | null;
  percentualMSFinal: number | null;
  /** Verdadeiro quando as duas últimas pesagens têm o mesmo peso. */
  estabilizou: boolean;
};

/** Arredonda a %MS para uma casa decimal, como na planilha. */
export function arredondarMS(valor: number): number {
  return Math.round(valor * 10) / 10;
}

export function calcPesoLiquido(pesoBruto: number, tara: number): number {
  return pesoBruto - tara;
}

/**
 * %MS de uma pesagem: (peso bruto − tara) / (peso inicial bruto − tara).
 * Retorna null quando o peso inicial líquido é zero ou negativo.
 */
export function calcPercentualMS(
  tara: number,
  pesoInicialBruto: number,
  pesoBruto: number
): number | null {
  const liquidoInicial = calcPesoLiquido(pesoInicialBruto, tara);
  if (!(liquidoInicial > 0)) return null;
  const liquidoAtual = calcPesoLiquido(pesoBruto, tara);
  return arredondarMS((liquidoAtual / liquidoInicial) * 100);
}

/** Tempo sugerido para a próxima pesagem: 60 min na primeira, 10 min depois. */
export function proximoTempoPesagem(pesagens: PesagemMS[]): number {
  return pesagens.length === 0
    ? TEMPO_PRIMEIRA_PESAGEM_MIN
    : TEMPO_PESAGEM_SEGUINTE_MIN;
}

export function calcResultadoSecagem(
  tara: number,
  pesoInicialBruto: number,
  pesagens: PesagemMS[]
): ResultadoSecagem {
  const pesoInicialLiquido = calcPesoLiquido(pesoInicialBruto, tara);
  let acumulado = 0;
  const etapas: EtapaSecagem[] = pesagens.map((p, indice) => {
    acumulado += p.tempoMin;
    return {
      indice,
      tempoMin: p.tempoMin,
      tempoAcumuladoMin: acumulado,
      pesoBruto: p.pesoBruto,
      pesoLiquido: calcPesoLiquido(p.pesoBruto, tara),
      percentualMS: calcPercentualMS(tara, pesoInicialBruto, p.pesoBruto),
    };
  });

  const ultima = etapas[etapas.length - 1];
  const penultima = etapas[etapas.length - 2];

  return {
    pesoInicialLiquido,
    etapas,
    pesoFinalBruto: ultima?.pesoBruto ?? null,
    percentualMSFinal: ultima?.percentualMS ?? null,
    estabilizou: !!ultima && !!penultima && ultima.pesoBruto === penultima.pesoBruto,
  };
}

/** Conferências antigas não têm o campo: são tratadas como finalizadas. */
export function isConferenciaFinalizada(c: Pick<ConferenciaMS, "finalizada">): boolean {
  return c.finalizada !== false;
}

/**
 * %MS vigente do insumo: a conferência finalizada de data mais recente.
 * Em empate de data, vence a última da lista (a mais recém-gravada).
 * Retorna null quando não há conferência finalizada.
 */
export function msVigente(conferencias: ConferenciaMS[]): number | null {
  let vigente: ConferenciaMS | null = null;
  for (const c of conferencias) {
    if (!isConferenciaFinalizada(c)) continue;
    if (!vigente || c.data.localeCompare(vigente.data) >= 0) vigente = c;
  }
  return vigente ? vigente.percentualMS : null;
}

/** Data mais recente entre as conferências finalizadas, ou null. */
export function dataUltimaConferencia(
  conferencias: Pick<ConferenciaMS, "data" | "finalizada">[]
): string | null {
  let maisRecente: string | null = null;
  for (const c of conferencias) {
    if (!isConferenciaFinalizada(c)) continue;
    if (!maisRecente || c.data > maisRecente) maisRecente = c.data;
  }
  return maisRecente;
}

export function formatarMS(valor: number | null): string {
  if (valor === null || isNaN(valor)) return "-";
  return `${arredondarMS(valor).toFixed(1).replace(".", ",")}%`;
}

export function formatarGramas(valor: number | null): string {
  if (valor === null || isNaN(valor)) return "-";
  return `${valor.toLocaleString("pt-BR")} g`;
}
