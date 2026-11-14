/**
 * GMD a partir do consumo — modelo energético da planilha
 * "Controle Confinamento Pecuária RF" (abas Plan2 e Resumo), sem dependência
 * de React Native.
 *
 * A planilha não calcula o GMD pela diferença entre peso de entrada e de
 * saída: ela estima quanta energia da dieta sobra depois da mantença e
 * converte essa energia em ganho (equações do NRC 1996).
 *
 *   EM          = NDT × 4,4 × 0,82
 *   NEm         = (1,37·EM − 0,138·EM² + 0,0105·EM³ − 1,12) / (2 − fatorAditivo)
 *   NEg         = 1,42·EM − 0,174·EM² + 0,0122·EM³ − 1,65
 *   CMSefetivo  = CMS × (1 − perdas)
 *   ELm         = 0,077 × (PV × 0,95)^0,75 × fatorRaca × fatorCompensatorio
 *   CMSganho    = CMSefetivo − ELm / NEm
 *   Eganho      = CMSganho × NEg × fatorImplante
 *   GMD         = 13,91 × Eganho^0,9116 / (0,95 × (PV × 0,95 × GEC)^0,6837)
 *
 * Conferido contra os valores da própria planilha em scripts/verificar-gmd.ts.
 */

/** Perdas de cocho usadas quando o parâmetro `perdas_cocho` não está cadastrado (2 %, valor da planilha). */
export const PERDAS_COCHO_PADRAO = 0.02;

export type LoteFatores = {
  /** Multiplica a exigência de mantença (Nelore 0,89 … Holandês 1,2). */
  fatorRaca: number;
  /** Grau de estrutura corporal: ajusta o peso para o peso equivalente. */
  fatorGec: number;
  /** Multiplica a energia disponível para ganho. */
  fatorImplante: number;
  /** Multiplica a exigência de mantença. */
  fatorCompensatorio: number;
  /** Ionóforo da dieta: entra na NEm como divisor (2 − fator). */
  fatorAditivo: number;
  /** Fração do consumo perdida no cocho (0–1). */
  perdas: number;
};

export type GmdDetalhe = {
  em: number;
  nem: number;
  neg: number;
  cmsEfetivo: number;
  elm: number;
  cmsMantenca: number;
  cmsGanho: number;
  energiaGanho: number;
  gmd: number;
};

/**
 * Todas as etapas do cálculo. `cmsAnimalKgMS` em kg de MS por animal/dia,
 * `pesoVivo` em kg, `ndt` em % (0–100). GMD = 0 quando o consumo não cobre a
 * mantença ou quando faltam dados.
 */
export function calcGmdDetalhado(
  cmsAnimalKgMS: number,
  pesoVivo: number,
  ndt: number,
  fatores: LoteFatores
): GmdDetalhe {
  const d: GmdDetalhe = {
    em: 0, nem: 0, neg: 0, cmsEfetivo: 0, elm: 0, cmsMantenca: 0, cmsGanho: 0, energiaGanho: 0, gmd: 0,
  };
  if (!(cmsAnimalKgMS > 0) || !(pesoVivo > 0) || !(ndt > 0)) return d;

  // 1. Energia da dieta (Mcal/kg MS)
  const em = (ndt / 100) * 4.4 * 0.82;
  const divisorAditivo = 2 - fatores.fatorAditivo;
  if (!(divisorAditivo > 0)) return d;
  d.em = em;
  d.nem = (1.37 * em - 0.138 * em * em + 0.0105 * em * em * em - 1.12) / divisorAditivo;
  d.neg = 1.42 * em - 0.174 * em * em + 0.0122 * em * em * em - 1.65;
  if (!(d.nem > 0) || !(d.neg > 0)) return d;

  // 2. Consumo efetivo
  const perdas = fatores.perdas >= 0 && fatores.perdas < 1 ? fatores.perdas : PERDAS_COCHO_PADRAO;
  d.cmsEfetivo = cmsAnimalKgMS * (1 - perdas);

  // 3. Mantença
  const pesoJejum = pesoVivo * 0.95;
  d.elm = 0.077 * Math.pow(pesoJejum, 0.75) * fatores.fatorRaca * fatores.fatorCompensatorio;
  d.cmsMantenca = d.elm / d.nem;

  // 4. Consumo e energia disponíveis para ganho
  d.cmsGanho = d.cmsEfetivo - d.cmsMantenca;
  if (!(d.cmsGanho > 0)) return d;
  d.energiaGanho = d.cmsGanho * d.neg * fatores.fatorImplante;
  if (!(d.energiaGanho > 0)) return d;

  // 5. Conversão da energia em ganho
  const pesoEquivalente = pesoJejum * fatores.fatorGec;
  if (!(pesoEquivalente > 0)) return d;
  d.gmd = (13.91 * Math.pow(d.energiaGanho, 0.9116)) / (0.95 * Math.pow(pesoEquivalente, 0.6837));
  return d;
}

export function calcGmdNRC(
  cmsAnimalKgMS: number,
  pesoVivo: number,
  ndt: number,
  fatores: LoteFatores
): number {
  return calcGmdDetalhado(cmsAnimalKgMS, pesoVivo, ndt, fatores).gmd;
}
