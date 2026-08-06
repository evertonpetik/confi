import firestore from "@react-native-firebase/firestore";
import { Bovino, GTA, LocalAnimal, PedidoBrinco, ProcessoSisbov } from "./weighing.types";

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

export class BrincoService {
  private static col(fazendaId: string) {
    return firestore().collection("fazendas").doc(fazendaId);
  }

  static async cadastrarPedido(
    pedido: Omit<PedidoBrinco, "id" | "criadoEm">,
    fazendaId: string
  ): Promise<string> {
    const doc = await this.col(fazendaId)
      .collection("pedidos_brinco")
      .add({ ...pedido, criadoEm: new Date().toISOString() });
    return doc.id;
  }

  static async listarPedidos(fazendaId: string): Promise<PedidoBrinco[]> {
    const snap = await this.col(fazendaId)
      .collection("pedidos_brinco")
      .orderBy("criadoEm", "desc")
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PedidoBrinco));
  }

  static async atualizarPedido(pedido: PedidoBrinco, fazendaId: string): Promise<void> {
    await this.col(fazendaId)
      .collection("pedidos_brinco")
      .doc(pedido.id!)
      .update({ ...pedido, atualizadoEm: new Date().toISOString() });
  }

  /**
   * Reserva o próximo brinco disponível do pedido e retorna o número de 15 dígitos.
   * Usa transação para evitar duplicação em uso simultâneo.
   */
  static async reservarBrinco(
    pedidoId: string,
    fazendaId: string
  ): Promise<{ brinco: string; controle: string } | null> {
    const ref = this.col(fazendaId).collection("pedidos_brinco").doc(pedidoId);

    return firestore().runTransaction(async (tx) => {
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
    const doc = await this.col(fazendaId)
      .collection("gtas")
      .add({ ...gta, criadoEm: new Date().toISOString() });
    return doc.id;
  }

  static async listarGtas(fazendaId: string): Promise<GTA[]> {
    const snap = await this.col(fazendaId)
      .collection("gtas")
      .orderBy("dataEmissao", "desc")
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as GTA));
  }

  static async obterGta(gtaId: string, fazendaId: string): Promise<GTA | null> {
    const doc = await this.col(fazendaId).collection("gtas").doc(gtaId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as GTA;
  }

  static async atualizarStatusGta(
    gtaId: string,
    status: GTA["status"],
    fazendaId: string
  ): Promise<void> {
    await this.col(fazendaId)
      .collection("gtas")
      .doc(gtaId)
      .update({ status, atualizadoEm: new Date().toISOString() });
  }

  // ─── LocalAnimal ────────────────────────────────────────────────────────────

  static async salvarLocal(local: LocalAnimal, fazendaId: string): Promise<string> {
    const col = this.col(fazendaId).collection("locais");
    if (local.id) {
      await col.doc(local.id).set({ ...local, atualizadoEm: new Date().toISOString() });
      return local.id;
    }
    const doc = await col.add({ ...local, criadoEm: new Date().toISOString() });
    return doc.id;
  }

  static async listarLocais(fazendaId: string): Promise<LocalAnimal[]> {
    const snap = await this.col(fazendaId)
      .collection("locais")
      .where("ativo", "==", true)
      .orderBy("nome")
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as LocalAnimal));
  }

  static async excluirLocal(localId: string, fazendaId: string): Promise<void> {
    await this.col(fazendaId).collection("locais").doc(localId).update({ ativo: false });
  }

  // ─── ProcessoSisbov ──────────────────────────────────────────────────────────

  static async criarProcesso(
    processo: Omit<ProcessoSisbov, "id" | "criadoEm">,
    fazendaId: string
  ): Promise<string> {
    const doc = await this.col(fazendaId)
      .collection("processos_sisbov")
      .add({ ...processo, criadoEm: new Date().toISOString() });
    return doc.id;
  }

  static async listarProcessos(fazendaId: string): Promise<ProcessoSisbov[]> {
    const snap = await this.col(fazendaId)
      .collection("processos_sisbov")
      .orderBy("criadoEm", "desc")
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ProcessoSisbov));
  }

  static async atualizarProcesso(
    processoId: string,
    dados: Partial<ProcessoSisbov>,
    fazendaId: string
  ): Promise<void> {
    await this.col(fazendaId)
      .collection("processos_sisbov")
      .doc(processoId)
      .update({ ...dados, atualizadoEm: new Date().toISOString() });
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
}

export default BrincoService;
