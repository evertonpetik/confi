import {
  addDocument,
  fsOrderBy,
  queryCollection,
  updateDocument,
} from "@/services/firestoreService";

export type EmbarqueAgendadoDoc = {
  id: string;
  data: string; // yyyy-mm-dd
  quantidade: number;
  observacao?: string;
  status: "agendado" | "cancelado";
  createdAt: string;
};

export async function agendarEmbarque(
  loteId: string,
  params: { data: string; quantidade: number; observacao?: string }
): Promise<void> {
  await addDocument(["lotes", loteId, "embarquesAgendados"], {
    data: params.data,
    quantidade: params.quantidade,
    observacao: params.observacao?.trim() ?? "",
    status: "agendado",
    createdAt: new Date().toISOString(),
  });
}

export async function cancelarEmbarqueAgendado(
  loteId: string,
  embarqueId: string
): Promise<void> {
  await updateDocument(["lotes", loteId, "embarquesAgendados"], embarqueId, {
    status: "cancelado",
  });
}

export async function listarEmbarquesAgendados(
  loteId: string
): Promise<EmbarqueAgendadoDoc[]> {
  const snap = await queryCollection(
    ["lotes", loteId, "embarquesAgendados"],
    [fsOrderBy("data", "asc")]
  );
  return snap.docs
    .map((d) => ({
      id: d.id,
      data: d.data().data as string,
      quantidade: d.data().quantidade as number,
      observacao: d.data().observacao as string | undefined,
      status: d.data().status as "agendado" | "cancelado",
      createdAt: d.data().createdAt as string,
    }))
    .filter((e) => e.status === "agendado");
}

/** Soma a quantidade agendada (status "agendado") de uma lista de docs para uma data específica. */
export function somarEmbarquesAgendadosNaData(
  docs: Pick<EmbarqueAgendadoDoc, "data" | "quantidade" | "status">[],
  data: string
): number {
  return docs
    .filter((d) => d.status === "agendado" && d.data === data)
    .reduce((acc, d) => acc + d.quantidade, 0);
}

/** Retorna o próximo embarque pendente (data >= hoje), somando as quantidades da mesma data. */
export function proximoEmbarqueAgendado(
  docs: Pick<EmbarqueAgendadoDoc, "data" | "quantidade" | "status">[],
  hoje: string
): { data: string; quantidade: number } | null {
  const pendentes = docs.filter((d) => d.status === "agendado" && d.data >= hoje);
  if (pendentes.length === 0) return null;
  const dataMin = pendentes.reduce((min, d) => (d.data < min ? d.data : min), pendentes[0].data);
  return {
    data: dataMin,
    quantidade: pendentes.filter((d) => d.data === dataMin).reduce((acc, d) => acc + d.quantidade, 0),
  };
}
