import { getCollection } from "@/services/firestoreService";

/**
 * Pre-fetches all Firestore collections and subcollections used by the app.
 * This populates the offline cache so the app can work without internet.
 */

type ProgressCallback = (message: string, progress: number) => void;

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
];

export async function prefetchAllData(onProgress?: ProgressCallback): Promise<void> {
  const totalSteps = TOP_LEVEL_COLLECTIONS.length + 3; // +3 for subcollection phases
  let currentStep = 0;

  function reportProgress(message: string) {
    currentStep++;
    onProgress?.(message, Math.min((currentStep / totalSteps) * 100, 100));
  }

  // 1. Fetch all top-level collections
  for (const col of TOP_LEVEL_COLLECTIONS) {
    reportProgress(`Buscando ${col}...`);
    await getCollection(col);
  }

  // 2. Fetch lotes subcollections (movimentacoes, leituras)
  reportProgress("Buscando movimentacoes e leituras dos lotes...");
  const lotesSnap = await getCollection("lotes");
  for (const loteDoc of lotesSnap.docs) {
    await Promise.all([
      getCollection("lotes", loteDoc.id, "movimentacoes"),
      getCollection("lotes", loteDoc.id, "leituras"),
    ]);
  }

  // 3. Fetch insumos subcollections (compras, saidas, conferencias)
  reportProgress("Buscando compras, saidas e conferencias dos insumos...");
  const insumosSnap = await getCollection("insumos");
  for (const insumoDoc of insumosSnap.docs) {
    await Promise.all([
      getCollection("insumos", insumoDoc.id, "compras"),
      getCollection("insumos", insumoDoc.id, "saidas"),
      getCollection("insumos", insumoDoc.id, "conferencias"),
    ]);
  }

  // 4. Done
  reportProgress("Sincronizacao concluida!");
}
