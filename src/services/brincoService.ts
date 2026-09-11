import { Platform } from "react-native";
import {
  addDocument,
  deleteDocument,
  fsOrderBy,
  getCollection,
  getDocument,
  queryCollection,
  setDocument,
  updateDocument,
} from "./firestoreService";
import { gerarCsvPlanilhaCampo } from "./planilhaCampo";
import { manejoFromSisbov, sisbovByIndex, totalSisbov } from "./sisbov";
import { Bovino, BrincoAnulado, GTA, LocalAnimal, PedidoBrinco, ProcessoMangueiro, ProcessoSisbov } from "./weighing.types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

// As regras de numeração vivem em ./sisbov. Reexportadas aqui para quem já
// importa deste módulo.
export {
  chipConfereComManejo,
  dvSisbov,
  manejoFromSisbov,
  sisbovByIndex,
  totalSisbov,
  validarSisbov,
} from "./sisbov";

// ─── PedidoBrinco ─────────────────────────────────────────────────────────────

// Caminhos das coleções aninhadas de uma fazenda
const col = (faz: string, sub: string) => ["fazendas", faz, sub];

export class BrincoService {
  static async cadastrarPedido(
    pedido: Omit<PedidoBrinco, "id" | "criadoEm">,
    fazendaId: string
  ): Promise<string> {
    const doc = await addDocument(col(fazendaId, "pedidos_brinco"), { ...pedido, criadoEm: new Date().toISOString() });
    return doc.id;
  }

  static async listarPedidos(fazendaId: string): Promise<PedidoBrinco[]> {
    const snap = await queryCollection(col(fazendaId, "pedidos_brinco"), [fsOrderBy("criadoEm", "desc")]);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PedidoBrinco));
  }

  static async atualizarPedido(pedido: PedidoBrinco, fazendaId: string): Promise<void> {
    await updateDocument(col(fazendaId, "pedidos_brinco"), pedido.id!, { ...pedido, atualizadoEm: new Date().toISOString() });
  }

  /** Reserva o próximo brinco usando transação (nativa) ou leitura+escrita seq (web). */
  static async reservarBrinco(
    pedidoId: string,
    fazendaId: string
  ): Promise<{ brinco: string; controle: string } | null> {
    if (Platform.OS === "web") {
      // Web: leitura simples seguida de escrita (risco mínimo — web é uso admin)
      const snap = await getDocument(col(fazendaId, "pedidos_brinco"), pedidoId);
      if (!snap.exists) return null;
      const pedido = snap.data() as PedidoBrinco;
      if (pedido.proximoIndice >= pedido.brincosTotal) return null;
      const brinco = sisbovByIndex(pedido.sisbovInicial, pedido.proximoIndice);
      await updateDocument(col(fazendaId, "pedidos_brinco"), pedidoId, { proximoIndice: pedido.proximoIndice + 1 });
      return { brinco, controle: manejoFromSisbov(brinco) };
    }

    // Native: transação atômica
    const nativeFs = require("@react-native-firebase/firestore").default;
    const ref = nativeFs().collection("fazendas").doc(fazendaId).collection("pedidos_brinco").doc(pedidoId);
    return nativeFs().runTransaction(async (tx: any) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return null;
      const pedido = snap.data() as PedidoBrinco;
      if (pedido.proximoIndice >= pedido.brincosTotal) return null;
      const brinco = sisbovByIndex(pedido.sisbovInicial, pedido.proximoIndice);
      tx.update(ref, { proximoIndice: pedido.proximoIndice + 1 });
      return { brinco, controle: manejoFromSisbov(brinco) };
    });
  }

  /**
   * Devolve o último brinco reservado ao pedido.
   *
   * Só faz sentido logo após a reserva (desfazer no mangueiro): se outro
   * animal já consumiu um brinco depois deste, decrementar reaproveitaria um
   * número já aplicado. Por isso nunca desce abaixo de zero e o desfazer é
   * oferecido apenas para a última gravação.
   */
  static async devolverBrinco(pedidoId: string, fazendaId: string): Promise<void> {
    const snap = await getDocument(col(fazendaId, "pedidos_brinco"), pedidoId);
    if (!snap.exists) return;
    const pedido = snap.data() as PedidoBrinco;
    await updateDocument(col(fazendaId, "pedidos_brinco"), pedidoId, {
      proximoIndice: Math.max(0, (pedido.proximoIndice ?? 0) - 1),
    });
  }

  /**
   * Descarta o próximo brinco da sequência sem aplicá-lo em animal.
   *
   * Brinco vem com defeito de fábrica, quebra na hora de aplicar ou o chip
   * nasce morto — nesses casos o número precisa sair da fila. Fica registrado
   * em `anulados` porque a certificadora cobra explicação por número que
   * saltou: sem o registro, o brinco parece ter desaparecido.
   */
  static async anularBrinco(
    pedidoId: string,
    motivo: BrincoAnulado["motivo"],
    usuarioId: string,
    fazendaId: string,
    observacoes?: string
  ): Promise<BrincoAnulado | null> {
    const snap = await getDocument(col(fazendaId, "pedidos_brinco"), pedidoId);
    if (!snap.exists) return null;

    const pedido = snap.data() as PedidoBrinco;
    if (pedido.proximoIndice >= pedido.brincosTotal) return null;

    const sisbov = sisbovByIndex(pedido.sisbovInicial, pedido.proximoIndice);
    const anulado: BrincoAnulado = {
      sisbov,
      manejo: manejoFromSisbov(sisbov),
      motivo,
      observacoes,
      dataHora: new Date().toISOString(),
      usuarioId,
    };

    await updateDocument(col(fazendaId, "pedidos_brinco"), pedidoId, {
      proximoIndice: pedido.proximoIndice + 1,
      anulados: [...(pedido.anulados ?? []), anulado],
      atualizadoEm: new Date().toISOString(),
    });

    return anulado;
  }

  // ─── GTA ────────────────────────────────────────────────────────────────────

  static async cadastrarGta(
    gta: Omit<GTA, "id" | "criadoEm">,
    fazendaId: string
  ): Promise<string> {
    const doc = await addDocument(col(fazendaId, "gtas"), { ...gta, criadoEm: new Date().toISOString() });
    return doc.id;
  }

  static async listarGtas(fazendaId: string): Promise<GTA[]> {
    const snap = await queryCollection(col(fazendaId, "gtas"), [fsOrderBy("dataEmissao", "desc")]);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as GTA));
  }

  static async obterGta(gtaId: string, fazendaId: string): Promise<GTA | null> {
    const snap = await getDocument(col(fazendaId, "gtas"), gtaId);
    if (!snap.exists) return null;
    return { id: snap.id, ...snap.data() } as GTA;
  }

  static async atualizarStatusGta(
    gtaId: string,
    status: GTA["status"],
    fazendaId: string
  ): Promise<void> {
    await updateDocument(col(fazendaId, "gtas"), gtaId, { status, atualizadoEm: new Date().toISOString() });
  }

  /**
   * Exclui uma GTA importada errado, junto do PDF arquivado.
   *
   * Só faz sentido para guia ainda não vinculada a processo: se já houver
   * animais manejados contra ela, apagar deixaria o processo sem a origem que
   * a certificadora vai pedir. Quem chama garante isso.
   */
  static async excluirGta(gta: GTA, fazendaId: string): Promise<void> {
    await deleteDocument(col(fazendaId, "gtas"), gta.id!);
    if (gta.pdfPath) {
      try {
        const { deleteFile } = await import("./storageService");
        await deleteFile(gta.pdfPath);
      } catch (e) {
        // O documento já saiu; PDF órfão no bucket não atrapalha o uso.
        console.warn("[GTA] documento excluído, mas o PDF permaneceu:", e);
      }
    }
  }

  // ─── LocalAnimal ────────────────────────────────────────────────────────────

  static async salvarLocal(local: LocalAnimal, fazendaId: string): Promise<string> {
    if (local.id) {
      await setDocument(col(fazendaId, "locais"), local.id, { ...local, atualizadoEm: new Date().toISOString() }, { merge: true });
      return local.id;
    }
    const doc = await addDocument(col(fazendaId, "locais"), { ...local, criadoEm: new Date().toISOString() });
    return doc.id;
  }

  /**
   * Locais ativos da fazenda.
   *
   * Filtra e ordena em memória: `where + orderBy` exigiria índice composto, e
   * são dezenas de piquetes e baias — não vale fazer a tela depender de um
   * índice publicado.
   */
  static async listarLocais(fazendaId: string): Promise<LocalAnimal[]> {
    const snap = await getCollection(...col(fazendaId, "locais"));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as LocalAnimal))
      .filter((l) => l.ativo !== false)
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }

  static async excluirLocal(localId: string, fazendaId: string): Promise<void> {
    await updateDocument(col(fazendaId, "locais"), localId, { ativo: false });
  }

  // ─── ProcessoSisbov ──────────────────────────────────────────────────────────

  static async criarProcesso(
    processo: Omit<ProcessoSisbov, "id" | "criadoEm">,
    fazendaId: string
  ): Promise<string> {
    const doc = await addDocument(col(fazendaId, "processos_sisbov"), { ...processo, criadoEm: new Date().toISOString() });
    return doc.id;
  }

  static async listarProcessos(fazendaId: string): Promise<ProcessoSisbov[]> {
    const snap = await queryCollection(col(fazendaId, "processos_sisbov"), [fsOrderBy("criadoEm", "desc")]);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ProcessoSisbov));
  }

  static async atualizarProcesso(
    processoId: string,
    dados: Partial<ProcessoSisbov>,
    fazendaId: string
  ): Promise<void> {
    await updateDocument(col(fazendaId, "processos_sisbov"), processoId, { ...dados, atualizadoEm: new Date().toISOString() });
  }

  // ─── Planilha de Campo ────────────────────────────────────────────────────────

  /** Planilha de campo da certificadora. Implementação em ./planilhaCampo. */
  static gerarCsvPlanilhaCampo(animais: Bovino[]): string {
    return gerarCsvPlanilhaCampo(animais);
  }

  // ─── ProcessoMangueiro ───────────────────────────────────────────────────────

  static async criarProcessoMangueiro(
    processo: Omit<ProcessoMangueiro, "id" | "criadoEm">,
    fazendaId: string
  ): Promise<string> {
    const doc = await addDocument(col(fazendaId, "processos_mangueiro"), { ...processo, criadoEm: new Date().toISOString() });
    return doc.id;
  }

  static async listarProcessosMangueiro(fazendaId: string): Promise<ProcessoMangueiro[]> {
    const snap = await queryCollection(col(fazendaId, "processos_mangueiro"), [fsOrderBy("criadoEm", "desc")]);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ProcessoMangueiro));
  }

  static async obterProcessoMangueiro(processoId: string, fazendaId: string): Promise<ProcessoMangueiro | null> {
    const snap = await getDocument(col(fazendaId, "processos_mangueiro"), processoId);
    if (!snap.exists) return null;
    return { id: snap.id, ...snap.data() } as ProcessoMangueiro;
  }

  static async atualizarProcessoMangueiro(
    processoId: string,
    dados: Partial<ProcessoMangueiro>,
    fazendaId: string
  ): Promise<void> {
    await updateDocument(col(fazendaId, "processos_mangueiro"), processoId, { ...dados, atualizadoEm: new Date().toISOString() });
  }

  /** Incrementa animaisManejados — transação atômica no native, seq no web. */
  /** Reverte um animal do contador do processo (desfazer no mangueiro). */
  static async decrementarManejados(processoId: string, fazendaId: string): Promise<void> {
    const snap = await getDocument(col(fazendaId, "processos_mangueiro"), processoId);
    if (!snap.exists) return;
    const p = snap.data() as ProcessoMangueiro;
    const manejados = Math.max(0, (p.animaisManejados ?? 0) - 1);
    await updateDocument(col(fazendaId, "processos_mangueiro"), processoId, {
      animaisManejados: manejados,
      // Voltar abaixo do previsto reabre o processo que tinha sido concluído
      status: manejados >= (p.totalAnimaisPrevisto ?? 0) ? "concluido" : "em_andamento",
      atualizadoEm: new Date().toISOString(),
    });
  }

  static async incrementarManejados(processoId: string, fazendaId: string): Promise<void> {
    if (Platform.OS === "web") {
      const snap = await getDocument(col(fazendaId, "processos_mangueiro"), processoId);
      if (!snap.exists) return;
      const p = snap.data() as ProcessoMangueiro;
      const novoManejados = (p.animaisManejados ?? 0) + 1;
      const novoStatus = novoManejados >= (p.totalAnimaisPrevisto ?? 0) ? "concluido" : "em_andamento";
      await updateDocument(col(fazendaId, "processos_mangueiro"), processoId, {
        animaisManejados: novoManejados,
        status: novoStatus,
        ...(novoStatus === "concluido" ? { dataConclusao: new Date().toISOString() } : {}),
        atualizadoEm: new Date().toISOString(),
      });
      return;
    }

    // Native: transação atômica
    const nativeFs = require("@react-native-firebase/firestore").default;
    const ref = nativeFs().collection("fazendas").doc(fazendaId).collection("processos_mangueiro").doc(processoId);
    await nativeFs().runTransaction(async (tx: any) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return;
      const p = snap.data() as ProcessoMangueiro;
      const novoManejados = (p.animaisManejados ?? 0) + 1;
      const novoStatus = novoManejados >= (p.totalAnimaisPrevisto ?? 0) ? "concluido" : "em_andamento";
      tx.update(ref, {
        animaisManejados: novoManejados,
        status: novoStatus,
        ...(novoStatus === "concluido" ? { dataConclusao: new Date().toISOString() } : {}),
        atualizadoEm: new Date().toISOString(),
      });
    });
  }
}

export default BrincoService;
