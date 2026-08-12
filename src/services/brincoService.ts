import { Platform } from "react-native";
import {
  addDocument,
  fsOrderBy,
  fsWhere,
  getDocument,
  queryCollection,
  setDocument,
  updateDocument,
} from "./firestoreService";
import { Bovino, GTA, LocalAnimal, PedidoBrinco, ProcessoMangueiro, ProcessoSisbov } from "./weighing.types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extrai o número de controle (6 dígitos) do brinco de 15 dígitos (posições 9-14, base-1) */
export function controleFromBrinco(brinco: string): string {
  return brinco.slice(8, 14);
}

/** Calcula o brinco de 15 dígitos a partir do brinco inicial + índice (0-based) */
export function brincoByIndex(brincoInicial: string, index: number): string {
  const num = BigInt(brincoInicial) + BigInt(index);
  return num.toString().padStart(15, "0");
}

/** Calcula o total de brincos em um intervalo (inclusive) */
export function calcularTotalBrincos(inicial: string, final: string): number {
  return Number(BigInt(final) - BigInt(inicial)) + 1;
}

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
      const brinco = brincoByIndex(pedido.brincoInicial, pedido.proximoIndice);
      await updateDocument(col(fazendaId, "pedidos_brinco"), pedidoId, { proximoIndice: pedido.proximoIndice + 1 });
      return { brinco, controle: controleFromBrinco(brinco) };
    }

    // Native: transação atômica
    const nativeFs = require("@react-native-firebase/firestore").default;
    const ref = nativeFs().collection("fazendas").doc(fazendaId).collection("pedidos_brinco").doc(pedidoId);
    return nativeFs().runTransaction(async (tx: any) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return null;
      const pedido = snap.data() as PedidoBrinco;
      if (pedido.proximoIndice >= pedido.brincosTotal) return null;
      const brinco = brincoByIndex(pedido.brincoInicial, pedido.proximoIndice);
      tx.update(ref, { proximoIndice: pedido.proximoIndice + 1 });
      return { brinco, controle: controleFromBrinco(brinco) };
    });
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

  // ─── LocalAnimal ────────────────────────────────────────────────────────────

  static async salvarLocal(local: LocalAnimal, fazendaId: string): Promise<string> {
    if (local.id) {
      await setDocument(col(fazendaId, "locais"), local.id, { ...local, atualizadoEm: new Date().toISOString() }, { merge: true });
      return local.id;
    }
    const doc = await addDocument(col(fazendaId, "locais"), { ...local, criadoEm: new Date().toISOString() });
    return doc.id;
  }

  static async listarLocais(fazendaId: string): Promise<LocalAnimal[]> {
    const snap = await queryCollection(col(fazendaId, "locais"), [fsWhere("ativo", "==", true), fsOrderBy("nome")]);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as LocalAnimal));
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

  /**
   * Gera o CSV da planilha de campo no formato esperado pela certificadora.
   * Inclui cabeçalho compatível com Excel (UTF-8 BOM).
   */
  static gerarCsvPlanilhaCampo(
    animais: Bovino[],
    gtas: GTA[],
    fazendaNome: string
  ): string {
    const now = new Date().toLocaleDateString("pt-BR");
    const gtaMap = new Map(gtas.map((g) => [g.id, `${g.serie} ${g.numero}`]));

    const header = [
      "Nº",
      "Brinco SISBOV (15 dígitos)",
      "Nº Controle",
      "Nome / Ident.",
      "Raça",
      "Sexo",
      "Categoria",
      "Regime",
      "Local",
      "Peso Entrada (kg)",
      "Data Entrada",
      "GTA",
      "Chip RFID",
      "SISBOV Certificado",
    ].join(";");

    const linhas = animais.map((a, i) => {
      const controle = a.chipId.length === 15 ? controleFromBrinco(a.chipId) : "";
      const gta = a.metadados?.gtaId ? (gtaMap.get(a.metadados.gtaId) ?? "") : "";
      const regime = a.metadados?.regime ?? "";
      const local = a.metadados?.localNome ?? a.piqueteId ?? "";

      return [
        i + 1,
        a.chipId,
        controle,
        a.nome,
        a.raca,
        a.sexo === "M" ? "Macho" : "Fêmea",
        a.categoria,
        regime,
        local,
        a.pesoEntrada?.toFixed(1) ?? "",
        a.dataEntrada ? new Date(a.dataEntrada).toLocaleDateString("pt-BR") : "",
        gta,
        a.metadados?.chipRfid ?? "",
        a.sisbov?.certificado ? "Sim" : "Não",
      ].join(";");
    });

    // UTF-8 BOM para que Excel abra com acentos corretos
    return "\uFEFF" + `Planilha de Campo - ${fazendaNome} - ${now}\n` + header + "\n" + linhas.join("\n");
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
