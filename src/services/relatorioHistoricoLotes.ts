import { calcularPesoMedioInicial, Movimentacao } from "@/components/LoteCard";
import { getCollection } from "@/services/firestoreService";
import { gerarXlsx } from "@/services/xlsx";

export type HistoricoLoteRow = {
  loteId: string;
  loteNumero: number;
  data: string; // yyyy-mm-dd
  quantidade: number;
  dieta: string;
  cmsPctPV: number;
  gmdCalculado: number;
  consumoMS: number; // kg MS / cab
  consumoPrevistoMO: number; // kg MO / cab
  consumoRealizadoMO: number; // kg MO / cab
  faturamento: number; // custo do dia (R$)
  evolucaoPeso: number; // kg
};

type MsPorLoteEntry = {
  loteId: string;
  totalMO?: number;
  previsto?: number;
  totalMS?: number;
  cmsRealizado?: number;
  gmdReal?: number;
};

type CustoPorLoteEntry = {
  loteId: string;
  custo?: number;
};

type HistoricoEntry = {
  data: string;
  dieta: string;
  ms?: MsPorLoteEntry;
  custo?: CustoPorLoteEntry;
};

function calcularQuantidadeAteData(movimentacoes: Movimentacao[], data: string): number {
  return movimentacoes.reduce((acc, m) => {
    if (m.data > data) return acc;
    return m.evento === "Entrada" ? acc + m.quantidade : acc - m.quantidade;
  }, 0);
}

export async function buscarRelatorioHistoricoLotes(): Promise<HistoricoLoteRow[]> {
  const [lotesSnap, histSnap] = await Promise.all([
    getCollection("lotes"),
    getCollection("historicoMapaTrato"),
  ]);

  const movSnaps = await Promise.all(
    lotesSnap.docs.map((loteDoc) => getCollection("lotes", loteDoc.id, "movimentacoes"))
  );

  const lotesInfo = new Map<
    string,
    { numero: number; movimentacoes: Movimentacao[]; pesoEntrada: number }
  >();
  lotesSnap.docs.forEach((loteDoc, idx) => {
    const movimentacoes = movSnaps[idx].docs.map((m) => ({
      id: m.id,
      ...(m.data() as Omit<Movimentacao, "id">),
    }));
    lotesInfo.set(loteDoc.id, {
      numero: loteDoc.data().numero ?? 0,
      movimentacoes,
      pesoEntrada: calcularPesoMedioInicial(movimentacoes),
    });
  });

  // Agrupa entradas do historico por loteId
  const entriesPorLote = new Map<string, HistoricoEntry[]>();
  for (const hDoc of histSnap.docs) {
    const h = hDoc.data();
    const data = h.data as string | undefined;
    if (!data) continue;
    const dieta = (h.dietaNome as string) ?? "-";
    const msPorLote = (h.msPorLote ?? []) as MsPorLoteEntry[];
    const custoPorLote = (h.custoPorLote ?? []) as CustoPorLoteEntry[];

    const loteIds = new Set<string>([
      ...msPorLote.map((m) => m.loteId),
      ...custoPorLote.map((c) => c.loteId),
    ]);

    for (const loteId of loteIds) {
      if (!loteId) continue;
      const ms = msPorLote.find((m) => m.loteId === loteId);
      const custo = custoPorLote.find((c) => c.loteId === loteId);
      const prev = entriesPorLote.get(loteId) ?? [];
      prev.push({ data, dieta, ms, custo });
      entriesPorLote.set(loteId, prev);
    }
  }

  const rows: HistoricoLoteRow[] = [];

  for (const [loteId, entries] of entriesPorLote) {
    const info = lotesInfo.get(loteId);
    if (!info) continue;

    entries.sort((a, b) => a.data.localeCompare(b.data));

    let pesoAcumulado = info.pesoEntrada;
    for (const entry of entries) {
      if (entry.ms?.gmdReal != null && entry.ms.gmdReal > 0) {
        pesoAcumulado += entry.ms.gmdReal;
      }

      const quantidade = calcularQuantidadeAteData(info.movimentacoes, entry.data);
      const totalMS = entry.ms?.totalMS ?? 0;
      const previsto = entry.ms?.previsto ?? 0;
      const totalMO = entry.ms?.totalMO ?? 0;

      rows.push({
        loteId,
        loteNumero: info.numero,
        data: entry.data,
        quantidade,
        dieta: entry.dieta,
        cmsPctPV: entry.ms?.cmsRealizado ?? 0,
        gmdCalculado: entry.ms?.gmdReal ?? 0,
        consumoMS: quantidade > 0 ? totalMS / quantidade : 0,
        consumoPrevistoMO: quantidade > 0 ? previsto / quantidade : 0,
        consumoRealizadoMO: quantidade > 0 ? totalMO / quantidade : 0,
        faturamento: entry.custo?.custo ?? 0,
        evolucaoPeso: pesoAcumulado,
      });
    }
  }

  rows.sort((a, b) => a.data.localeCompare(b.data) || a.loteNumero - b.loteNumero);

  return rows;
}

const COLUNAS_RELATORIO_HISTORICO = [
  "Lote",
  "Data",
  "Quantidade",
  "Dieta",
  "CMS % PV",
  "GMD Calculado",
  "Consumo MS",
  "Consumo Previsto Ração KG MO",
  "Consumo Realizado Ração KG MO",
  "Faturamento",
  "Evolução de Peso",
];

function dataBr(iso: string): string {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

/**
 * Planilha do relatório histórico em .xlsx, pensada para ser consumida pelo
 * Power BI: números ficam como número (sem "R$"/"%"), não como texto formatado.
 */
export function gerarXlsxRelatorioHistoricoLotes(rows: HistoricoLoteRow[]): Uint8Array {
  const linhas = rows.map((r) => [
    r.loteNumero,
    dataBr(r.data),
    r.quantidade,
    r.dieta,
    r.cmsPctPV,
    r.gmdCalculado,
    r.consumoMS,
    r.consumoPrevistoMO,
    r.consumoRealizadoMO,
    r.faturamento,
    r.evolucaoPeso,
  ]);

  return gerarXlsx({
    nome: "Relatório Histórico",
    cabecalho: COLUNAS_RELATORIO_HISTORICO,
    linhas,
    larguras: [8, 12, 12, 16, 10, 14, 12, 16, 16, 12, 14],
  });
}
