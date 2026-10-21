/**
 * loteCalcCore.ts
 *
 * Subconjunto de mapaTratoCalc.ts sem nenhuma dependência de react-native —
 * mapaTratoCalc.ts importa CargaModal.tsx/DescargaModal.tsx (componentes RN) e
 * firestoreService.ts (Client SDK, também depende de react-native), então
 * qualquer módulo de backend que importasse mapaTratoCalc.ts arrastava
 * react-native pro runtime Node.js serverless da Vercel e derrubava a função
 * inteira (FUNCTION_INVOCATION_FAILED) já no carregamento do módulo — mesmo
 * em rotas (como o GET do webhook) cuja lógica não usa nada disso.
 *
 * Mantenha a lógica destas funções sincronizada com as equivalentes em
 * mapaTratoCalc.ts caso você as altere lá.
 */

export const CMS_INICIAL = 1.3;

export type MovimentacaoLote = {
  evento: string;
  quantidade: number;
  pesoMedio: number;
  data: string;
};

export function calcQtdAtual(movs: MovimentacaoLote[]): number {
  return movs.reduce(
    (acc, m) => (m.evento === "Entrada" ? acc + m.quantidade : acc - m.quantidade),
    0
  );
}

export function calcPesoMedio(movs: MovimentacaoLote[], gmd: number): number {
  const qtd = calcQtdAtual(movs);
  if (qtd <= 0) return 0;
  const hoje = new Date();
  let pesoTotal = 0;
  for (const m of movs) {
    const dataM = new Date(m.data + "T00:00:00");
    const dias = Math.max(0, Math.floor((hoje.getTime() - dataM.getTime()) / 86400000));
    const pesoAjustado = m.pesoMedio + gmd * dias;
    if (m.evento === "Entrada") pesoTotal += m.quantidade * pesoAjustado;
    else pesoTotal -= m.quantidade * pesoAjustado;
  }
  return pesoTotal / qtd;
}

export function getHojeStr(date?: Date): string {
  const d = date ?? new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// No mesmo dia pode haver varias leituras (nota refeita, ajuste fino, repetir
// previsto), cada uma em um doc separado. A query ordenada so por "data" nao
// desempata entre elas (a ordem vira o ID aleatorio do doc). Este helper
// escolhe a mais recente: maior data e, dentro da mesma data, maior criadoEm
// (docs antigos sem criadoEm contam como 0 e perdem para os novos).
export function escolherLeituraMaisRecente<T extends { data?: string; criadoEm?: number }>(
  leituras: T[]
): T | undefined {
  let melhor: T | undefined;
  for (const l of leituras) {
    if (!melhor) {
      melhor = l;
      continue;
    }
    const cmpData = String(l.data ?? "").localeCompare(String(melhor.data ?? ""));
    if (cmpData > 0 || (cmpData === 0 && (l.criadoEm ?? 0) > (melhor.criadoEm ?? 0))) {
      melhor = l;
    }
  }
  return melhor;
}
