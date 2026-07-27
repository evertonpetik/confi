/**
 * agentTools.ts
 *
 * Define as "tools" (function calling) que o agente Claude pode chamar,
 * e a implementação de cada uma, reaproveitando firestoreServiceServer.ts e
 * loteCalcCore.ts (versão sem dependência de react-native das funções de
 * cálculo de mapaTratoCalc.ts — ver comentário em loteCalcCore.ts).
 *
 * Assinaturas confirmadas contra o código real (não mais suposição):
 *   - getCollection(...colPath: string[])
 *   - queryCollection(colPath: string[], constraints: QueryConstraint[])
 *   - addDocument(colPath: string[], data)
 *   - calcQtdAtual(movs: { evento, quantidade, pesoMedio, data }[]): number
 *   - calcPesoMedio(movs, gmd: number): number
 *   - CMS_INICIAL = 1.3 (exportado)
 *   - getHojeStr(date?: Date): string "YYYY-MM-DD"
 */

// Funções serverless da Vercel rodam em UTC por padrão. getHojeStr() (importado
// de loteCalcCore.ts) usa new Date() com métodos locais — sem isso, à noite em
// MS (UTC-4) o servidor já estaria "no dia seguinte" em UTC, gerando datas
// diferentes das que o app mobile grava. Fixamos o fuso do processo uma única
// vez, no carregamento do módulo (não precisa reset — não é estado por request).
process.env.TZ = "America/Campo_Grande";

import {
  getCollection,
  queryCollection,
  addDocument,
  fsWhere,
  fsOrderBy,
  fsLimit,
} from "./firestoreServiceServer";

import {
  calcQtdAtual,
  calcPesoMedio,
  CMS_INICIAL,
  getHojeStr,
} from "../utils/loteCalcCore";

// CMS_BASE não é exportado por mapaTratoCalc.ts — vive hardcoded em leitura.tsx.
// Mantenha esse valor sincronizado com o de lá caso você o altere no app.
const CMS_BASE = 2.6;

// ---------------------------------------------------------------------------
// 1. Definição das tools no formato que a Claude API espera
// ---------------------------------------------------------------------------

export const AGENT_TOOLS = [
  {
    name: "consultar_lote",
    description:
      "Consulta o status atual de um lote: quantidade de animais, peso médio projetado, GMD estimado, CMS atual e piquete.",
    input_schema: {
      type: "object",
      properties: {
        numero: { type: "number", description: "Número do lote" },
      },
      required: ["numero"],
    },
  },
  {
    name: "consultar_dashboard",
    description:
      "Retorna os KPIs gerais do confinamento: lotes ativos, total de animais, entradas, vendas e mortes.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "registrar_leitura_cocho",
    description:
      "Registra a leitura de cocho (nota de 1 a 5) para um piquete/lote, que ajusta automaticamente o CMS.",
    input_schema: {
      type: "object",
      properties: {
        piqueteNome: { type: "string", description: "Nome/número do piquete avaliado" },
        nota: { type: "number", description: "Nota da leitura, de 1 a 5" },
      },
      required: ["piqueteNome", "nota"],
    },
  },
  {
    name: "consultar_estoque_insumo",
    description: "Consulta o estoque atual e o preço médio de um insumo pelo nome.",
    input_schema: {
      type: "object",
      properties: {
        nome: { type: "string", description: "Nome do insumo (ex: milho, ureia)" },
      },
      required: ["nome"],
    },
  },
  {
    name: "consultar_historico_gmd",
    description: "Consulta o GMD real (ganho médio diário) de um lote nos últimos N dias.",
    input_schema: {
      type: "object",
      properties: {
        numeroLote: { type: "number", description: "Número do lote" },
        dias: { type: "number", description: "Quantidade de dias no histórico (padrão 7)" },
      },
      required: ["numeroLote"],
    },
  },
] as const;

// ---------------------------------------------------------------------------
// Helper: replica a lógica de prioridade de CMS usada em fetchMapaTratoData()
// (seção 5.4 da documentação): leitura de hoje > CMS realizado de ontem
// (historicoMapaTrato) > última leitura anterior > CMS_INICIAL.
// ---------------------------------------------------------------------------

async function getCmsAtualLote(loteId: string): Promise<number> {
  const hoje = getHojeStr();

  const leiturasSnap = await queryCollection(
    ["lotes", loteId, "leituras"],
    [fsOrderBy("data", "desc"), fsLimit(1)]
  );
  const ultimaLeitura = leiturasSnap.docs[0]?.data();

  if (ultimaLeitura && ultimaLeitura.data === hoje) {
    return ultimaLeitura.cmsNovo ?? CMS_INICIAL;
  }

  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  const ontemStr = getHojeStr(ontem);

  const histSnap = await queryCollection(
    ["historicoMapaTrato"],
    [fsWhere("data", "==", ontemStr)]
  );
  for (const hDoc of histSnap.docs) {
    const msPorLote = hDoc.data().msPorLote as
      | { loteId: string; cmsRealizado?: number }[]
      | undefined;
    const entry = msPorLote?.find((m) => m.loteId === loteId);
    if (entry?.cmsRealizado && entry.cmsRealizado > 0) {
      return entry.cmsRealizado;
    }
  }

  return ultimaLeitura?.cmsNovo ?? CMS_INICIAL;
}

// ---------------------------------------------------------------------------
// 2. Implementação de cada tool
// ---------------------------------------------------------------------------

export async function consultarLote(numero: number) {
  const snapshot = await queryCollection(["lotes"], [fsWhere("numero", "==", numero)]);
  if (snapshot.empty) {
    return { erro: `Lote ${numero} não encontrado.` };
  }

  const loteDoc = snapshot.docs[0];
  const lote = loteDoc.data();

  const [movimentacoesSnap, cmsAtual] = await Promise.all([
    getCollection("lotes", loteDoc.id, "movimentacoes"),
    getCmsAtualLote(loteDoc.id),
  ]);

  const movimentacoes = movimentacoesSnap.docs.map((d) => d.data());
  const qtdAtual = calcQtdAtual(movimentacoes);
  const pesoMedio = calcPesoMedio(movimentacoes, lote.gmdEstimado);

  return {
    numero: lote.numero,
    piquete: lote.piqueteNome,
    dieta: lote.dietaNome,
    produtor: lote.produtor,
    quantidadeAtual: qtdAtual,
    pesoMedioEstimado: Math.round(pesoMedio * 10) / 10,
    gmdEstimado: lote.gmdEstimado,
    cmsAtual,
    ativo: lote.ativo,
  };
}

export async function consultarDashboard() {
  const lotesSnap = await getCollection("lotes");
  const lotes = lotesSnap.docs.map((d) => d.data());

  const lotesAtivos = lotes.filter((l) => l.ativo);

  let totalAnimais = 0;
  let vendas = 0;
  let mortes = 0;
  let entradas = 0;

  for (const doc of lotesSnap.docs) {
    const movSnap = await getCollection("lotes", doc.id, "movimentacoes");
    const movs = movSnap.docs.map((d) => d.data());
    totalAnimais += calcQtdAtual(movs);
    entradas += movs
      .filter((m) => m.evento === "Entrada")
      .reduce((acc, m) => acc + m.quantidade, 0);
    vendas += movs
      .filter((m) => m.movimentacao === "Venda")
      .reduce((acc, m) => acc + m.quantidade, 0);
    mortes += movs
      .filter((m) => m.movimentacao === "Morte")
      .reduce((acc, m) => acc + m.quantidade, 0);
  }

  return {
    lotesAtivos: lotesAtivos.length,
    totalAnimais,
    entradas,
    vendas,
    mortes,
  };
}

export async function registrarLeituraCocho(piqueteNome: string, nota: number) {
  // Fatores por nota — dados de seed conforme seção 5.4 da documentação.
  // Se o admin editar esses valores na coleção `notaLeitura` do app, esta
  // tabela fica dessincronizada. Se isso for um problema no seu uso real,
  // troque por uma consulta a queryCollection(["notaLeitura"], ...).
  const fatoresPorNota: Record<number, number> = {
    1: 1.1,
    2: 1.03,
    3: 1.0,
    4: 0.97,
    5: 0.9,
  };

  const fator = fatoresPorNota[nota];
  if (!fator) {
    return { erro: "Nota inválida. Use um valor de 1 a 5." };
  }

  const lotesSnap = await queryCollection(
    ["lotes"],
    [fsWhere("piqueteNome", "==", piqueteNome), fsWhere("ativo", "==", true)]
  );

  if (lotesSnap.empty) {
    return { erro: `Nenhum lote ativo encontrado no piquete ${piqueteNome}.` };
  }

  const loteDoc = lotesSnap.docs[0];

  // Mesma prioridade de CMS usada em leitura.tsx / fetchMapaTratoData:
  // leitura de hoje > realizado de ontem > leitura anterior > CMS_INICIAL
  const cmsAnterior = await getCmsAtualLote(loteDoc.id);
  const cmsNovo = Math.round((cmsAnterior + CMS_BASE * (fator - 1)) * 100) / 100;

  await addDocument(["lotes", loteDoc.id, "leituras"], {
    data: getHojeStr(),
    nota: String(nota),
    fator,
    cmsAnterior,
    cmsNovo,
  });

  return {
    piquete: piqueteNome,
    lote: loteDoc.data().numero,
    nota,
    cmsAnterior,
    cmsNovo,
    mensagem: `Leitura registrada. CMS ajustado de ${cmsAnterior}% para ${cmsNovo}%.`,
  };
}

export async function consultarEstoqueInsumo(nome: string) {
  const insumosSnap = await queryCollection(
    ["insumos"],
    [fsWhere("nome", "==", nome)]
  );

  if (insumosSnap.empty) {
    return { erro: `Insumo "${nome}" não encontrado.` };
  }

  const insumoDoc = insumosSnap.docs[0];
  const [comprasSnap, saidasSnap] = await Promise.all([
    getCollection("insumos", insumoDoc.id, "compras"),
    getCollection("insumos", insumoDoc.id, "saidas"),
  ]);

  const eventos = [
    ...comprasSnap.docs.map((d) => ({ ...d.data(), tipo: "compra" as const })),
    ...saidasSnap.docs.map((d) => ({ ...d.data(), tipo: "saida" as const })),
  ].sort((a, b) => a.data.localeCompare(b.data));

  let estoque = 0;
  let valorTotal = 0;
  for (const ev of eventos) {
    if (ev.tipo === "compra") {
      estoque += ev.quantidade;
      valorTotal += ev.quantidade * ev.precoKg;
    } else {
      const avgMomento = estoque > 0 ? valorTotal / estoque : 0;
      valorTotal -= ev.quantidade * avgMomento;
      estoque -= ev.quantidade;
    }
  }

  const precoMedio = estoque > 0 ? valorTotal / estoque : 0;

  return {
    nome,
    estoqueKg: Math.round(estoque * 10) / 10,
    precoMedioKg: Math.round(precoMedio * 100) / 100,
  };
}

export async function consultarHistoricoGMD(numeroLote: number, dias = 7) {
  const lotesSnap = await queryCollection(["lotes"], [fsWhere("numero", "==", numeroLote)]);
  if (lotesSnap.empty) {
    return { erro: `Lote ${numeroLote} não encontrado.` };
  }
  const loteId = lotesSnap.docs[0].id;

  const historicoSnap = await queryCollection(
    ["historicoMapaTrato"],
    [fsOrderBy("data", "desc"), fsLimit(dias)]
  );

  const registros = historicoSnap.docs
    .map((d) => d.data())
    .map((h) => {
      const msPorLote = (h.msPorLote ?? []).find((x: any) => x.loteId === loteId);
      return msPorLote ? { data: h.data, gmdReal: msPorLote.gmdReal } : null;
    })
    .filter(Boolean);

  if (registros.length === 0) {
    return { erro: `Sem histórico de GMD para o lote ${numeroLote} no período.` };
  }

  const media =
    registros.reduce((acc: number, r: any) => acc + r.gmdReal, 0) / registros.length;

  return {
    numeroLote,
    registros,
    gmdRealMedio: Math.round(media * 1000) / 1000,
  };
}

// ---------------------------------------------------------------------------
// 3. Roteador: dado o nome da tool e o input, executa e retorna o resultado
// ---------------------------------------------------------------------------

export async function executarTool(nome: string, input: any) {
  switch (nome) {
    case "consultar_lote":
      return consultarLote(input.numero);
    case "consultar_dashboard":
      return consultarDashboard();
    case "registrar_leitura_cocho":
      return registrarLeituraCocho(input.piqueteNome, input.nota);
    case "consultar_estoque_insumo":
      return consultarEstoqueInsumo(input.nome);
    case "consultar_historico_gmd":
      return consultarHistoricoGMD(input.numeroLote, input.dias ?? 7);
    default:
      return { erro: `Tool desconhecida: ${nome}` };
  }
}
