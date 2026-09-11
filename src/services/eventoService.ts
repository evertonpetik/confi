/**
 * Histórico de eventos dos animais — a espinha dorsal da rastreabilidade.
 *
 * Coleção plana em /fazendas/{fazendaId}/eventos. Plana e não aninhada em
 * bovinos/{id}/eventos porque o fechamento de processo e a auditoria precisam
 * varrer eventos de vários animais de uma vez (por processo, por data).
 *
 * Append-only: nada aqui é editado nem apagado. Um erro se corrige com um
 * evento de estorno apontando para o original.
 */
import {
  addDocument,
  createBatch,
  fsLimit,
  fsOrderBy,
  fsWhere,
  queryCollection,
} from "./firestoreService";
import { Bovino, Evento } from "./weighing.types";

// Leitura da linha do tempo fica em ./eventoUtils (puro, sem Firestore).
export * from "./eventoUtils";

const colEventos = (fazendaId: string) => ["fazendas", fazendaId, "eventos"];

/** Campos do evento que sempre saem do animal, para não repetir em cada chamada. */
export type NovoEvento = Omit<
  Evento,
  "id" | "animalId" | "sisbov" | "manejo" | "farmedaId" | "criadoEm"
>;

export class EventoService {
  /** Registra um evento para um animal. */
  static async registrar(
    animal: Pick<Bovino, "id" | "sisbov" | "manejo">,
    evento: NovoEvento,
    fazendaId: string
  ): Promise<string> {
    const doc = await addDocument(colEventos(fazendaId), {
      ...montar(animal, evento, fazendaId),
    });
    return doc.id;
  }

  /**
   * Registra vários eventos do mesmo animal de uma vez.
   *
   * Uma passagem pelo mangueiro costuma gerar cadastro + pesagem + movimentação
   * + N sanitários. Em lote eles compartilham o mesmo instante e ou entram
   * todos, ou nenhum — sem histórico pela metade se a conexão cair no meio.
   */
  static async registrarLote(
    animal: Pick<Bovino, "id" | "sisbov" | "manejo">,
    eventos: NovoEvento[],
    fazendaId: string
  ): Promise<void> {
    if (eventos.length === 0) return;

    const batch = createBatch();
    for (const evento of eventos) {
      batch.set(colEventos(fazendaId), montar(animal, evento, fazendaId));
    }
    await batch.commit();
  }

  /** Linha do tempo de um animal, do mais recente para o mais antigo. */
  static async listarDoAnimal(
    animalId: string,
    fazendaId: string,
    limite = 200
  ): Promise<Evento[]> {
    const snap = await queryCollection(colEventos(fazendaId), [
      fsWhere("animalId", "==", animalId),
      fsOrderBy("dataHora", "desc"),
      fsLimit(limite),
    ]);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Evento));
  }

  /** Eventos mais recentes da fazenda, para o histórico geral. */
  static async listarRecentes(fazendaId: string, limite = 300): Promise<Evento[]> {
    const snap = await queryCollection(colEventos(fazendaId), [
      fsOrderBy("dataHora", "desc"),
      fsLimit(limite),
    ]);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Evento));
  }

  /** Eventos de um processo, em ordem cronológica de execução. */
  static async listarDoProcesso(
    processoId: string,
    fazendaId: string,
    limite = 2000
  ): Promise<Evento[]> {
    const snap = await queryCollection(colEventos(fazendaId), [
      fsWhere("processoId", "==", processoId),
      fsOrderBy("dataHora", "asc"),
      fsLimit(limite),
    ]);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Evento));
  }

  /**
   * Estorna um evento. Não apaga: grava um evento de estorno apontando para o
   * original, preservando a trilha para auditoria.
   */
  static async estornar(
    animal: Pick<Bovino, "id" | "sisbov" | "manejo">,
    eventoOriginal: Evento,
    usuarioId: string,
    fazendaId: string,
    motivo?: string
  ): Promise<string> {
    return this.registrar(
      animal,
      {
        tipo: "estorno",
        dataHora: new Date().toISOString(),
        eventoEstornadoId: eventoOriginal.id,
        processoId: eventoOriginal.processoId,
        observacoes: motivo ?? `Estorno de ${eventoOriginal.tipo}`,
        usuarioId,
        origem: "manual",
      },
      fazendaId
    );
  }
}

function montar(
  animal: Pick<Bovino, "id" | "sisbov" | "manejo">,
  evento: NovoEvento,
  fazendaId: string
): Omit<Evento, "id"> {
  // Firestore rejeita `undefined`; campos vazios simplesmente não vão ao doc.
  const limpo = Object.fromEntries(
    Object.entries(evento).filter(([, v]) => v !== undefined)
  ) as NovoEvento;

  return {
    ...limpo,
    animalId: animal.id,
    sisbov: animal.sisbov,
    manejo: animal.manejo,
    farmedaId: fazendaId,
    criadoEm: new Date().toISOString(),
  };
}

export default EventoService;
