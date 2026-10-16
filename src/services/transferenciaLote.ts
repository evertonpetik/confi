import {
  addDocument,
  getCollection,
  updateDocument,
} from "@/services/firestoreService";

export type TransferenciaParams = {
  origemId: string;
  origemNumero: number;
  origemPiqueteId: string;
  destinoId: string;
  destinoNumero: number;
  quantidade: number;
  pesoMedio: number;
  data: string; // yyyy-mm-dd
  observacao?: string;
  qtdAtualOrigem: number;
};

export type TransferenciaResult = {
  origemInativado: boolean;
};

/**
 * Transfere animais entre lotes: gera Saída na origem e Entrada no destino.
 * Se o saldo da origem zerar, inativa o lote e remove o piquete dos roteiros
 * (mesma regra aplicada quando a quantidade chega a zero por outra saída).
 */
export async function transferirEntreLotes(
  params: TransferenciaParams
): Promise<TransferenciaResult> {
  const obs = params.observacao?.trim() ?? "";

  await Promise.all([
    addDocument(["lotes", params.origemId, "movimentacoes"], {
      evento: "Saida",
      movimentacao: "Transferência",
      data: params.data,
      quantidade: params.quantidade,
      pesoMedio: params.pesoMedio,
      observacao: obs
        ? `Transferido para o Lote ${params.destinoNumero} — ${obs}`
        : `Transferido para o Lote ${params.destinoNumero}`,
    }),
    addDocument(["lotes", params.destinoId, "movimentacoes"], {
      evento: "Entrada",
      movimentacao: "Transferência",
      data: params.data,
      quantidade: params.quantidade,
      pesoMedio: params.pesoMedio,
      observacao: obs
        ? `Recebido do Lote ${params.origemNumero} — ${obs}`
        : `Recebido do Lote ${params.origemNumero}`,
    }),
  ]);

  const origemInativado = params.qtdAtualOrigem - params.quantidade <= 0;
  if (origemInativado) {
    await updateDocument(["lotes"], params.origemId, {
      ativo: false,
      piqueteId: "",
      piqueteNome: "",
    });

    if (params.origemPiqueteId) {
      const rotSnap = await getCollection("roteiros");
      for (const rDoc of rotSnap.docs) {
        const piquetes = (rDoc.data().piquetes ?? []) as {
          piqueteId: string;
          piqueteNome: string;
        }[];
        const filtered = piquetes.filter(
          (p) => p.piqueteId !== params.origemPiqueteId
        );
        if (filtered.length !== piquetes.length) {
          await updateDocument(["roteiros"], rDoc.id, { piquetes: filtered });
        }
      }
    }
  }

  return { origemInativado };
}
