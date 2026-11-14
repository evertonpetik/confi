import { CargaTrato } from "@/components/CargaModal";
import { DescargaTrato } from "@/components/DescargaModal";
import { somarEmbarquesAgendadosNaData } from "@/services/embarqueAgendado";
import { resolverMSDieta } from "@/utils/dietaCalc";
import { PERDAS_COCHO_PADRAO, type LoteFatores } from "@/utils/gmdCalc";
import { escolherLeituraMaisRecente } from "@/utils/loteCalcCore";
import {
  fsLimit,
  fsOrderBy,
  fsWhere,
  getCollection,
  getDocument,
  queryCollection,
} from "@/services/firestoreService";

// ---- Constants ----

export const CMS_INICIAL = 1.3;

// ---- Config: base do CMS da leitura ----
// "realizado": o CMS do dia parte do realizado de ontem (padrao)
// "previsto": o CMS do dia parte do previsto de ontem (realizado nao afeta a projecao)

export type BaseCmsLeitura = "realizado" | "previsto";

export async function getBaseCmsLeitura(): Promise<BaseCmsLeitura> {
  try {
    const doc = await getDocument(["config"], "app");
    if (doc.exists !== false && doc.data()) {
      const v = (doc.data() as Record<string, any>).baseCmsLeitura;
      if (v === "previsto") return "previsto";
    }
  } catch { /* offline - usa padrao */ }
  return "realizado";
}

// ---- Types ----

export type Vagao = { id: string; descricao: string; capacidade: number };

export type DietaInsumo = {
  insumoId: string;
  insumoNome: string;
  percentual: number;
};

export type DietaData = {
  id: string;
  nome: string;
  insumos: DietaInsumo[];
  /** %MS gravada; com `manterMS` o buildCalcData substitui pela MS atual dos insumos. */
  percentualMS: number;
  manterMS?: boolean;
  ndt: number;
  aditivoNome: string;
};

export type RoteiroData = {
  id: string;
  numero: number;
  dietaId: string;
  dietaNome: string;
  piquetes: { piqueteId: string; piqueteNome: string }[];
  minTratos: number;
};

export type LoteData = {
  id: string;
  numero: number;
  piqueteId: string;
  piqueteNome: string;
  gmdEstimado: number;
  movimentacoes: { evento: string; quantidade: number; pesoMedio: number; data: string }[];
  cmsAtual: number;
  raca: string;
  categoria: string;
  compensatorio: string;
  implante: string;
  tamanhoCorporal: string;
};

export type InsumoMS = { id: string; percentualMateriaSeca: number; precoMedio: number };

export { calcGmdNRC } from "@/utils/gmdCalc";
export type { LoteFatores };

export type RoteiroCalculado = {
  roteiro: RoteiroData;
  dieta: DietaData;
  lotes: {
    lote: LoteData;
    qtdAnimais: number;
    pesoMedio: number;
    msLote: number;
    moLote: number;
    fatores: LoteFatores;
  }[];
  totalMS: number;
  totalMO: number;
  numTratos: number;
  moPerTrato: number;
  insumosPrevistos: { insumoId: string; insumoNome: string; previsto: number; precoMedio: number; percentualMS: number }[];
  aguaPrevista: number;
  descargaPrevistos: { piqueteId: string; piqueteNome: string; loteNumero: number; previsto: number }[];
};

export type FatorMaps = {
  racaFatorMap: Map<string, number>;
  implanteFatorMap: Map<string, number>;
  compensFatorMap: Map<string, number>;
  aditivoFatorMap: Map<string, number>;
  tcFatorMap: Map<string, number>;
  gecFatorMap: Map<string, number>;
  /** Fração do consumo perdida no cocho (parâmetro `perdas_cocho`, em %, dividido por 100). */
  perdasCocho: number;
};

export type EmbarqueHojeInfo = {
  loteId: string;
  loteNumero: number;
  piqueteNome: string;
  quantidade: number;
  qtdAtual: number;
  total: boolean;
};

export type MapaTratoFetchResult = {
  vagoes: Vagao[];
  roteiros: RoteiroData[];
  dietasMap: Map<string, DietaData>;
  insumosMap: Map<string, InsumoMS>;
  lotesByPiquete: Map<string, LoteData>;
  fatorMaps: FatorMaps;
  historicoCargas: Map<string, CargaTrato[]>;
  historicoDescargas: Map<string, DescargaTrato[]>;
  percentualMSPorRoteiro: Map<string, number>;
  embarquesHoje: EmbarqueHojeInfo[];
};

// ---- Helpers ----

export function calcQtdAtual(movs: LoteData["movimentacoes"]): number {
  return movs.reduce(
    (acc, m) => (m.evento === "Entrada" ? acc + m.quantidade : acc - m.quantidade),
    0
  );
}

export function calcPesoMedio(movs: LoteData["movimentacoes"], gmd: number): number {
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

// ---- Build Calculated Data ----

export function buildCalcData(
  roteiros: RoteiroData[],
  dietasMap: Map<string, DietaData>,
  insumosMap: Map<string, InsumoMS>,
  lotesByPiquete: Map<string, LoteData>,
  vagaoCapacidade: number,
  fMaps: FatorMaps
): RoteiroCalculado[] {
  return roteiros.map((roteiro) => {
    const dietaSalva = dietasMap.get(roteiro.dietaId);
    if (!dietaSalva) {
      return {
        roteiro,
        dieta: { id: "", nome: "", insumos: [], percentualMS: 50, ndt: 0, aditivoNome: "" },
        lotes: [],
        totalMS: 0,
        totalMO: 0,
        numTratos: 0,
        moPerTrato: 0,
        insumosPrevistos: [],
        aguaPrevista: 0,
        descargaPrevistos: [],
      };
    }

    // Dieta "Manter MS igual à dos insumos": a MS vigente segue a MS atual dos
    // insumos (conferências), senão a dieta fica travada no valor do cadastro e a
    // diferença apareceria como água prevista.
    const dieta: DietaData = {
      ...dietaSalva,
      percentualMS: resolverMSDieta(
        dietaSalva,
        (id) => insumosMap.get(id)?.percentualMateriaSeca
      ),
    };

    const lotesCalc = roteiro.piquetes
      .map((p) => {
        const lote = lotesByPiquete.get(p.piqueteId);
        if (!lote) return null;
        const qtdAnimais = calcQtdAtual(lote.movimentacoes);
        const pesoMedio = calcPesoMedio(lote.movimentacoes, lote.gmdEstimado);
        const msLote = qtdAnimais * pesoMedio * (lote.cmsAtual / 100);
        const moLote = dieta.percentualMS > 0 ? msLote / (dieta.percentualMS / 100) : 0;

        const tcNumero = fMaps.tcFatorMap.get(lote.tamanhoCorporal) ?? 5;
        const gecKey = `${tcNumero}_${lote.categoria}`;
        const fatores: LoteFatores = {
          fatorRaca: fMaps.racaFatorMap.get(lote.raca) ?? 1,
          fatorGec: fMaps.gecFatorMap.get(gecKey) ?? 1,
          fatorImplante: fMaps.implanteFatorMap.get(lote.implante) ?? 1,
          fatorCompensatorio: fMaps.compensFatorMap.get(lote.compensatorio) ?? 1,
          fatorAditivo: fMaps.aditivoFatorMap.get(dieta.aditivoNome) ?? 1,
          perdas: fMaps.perdasCocho,
        };

        return { lote, qtdAnimais, pesoMedio, msLote, moLote, fatores };
      })
      .filter(Boolean) as RoteiroCalculado["lotes"];

    const totalMS = lotesCalc.reduce((acc, l) => acc + l.msLote, 0);
    const totalMO = dieta.percentualMS > 0 ? totalMS / (dieta.percentualMS / 100) : 0;
    const numTratos = totalMO > 0 ? Math.max(roteiro.minTratos ?? 1, Math.ceil(totalMO / vagaoCapacidade)) : 0;
    const moPerTrato = numTratos > 0 ? totalMO / numTratos : 0;
    const msPerTrato = numTratos > 0 ? totalMS / numTratos : 0;

    let somaMOInsumos = 0;
    const insumosPrevistos = dieta.insumos.map((di) => {
      const msInsumo = msPerTrato * (di.percentual / 100);
      const insumoData = insumosMap.get(di.insumoId);
      const percMS = insumoData?.percentualMateriaSeca ?? 100;
      const moInsumo = percMS > 0 ? msInsumo / (percMS / 100) : 0;
      somaMOInsumos += moInsumo;
      return { insumoId: di.insumoId, insumoNome: di.insumoNome, previsto: moInsumo, precoMedio: insumoData?.precoMedio ?? 0, percentualMS: percMS };
    });

    // Sem água na formulação a sobra é só ruído de arredondamento
    const aguaPrevista = dieta.manterMS ? 0 : Math.max(0, moPerTrato - somaMOInsumos);

    const descargaPrevistos = lotesCalc.map((l) => ({
      piqueteId: l.lote.piqueteId,
      piqueteNome: l.lote.piqueteNome,
      loteNumero: l.lote.numero,
      previsto: numTratos > 0 ? l.moLote / numTratos : 0,
    }));

    return {
      roteiro,
      dieta,
      lotes: lotesCalc,
      totalMS,
      totalMO,
      numTratos,
      moPerTrato,
      insumosPrevistos,
      aguaPrevista,
      descargaPrevistos,
    };
  });
}

// ---- Fetch All Data ----

export function getHojeStr(date?: Date): string {
  const d = date ?? new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function fetchMapaTratoData(dataStr?: string): Promise<MapaTratoFetchResult> {
  const hoje = dataStr ?? getHojeStr();

  const [vagaoSnap, rotSnap, dietaSnap, lotesSnap, insumosSnap, racaSnap, implSnap, compSnap, gecSnap, aditSnap, tcSnap, parametrosSnap] = await Promise.all([
    getCollection("vagao"),
    getCollection("roteiros"),
    getCollection("dietas"),
    getCollection("lotes"),
    getCollection("insumos"),
    getCollection("raca"),
    getCollection("implante"),
    getCollection("compensatorio"),
    getCollection("gec"),
    getCollection("aditivos"),
    getCollection("tamanhoCorporal"),
    getCollection("parametros"),
  ]);

  // Vagões
  const vagoes: Vagao[] = vagaoSnap.docs.map((d) => ({
    id: d.id,
    descricao: d.data().descricao as string,
    capacidade: d.data().capacidade as number,
  }));

  // Dietas map
  const dietasMap = new Map<string, DietaData>();
  for (const d of dietaSnap.docs) {
    dietasMap.set(d.id, {
      id: d.id,
      nome: d.data().nome,
      insumos: d.data().insumos ?? [],
      percentualMS: d.data().percentualMS ?? 50,
      manterMS: d.data().manterMS === true,
      ndt: d.data().ndt ?? 0,
      aditivoNome: d.data().aditivoNome ?? "",
    });
  }

  // Factor lookup maps
  const racaFatorMap = new Map<string, number>();
  for (const d of racaSnap.docs) racaFatorMap.set(d.data().descricao, d.data().fator ?? 1);

  const implanteFatorMap = new Map<string, number>();
  for (const d of implSnap.docs) implanteFatorMap.set(d.data().descricao, d.data().fator ?? 1);

  const compensFatorMap = new Map<string, number>();
  for (const d of compSnap.docs) compensFatorMap.set(d.data().descricao, d.data().fator ?? 1);

  const aditivoFatorMap = new Map<string, number>();
  for (const d of aditSnap.docs) aditivoFatorMap.set(d.data().descricao, d.data().fator ?? 1);

  const tcFatorMap = new Map<string, number>();
  for (const d of tcSnap.docs) tcFatorMap.set(d.data().descricao, d.data().fator ?? 5);

  const gecFatorMap = new Map<string, number>();
  for (const d of gecSnap.docs) {
    const tc = d.data().tamanhoCorporal ?? 0;
    const cat = d.data().categoria ?? "";
    gecFatorMap.set(`${tc}_${cat}`, d.data().fator ?? 1);
  }

  // Perdas de cocho (%): descontadas do consumo no cálculo do GMD real
  const perdasParam = parametrosSnap.docs.find((d) => d.data().descricao === "perdas_cocho");
  const perdasPct = perdasParam ? Number(perdasParam.data().valor) : NaN;
  const perdasCocho = perdasPct >= 0 && perdasPct < 100 ? perdasPct / 100 : PERDAS_COCHO_PADRAO;

  // Insumos MS map (com precoMedio via média ponderada móvel)
  const insumosMap = new Map<string, InsumoMS>();
  for (const d of insumosSnap.docs) {
    const [comprasSnap, saidasSnap] = await Promise.all([
      getCollection("insumos", d.id, "compras"),
      getCollection("insumos", d.id, "saidas"),
    ]);
    type Ev = { data: string; tipo: "E" | "S"; quantidade: number; precoKg: number };
    const eventos: Ev[] = [
      ...comprasSnap.docs.map((cDoc) => {
        const c = cDoc.data();
        return { data: (c.data as string) ?? "", tipo: "E" as const, quantidade: (c.quantidade as number) ?? 0, precoKg: (c.precoKg as number) ?? 0 };
      }),
      ...saidasSnap.docs.map((sDoc) => {
        const s = sDoc.data();
        return { data: (s.data as string) ?? "", tipo: "S" as const, quantidade: (s.quantidade as number) ?? 0, precoKg: (s.precoKg as number) ?? 0 };
      }),
    ].sort((a, b) => a.data.localeCompare(b.data));

    let estoque = 0;
    let valorTotal = 0;
    for (const ev of eventos) {
      if (ev.tipo === "E") {
        estoque += ev.quantidade;
        valorTotal += ev.quantidade * ev.precoKg;
      } else {
        if (estoque <= 0) continue;
        const avg = valorTotal / estoque;
        valorTotal -= ev.quantidade * avg;
        estoque -= ev.quantidade;
        if (estoque < 0) { estoque = 0; valorTotal = 0; }
      }
    }

    insumosMap.set(d.id, {
      id: d.id,
      percentualMateriaSeca: d.data().percentualMateriaSeca ?? 100,
      precoMedio: estoque > 0 ? valorTotal / estoque : 0,
    });
  }

  // CMS base do dia anterior por lote (realizado ou previsto, conforme configuracao)
  const baseCmsLeitura = await getBaseCmsLeitura();
  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  const ontemStr = `${ontem.getFullYear()}-${String(ontem.getMonth() + 1).padStart(2, "0")}-${String(ontem.getDate()).padStart(2, "0")}`;
  const histOntemSnap = await queryCollection(["historicoMapaTrato"], [fsWhere("data", "==", ontemStr)]);
  const cmsOntemMap = new Map<string, number>();
  for (const hDoc of histOntemSnap.docs) {
    const msPorLote = hDoc.data().msPorLote as { loteId: string; cmsRealizado?: number; cmsPrevisto?: number }[] | undefined;
    if (msPorLote) {
      for (const ml of msPorLote) {
        const base = baseCmsLeitura === "previsto" ? ml.cmsPrevisto : ml.cmsRealizado;
        if (base && base > 0) {
          cmsOntemMap.set(ml.loteId, base);
        }
      }
    }
  }

  // Lotes with movimentacoes and CMS
  const lotesData: LoteData[] = [];
  const embarquesHoje: EmbarqueHojeInfo[] = [];
  for (const loteDoc of lotesSnap.docs) {
    const ld = loteDoc.data();
    if (!ld.piqueteId || ld.ativo === false) continue;

    const movSnap = await getCollection("lotes", loteDoc.id, "movimentacoes");
    const movs = movSnap.docs.map((m) => ({
      evento: m.data().evento as string,
      quantidade: m.data().quantidade as number,
      pesoMedio: m.data().pesoMedio as number,
      data: m.data().data as string,
    }));

    let cmsAtual = CMS_INICIAL;
    let leituraHojeCms = 0;
    try {
      // limit(10): pode haver varias leituras no mesmo dia; o desempate é feito
      // no cliente por criadoEm (ver escolherLeituraMaisRecente)
      const leitSnap = await queryCollection(
        ["lotes", loteDoc.id, "leituras"],
        [fsOrderBy("data", "desc"), fsLimit(10)]
      );
      const ultimaLeitura = escolherLeituraMaisRecente(
        leitSnap.docs.map((d) => d.data() as { data?: string; criadoEm?: number; cmsNovo?: number })
      );
      if (ultimaLeitura) {
        if (ultimaLeitura.data === hoje) {
          leituraHojeCms = ultimaLeitura.cmsNovo ?? 0;
        } else {
          cmsAtual = ultimaLeitura.cmsNovo ?? CMS_INICIAL;
        }
      }
    } catch { /* no index yet */ }

    if (leituraHojeCms > 0) {
      cmsAtual = leituraHojeCms;
    } else if (cmsOntemMap.get(loteDoc.id) && cmsOntemMap.get(loteDoc.id)! > 0) {
      cmsAtual = cmsOntemMap.get(loteDoc.id)!;
    }

    const embarquesSnap = await getCollection("lotes", loteDoc.id, "embarquesAgendados");
    const embarquesDocs = embarquesSnap.docs.map((e) => ({
      data: e.data().data as string,
      quantidade: e.data().quantidade as number,
      status: e.data().status as "agendado" | "cancelado",
    }));
    const quantidadeAgendadaHoje = somarEmbarquesAgendadosNaData(embarquesDocs, hoje);
    const qtdAtual = calcQtdAtual(movs);

    if (quantidadeAgendadaHoje > 0) {
      embarquesHoje.push({
        loteId: loteDoc.id,
        loteNumero: ld.numero ?? 0,
        piqueteNome: ld.piqueteNome ?? "",
        quantidade: quantidadeAgendadaHoje,
        qtdAtual,
        total: quantidadeAgendadaHoje >= qtdAtual,
      });
    }

    if (quantidadeAgendadaHoje >= qtdAtual && qtdAtual > 0) {
      // Embarque total: lote sai do roteiro calculado nesta data
      continue;
    }

    if (quantidadeAgendadaHoje > 0) {
      // Embarque parcial: reduz proporcionalmente via movimentação sintética (só em memória)
      movs.push({
        evento: "Saida",
        quantidade: quantidadeAgendadaHoje,
        pesoMedio: calcPesoMedio(movs, ld.gmdEstimado ?? 0),
        data: hoje,
      });
    }

    lotesData.push({
      id: loteDoc.id,
      numero: ld.numero ?? 0,
      piqueteId: ld.piqueteId ?? "",
      piqueteNome: ld.piqueteNome ?? "",
      gmdEstimado: ld.gmdEstimado ?? 0,
      movimentacoes: movs,
      cmsAtual,
      raca: ld.raca ?? "",
      categoria: ld.categoria ?? "",
      compensatorio: ld.compensatorio ?? "",
      implante: ld.implante ?? "",
      tamanhoCorporal: ld.tamanhoCorporal ?? "",
    });
  }

  // Roteiros ativos
  const roteiros: RoteiroData[] = rotSnap.docs
    .filter((d) => d.data().ativo !== false)
    .map((d) => ({
      id: d.id,
      numero: d.data().numero ?? 0,
      dietaId: d.data().dietaId ?? "",
      dietaNome: d.data().dietaNome ?? "",
      piquetes: d.data().piquetes ?? [],
      minTratos: d.data().minTratos ?? 1,
    }))
    .sort((a, b) => a.numero - b.numero);

  // Build lotes map by piqueteId
  const lotesByPiquete = new Map<string, LoteData>();
  for (const l of lotesData) {
    lotesByPiquete.set(l.piqueteId, l);
  }

  const fatorMaps: FatorMaps = { racaFatorMap, implanteFatorMap, compensFatorMap, aditivoFatorMap, tcFatorMap, gecFatorMap, perdasCocho };

  // Load today's historico
  const histSnap = await queryCollection(["historicoMapaTrato"], [fsWhere("data", "==", hoje)]);
  const historicoCargas = new Map<string, CargaTrato[]>();
  const historicoDescargas = new Map<string, DescargaTrato[]>();
  const percentualMSPorRoteiro = new Map<string, number>();
  for (const hDoc of histSnap.docs) {
    const h = hDoc.data();
    const key = h.roteiroId;
    if (h.cargas?.length > 0) historicoCargas.set(key, h.cargas);
    if (h.descargas?.length > 0) historicoDescargas.set(key, h.descargas);
    if (h.percentualMSFinal) percentualMSPorRoteiro.set(key, h.percentualMSFinal);
  }

  return {
    vagoes,
    roteiros,
    dietasMap,
    insumosMap,
    lotesByPiquete,
    fatorMaps,
    historicoCargas,
    historicoDescargas,
    percentualMSPorRoteiro,
    embarquesHoje,
  };
}
