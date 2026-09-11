/**
 * Faixas etárias declaradas nas GTAs de um processo.
 *
 * O operador não digita idade animal por animal: escolhe entre as faixas que
 * as próprias GTAs declaram. Isso dá um toque por animal e, de quebra, faz a
 * conferência contra a guia — a soma por faixa nunca pode passar do previsto,
 * que é justamente a divergência que a certificadora acusaria depois.
 */
import { dataNascimentoPorFaixa, FaixaEtaria, parseFaixaEtaria } from "./sisbov";
import { GTA } from "./weighing.types";

export interface FaixaProcesso {
  /** Texto normalizado, usado como chave e como rótulo do botão. */
  label: string;
  faixa: FaixaEtaria;
  /** Total declarado nas GTAs do processo para esta faixa. */
  previsto: number;
  /** Data de nascimento estimada (ponto médio da faixa). */
  dataNascimento: string;
  /** GTAs que declararam esta faixa. */
  gtaIds: string[];
  sexo: "M" | "F" | "ambos";
}

/**
 * Consolida as faixas de todas as GTAs do processo.
 *
 * A mesma faixa vinda de GTAs diferentes é somada num único botão. Quando as
 * emissões divergem, ancora a estimativa na mais recente: é a que está mais
 * perto do manejo e, portanto, a menos imprecisa.
 */
export function faixasDoProcesso(gtas: GTA[]): FaixaProcesso[] {
  const porLabel = new Map<string, FaixaProcesso & { emissao: string }>();

  for (const gta of gtas) {
    for (const grupo of gta.animais ?? []) {
      const faixa = parseFaixaEtaria(grupo.idadeCategoria || grupo.descricao);
      if (!faixa) continue;

      const existente = porLabel.get(faixa.label);
      if (existente) {
        existente.previsto += grupo.quantidade;
        if (gta.id && !existente.gtaIds.includes(gta.id)) existente.gtaIds.push(gta.id);
        if (gta.dataEmissao > existente.emissao) {
          existente.emissao = gta.dataEmissao;
          existente.dataNascimento = dataNascimentoPorFaixa(faixa, gta.dataEmissao);
        }
        if (existente.sexo !== grupo.sexo) existente.sexo = "ambos";
        continue;
      }

      porLabel.set(faixa.label, {
        label: faixa.label,
        faixa,
        previsto: grupo.quantidade,
        dataNascimento: dataNascimentoPorFaixa(faixa, gta.dataEmissao),
        gtaIds: gta.id ? [gta.id] : [],
        sexo: grupo.sexo,
        emissao: gta.dataEmissao,
      });
    }
  }

  // Mais novos primeiro: é a ordem em que os lotes costumam ser trabalhados.
  return [...porLabel.values()]
    .map(({ emissao, ...faixa }) => faixa)
    .sort((a, b) => a.faixa.minMeses - b.faixa.minMeses);
}

/** Quantos animais faltam em cada faixa, dado o que já foi manejado. */
export function saldoDasFaixas(
  faixas: FaixaProcesso[],
  manejadosPorFaixa: Record<string, number>
): { faixa: FaixaProcesso; manejados: number; restam: number; completa: boolean }[] {
  return faixas.map((faixa) => {
    const manejados = manejadosPorFaixa[faixa.label] ?? 0;
    return {
      faixa,
      manejados,
      restam: Math.max(0, faixa.previsto - manejados),
      completa: manejados >= faixa.previsto,
    };
  });
}

/** Divergências entre o previsto nas GTAs e o efetivamente manejado. */
export function conferirProcesso(
  faixas: FaixaProcesso[],
  manejadosPorFaixa: Record<string, number>
): { ok: boolean; previsto: number; manejados: number; pendencias: string[] } {
  const pendencias: string[] = [];
  let previsto = 0;
  let manejados = 0;

  for (const { faixa, manejados: m, restam } of saldoDasFaixas(faixas, manejadosPorFaixa)) {
    previsto += faixa.previsto;
    manejados += m;
    if (restam > 0) pendencias.push(`${faixa.label}: faltam ${restam} de ${faixa.previsto}`);
    if (m > faixa.previsto) {
      pendencias.push(`${faixa.label}: ${m - faixa.previsto} a mais que o declarado na GTA`);
    }
  }

  // Animais manejados sem faixa correspondente nas GTAs do processo
  for (const [label, qtd] of Object.entries(manejadosPorFaixa)) {
    if (!faixas.some((f) => f.label === label)) {
      manejados += qtd;
      pendencias.push(`${label}: ${qtd} animal(is) fora das faixas declaradas`);
    }
  }

  return { ok: pendencias.length === 0, previsto, manejados, pendencias };
}
