import {
  getRawCollection,
  setRawDocument,
} from "@/services/firestoreService";

/**
 * Migra todos os dados das colecoes de nivel raiz para dentro de
 * fazendas/{fazendaId}/. Preserva IDs dos documentos.
 * Usar apenas uma vez para migrar dados existentes.
 */

type ProgressCallback = (message: string) => void;

const SIMPLE_COLLECTIONS = [
  "raca",
  "categoria",
  "compensatorio",
  "implante",
  "tamanhoCorporal",
  "gec",
  "aditivos",
  "piquetes",
  "vagao",
  "notaLeitura",
  "movimentacao",
  "dietas",
  "roteiros",
  "produtores",
  "historicoMapaTrato",
  "parametros",
];

export async function migrateToMultiTenant(
  fazendaId: string,
  onProgress?: ProgressCallback
): Promise<string> {
  let migrated = 0;

  // 1. Colecoes simples (sem subcolecoes)
  for (const col of SIMPLE_COLLECTIONS) {
    onProgress?.(`Migrando ${col}...`);
    const snap = await getRawCollection(col);
    for (const doc of snap.docs) {
      await setRawDocument(
        ["fazendas", fazendaId, col],
        doc.id,
        doc.data(),
        { merge: true }
      );
      migrated++;
    }
  }

  // 2. Lotes + subcolecoes
  onProgress?.("Migrando lotes...");
  const lotesSnap = await getRawCollection("lotes");
  for (const loteDoc of lotesSnap.docs) {
    await setRawDocument(
      ["fazendas", fazendaId, "lotes"],
      loteDoc.id,
      loteDoc.data(),
      { merge: true }
    );
    migrated++;

    // Movimentacoes
    const movsSnap = await getRawCollection("lotes", loteDoc.id, "movimentacoes");
    for (const movDoc of movsSnap.docs) {
      await setRawDocument(
        ["fazendas", fazendaId, "lotes", loteDoc.id, "movimentacoes"],
        movDoc.id,
        movDoc.data(),
        { merge: true }
      );
      migrated++;
    }

    // Leituras
    const leitSnap = await getRawCollection("lotes", loteDoc.id, "leituras");
    for (const leitDoc of leitSnap.docs) {
      await setRawDocument(
        ["fazendas", fazendaId, "lotes", loteDoc.id, "leituras"],
        leitDoc.id,
        leitDoc.data(),
        { merge: true }
      );
      migrated++;
    }
  }

  // 3. Insumos + subcolecoes
  onProgress?.("Migrando insumos...");
  const insumosSnap = await getRawCollection("insumos");
  for (const insumoDoc of insumosSnap.docs) {
    await setRawDocument(
      ["fazendas", fazendaId, "insumos"],
      insumoDoc.id,
      insumoDoc.data(),
      { merge: true }
    );
    migrated++;

    // Compras
    const comprasSnap = await getRawCollection("insumos", insumoDoc.id, "compras");
    for (const compraDoc of comprasSnap.docs) {
      await setRawDocument(
        ["fazendas", fazendaId, "insumos", insumoDoc.id, "compras"],
        compraDoc.id,
        compraDoc.data(),
        { merge: true }
      );
      migrated++;
    }

    // Saidas
    const saidasSnap = await getRawCollection("insumos", insumoDoc.id, "saidas");
    for (const saidaDoc of saidasSnap.docs) {
      await setRawDocument(
        ["fazendas", fazendaId, "insumos", insumoDoc.id, "saidas"],
        saidaDoc.id,
        saidaDoc.data(),
        { merge: true }
      );
      migrated++;
    }

    // Conferencias
    const confsSnap = await getRawCollection("insumos", insumoDoc.id, "conferencias");
    for (const confDoc of confsSnap.docs) {
      await setRawDocument(
        ["fazendas", fazendaId, "insumos", insumoDoc.id, "conferencias"],
        confDoc.id,
        confDoc.data(),
        { merge: true }
      );
      migrated++;
    }
  }

  onProgress?.("Migracao concluida!");
  return `Migracao concluida. ${migrated} documentos migrados para fazendas/${fazendaId}.`;
}
