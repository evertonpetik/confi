import { getCollection } from "@/services/firestoreService";

/**
 * Pre-fetches all Firestore collections and subcollections used by the app.
 * This populates the offline cache so the app can work without internet.
 *
 * O progresso é reportado por etapa concluída: cada coleção raiz conta 1,
 * e cada lote/insumo (sub-coleções) conta 1. O total cresce quando o número
 * de lotes/insumos é descoberto, por isso `concluidas`/`total` são informados
 * em vez de um percentual fixo.
 */

type ProgressCallback = (message: string, progress: number, concluidas: number, total: number) => void;

const TOP_LEVEL_COLLECTIONS = [
  "lotes",
  "roteiros",
  "dietas",
  "insumos",
  "produtores",
  "piquetes",
  "raca",
  "categoria",
  "compensatorio",
  "implante",
  "tamanhoCorporal",
  "gec",
  "aditivos",
  "movimentacao",
  "vagao",
  "notaLeitura",
  "historicoMapaTrato",
  "parametros",
  "tanques",
  "veiculos",
  "abastecimentos",
];

export async function prefetchAllData(onProgress?: ProgressCallback): Promise<void> {
  // Coleções raiz + 2 consultas (lotes e insumos) que descobrem as sub-coleções.
  let total = TOP_LEVEL_COLLECTIONS.length + 2;
  let concluidas = 0;

  function reportar(message: string) {
    onProgress?.(message, Math.min((concluidas / total) * 100, 100), concluidas, total);
  }

  // 1. Fetch all top-level collections
  for (const col of TOP_LEVEL_COLLECTIONS) {
    reportar(`Buscando ${col}...`);
    await getCollection(col);
    concluidas++;
  }

  // 2. Fetch lotes subcollections (movimentacoes, leituras)
  reportar("Buscando movimentacoes e leituras dos lotes...");
  const lotesSnap = await getCollection("lotes");
  concluidas++;
  total += lotesSnap.docs.length;
  for (const loteDoc of lotesSnap.docs) {
    reportar("Buscando movimentacoes e leituras dos lotes...");
    await Promise.all([
      getCollection("lotes", loteDoc.id, "movimentacoes"),
      getCollection("lotes", loteDoc.id, "leituras"),
    ]);
    concluidas++;
  }

  // 3. Fetch insumos subcollections (compras, saidas, conferencias)
  reportar("Buscando compras, saidas e conferencias dos insumos...");
  const insumosSnap = await getCollection("insumos");
  concluidas++;
  total += insumosSnap.docs.length;
  for (const insumoDoc of insumosSnap.docs) {
    reportar("Buscando compras, saidas e conferencias dos insumos...");
    await Promise.all([
      getCollection("insumos", insumoDoc.id, "compras"),
      getCollection("insumos", insumoDoc.id, "saidas"),
      getCollection("insumos", insumoDoc.id, "conferencias"),
    ]);
    concluidas++;
  }

  // 4. Done
  concluidas = total;
  reportar("Sincronizacao concluida!");
}
