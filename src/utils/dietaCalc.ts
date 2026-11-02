/**
 * Cálculos de dieta sem dependência de React Native.
 *
 * As dietas são formuladas no RLM com inclusões em base de matéria seca
 * (cada percentual é a fatia do insumo nos kg de MS da dieta). Nessa base,
 * a MS da mistura não é a média ponderada simples — essa valeria se as
 * inclusões fossem em matéria natural — e sim a média harmônica:
 *
 *   MS = Σp / Σ(p_i / MS_i)
 *
 * Ex.: silagem 40 % (36,5 % MS), milho 22,5 % (87 %), DDG 34,4 % (90 %),
 * núcleo 2,95 % (100 %), ureia 0,15 % (99 %) → 56,57 % de MS (a média
 * ponderada daria 68,23 %, errado).
 */

export type ItemDietaMS = {
  /** Inclusão do insumo na dieta, em % da MS (0–100). */
  percentual: number;
  /** %MS do insumo (0–100). */
  percentualMS: number;
};

/**
 * %MS da mistura de insumos (0–100) para inclusões em base MS.
 * Ignora itens sem percentual ou sem %MS válidos. Retorna 0 sem itens válidos.
 *
 * Não considera água adicionada no vagão: no app a água não é insumo, e a
 * diferença entre a MS gravada na dieta e a MS dos insumos é o que o mapa de
 * trato prevê como água.
 */
export function calcMSDietaBaseMS(itens: ItemDietaMS[]): number {
  let somaP = 0;
  let somaPsobreMS = 0;
  for (const it of itens) {
    if (!(it.percentual > 0) || !(it.percentualMS > 0)) continue;
    somaP += it.percentual;
    somaPsobreMS += it.percentual / it.percentualMS;
  }
  return somaPsobreMS > 0 ? somaP / somaPsobreMS : 0;
}

/**
 * kg de matéria natural de cada insumo para `kgMSTotal` kg de MS da dieta.
 * Útil para conferir a formulação: moInsumo = kgMS × p_i / MS_i.
 */
export function kgMateriaNaturalPorInsumo(itens: ItemDietaMS[], kgMSTotal: number): number[] {
  return itens.map((it) =>
    it.percentual > 0 && it.percentualMS > 0
      ? (kgMSTotal * (it.percentual / 100)) / (it.percentualMS / 100)
      : 0
  );
}
