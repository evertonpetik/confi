/**
 * Persistência de bovinos, pesagens e movimentações.
 *
 * Usa a abstração de ./firestoreService, que resolve web e nativo. Importar
 * `@react-native-firebase/firestore` direto aqui quebraria o app no navegador:
 * esse pacote não tem build web, e o mangueiro no notebook depende disso.
 *
 * Estrutura:
 *   /fazendas/{fazendaId}/bovinos/{bovinoId}
 *   /fazendas/{fazendaId}/bovinos/{bovinoId}/pesagens/{pesagemId}
 *   /fazendas/{fazendaId}/bovinos/{bovinoId}/eventos_sanitarios/{eventoId}
 *   /fazendas/{fazendaId}/movimentacoes/{movimentacaoId}
 */
import {
  addDocument,
  deleteDocument,
  fsLimit,
  fsOrderBy,
  fsWhere,
  getDocument,
  queryCollection,
  setDocument,
  updateDocument,
} from "./firestoreService";
import { validarSisbov } from "./sisbov";
import {
  Bovino,
  Evento,
  EventoSanitario,
  MovimentacaoBovino,
  Pesagem,
  ResultadoPesagem,
} from "./weighing.types";

const colBovinos = (faz: string) => ["fazendas", faz, "bovinos"];
const colPesagens = (faz: string, animalId: string) => [...colBovinos(faz), animalId, "pesagens"];
const colSanitarios = (faz: string, animalId: string) => [...colBovinos(faz), animalId, "eventos_sanitarios"];
const colMovimentacoes = (faz: string) => ["fazendas", faz, "movimentacoes"];
const colEventos = (faz: string) => ["fazendas", faz, "eventos"];

const agora = () => new Date().toISOString();

export class PesagemFirestoreService {
  // ─── Pesagens ─────────────────────────────────────────────────────────────

  static async salvarPesagem(
    pesagem: Pesagem,
    farmedaId: string
  ): Promise<ResultadoPesagem> {
    try {
      const validacoes = this.validarPesagem(pesagem);
      if (validacoes.some((v) => !v.valido)) {
        return { sucesso: false, erro: "Validação falhou", validacoes };
      }

      const doc = await addDocument(colPesagens(farmedaId, pesagem.animalId), {
        ...pesagem,
        sincronizado: true,
        criadoEm: agora(),
        atualizadoEm: agora(),
      });

      console.log(`[Firestore] Pesagem salva: ${doc.id}`);
      return { sucesso: true, pesagemId: doc.id, validacoes: validacoes.filter((v) => !v.valido) };
    } catch (error) {
      console.error("[Firestore] Erro ao salvar pesagem:", error);
      return {
        sucesso: false,
        erro: error instanceof Error ? error.message : "Erro desconhecido",
      };
    }
  }

  static async obterPesagensAnimal(
    animalId: string,
    farmedaId: string,
    limite: number = 50
  ): Promise<Pesagem[]> {
    try {
      const snap = await queryCollection(colPesagens(farmedaId, animalId), [
        fsOrderBy("dataHora", "desc"),
        fsLimit(limite),
      ]);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Pesagem));
    } catch (error) {
      console.error("[Firestore] Erro ao buscar pesagens:", error);
      return [];
    }
  }

  static async excluirPesagem(
    pesagemId: string,
    animalId: string,
    farmedaId: string
  ): Promise<boolean> {
    try {
      await deleteDocument(colPesagens(farmedaId, animalId), pesagemId);
      console.log(`[Firestore] Pesagem excluída: ${pesagemId}`);
      return true;
    } catch (error) {
      console.error("[Firestore] Erro ao excluir pesagem:", error);
      return false;
    }
  }

  static async sincronizarPesagensOffline(
    pesagensOffline: Pesagem[],
    farmedaId: string
  ): Promise<{ sincronizadas: number; erros: number }> {
    let sincronizadas = 0;
    let erros = 0;

    for (const pesagem of pesagensOffline) {
      try {
        const resultado = await this.salvarPesagem(pesagem, farmedaId);
        if (resultado.sucesso) sincronizadas++;
        else erros++;
      } catch {
        erros++;
      }
    }

    console.log(`[Firestore] Sincronização concluída: ${sincronizadas} OK, ${erros} erros`);
    return { sincronizadas, erros };
  }

  /**
   * Registra peso e atualiza o último peso conhecido do animal.
   *
   * Sem chip lido a pesagem é manual: a leitura fica marcada como inválida em
   * vez de repetir o SISBOV como se fosse um RFID.
   */
  static async registrarPesagemRapida(
    animalId: string,
    sisbov: string,
    peso: number,
    farmedaId: string,
    usuarioId: string,
    observacoes?: string,
    chipRfid?: string
  ): Promise<string> {
    const ts = agora();

    const pesagem: Omit<Pesagem, "id"> = {
      animalId,
      sisbov,
      peso,
      dataHora: ts,
      tipoPesagem: "entrada" as any,
      leituraChip: {
        chipRfid: chipRfid ?? "",
        timestamp: ts,
        sinSinal: 0,
        dispositivoId: "manual",
        valido: !!chipRfid,
      },
      leituraPeso: {
        peso,
        timestamp: ts,
        status: "estavel" as any,
        dispositivoId: "manual",
        valido: true,
      },
      farmedaId,
      usuarioId,
      observacoes,
      sincronizado: true,
      criadoEm: ts,
      atualizadoEm: ts,
    };

    const doc = await addDocument(colPesagens(farmedaId, animalId), pesagem);

    try {
      await updateDocument(colBovinos(farmedaId), animalId, {
        pesoAnterior: peso,
        dataUltimaPesagem: ts,
        atualizadoEm: ts,
      });
    } catch (error) {
      // A pesagem já está gravada; o resumo desnormalizado é secundário.
      console.warn("[Firestore] Peso salvo, mas o resumo do bovino não atualizou:", error);
    }

    return doc.id;
  }

  private static validarPesagem(
    pesagem: Pesagem
  ): Array<{ campo: string; valido: boolean; mensagem?: string }> {
    const validacoes: Array<{ campo: string; valido: boolean; mensagem?: string }> = [];

    if (!pesagem.animalId) {
      validacoes.push({ campo: "animalId", valido: false, mensagem: "ID do animal é obrigatório" });
    }

    if (!pesagem.sisbov) {
      validacoes.push({ campo: "sisbov", valido: false, mensagem: "Número SISBOV é obrigatório" });
    } else if (!validarSisbov(pesagem.sisbov)) {
      validacoes.push({
        campo: "sisbov",
        valido: false,
        mensagem: "Número SISBOV inválido (15 dígitos com dígito verificador)",
      });
    }

    if (!pesagem.peso || pesagem.peso <= 0) {
      validacoes.push({ campo: "peso", valido: false, mensagem: "Peso deve ser maior que zero" });
    }

    if (!pesagem.dataHora) {
      validacoes.push({ campo: "dataHora", valido: false, mensagem: "Data/hora é obrigatória" });
    }

    if (pesagem.peso && pesagem.peso < 50) {
      validacoes.push({ campo: "peso", valido: false, mensagem: "Peso muito baixo (mínimo 50 kg)" });
    }

    if (pesagem.peso && pesagem.peso > 1500) {
      validacoes.push({ campo: "peso", valido: false, mensagem: "Peso muito alto (máximo 1500 kg)" });
    }

    if (!pesagem.leituraChip?.timestamp) {
      validacoes.push({ campo: "leituraChip", valido: false, mensagem: "Leitura do chip inválida" });
    }

    if (!pesagem.leituraPeso?.timestamp) {
      validacoes.push({ campo: "leituraPeso", valido: false, mensagem: "Leitura do peso inválida" });
    }

    return validacoes;
  }

  /**
   * Resumo das pesagens do período.
   *
   * Lê da coleção de eventos, e não de um collectionGroup sobre as pesagens:
   * a coleção plana já responde por período sem varrer subcoleção de animal.
   */
  static async gerarRelatorioPesagens(
    farmedaId: string,
    dataInicio: Date,
    dataFim: Date
  ): Promise<{ total: number; mediasPeso: { [categoria: string]: number }; erros: number }> {
    try {
      const snap = await queryCollection(colEventos(farmedaId), [
        fsWhere("tipo", "==", "pesagem"),
        fsWhere("dataHora", ">=", dataInicio.toISOString()),
        fsWhere("dataHora", "<=", dataFim.toISOString()),
      ]);

      const eventos = snap.docs.map((d) => d.data() as Evento);

      let totalPeso = 0;
      let contagem = 0;
      let erros = 0;

      for (const e of eventos) {
        if (e.peso && e.peso > 0) {
          totalPeso += e.peso;
          contagem++;
        } else {
          erros++;
        }
      }

      return {
        total: eventos.length,
        mediasPeso: { geral: contagem > 0 ? totalPeso / contagem : 0 },
        erros,
      };
    } catch (error) {
      console.error("[Firestore] Erro ao gerar relatório:", error);
      return { total: 0, mediasPeso: {}, erros: 0 };
    }
  }

  // ─── Movimentações ────────────────────────────────────────────────────────

  static async salvarMovimentacao(
    movimentacao: MovimentacaoBovino,
    farmedaId: string
  ): Promise<ResultadoPesagem> {
    try {
      const doc = await addDocument(colMovimentacoes(farmedaId), {
        ...movimentacao,
        criadoEm: agora(),
      });
      console.log(`[Firestore] Movimentação salva: ${doc.id}`);
      return { sucesso: true, movimentacaoId: doc.id };
    } catch (error) {
      console.error("[Firestore] Erro ao salvar movimentação:", error);
      return {
        sucesso: false,
        erro: error instanceof Error ? error.message : "Erro desconhecido",
      };
    }
  }

  static async obterMovimentacoesAnimal(
    animalId: string,
    farmedaId: string,
    limite: number = 50
  ): Promise<MovimentacaoBovino[]> {
    try {
      const snap = await queryCollection(colMovimentacoes(farmedaId), [
        fsWhere("animalId", "==", animalId),
        fsOrderBy("dataHora", "desc"),
        fsLimit(limite),
      ]);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as MovimentacaoBovino));
    } catch (error) {
      console.error("[Firestore] Erro ao buscar movimentações:", error);
      return [];
    }
  }

  // ─── Bovinos ──────────────────────────────────────────────────────────────

  /**
   * Busca o animal por qualquer um dos seus três números.
   *
   * 6 dígitos só podem ser o manejo. 15 dígitos podem ser o SISBOV ou o chip
   * RFID, então tenta os dois em ordem — o mangueiro identifica o animal tanto
   * pela leitura do transponder quanto pelo número digitado do brinco.
   */
  static async obterBovinoPorNumero(
    numero: string,
    farmedaId: string
  ): Promise<Bovino | null> {
    const campos = numero.length === 6 ? ["manejo"] : ["sisbov", "chipRfid"];
    try {
      for (const campo of campos) {
        const snap = await queryCollection(colBovinos(farmedaId), [
          fsWhere(campo, "==", numero),
          fsLimit(1),
        ]);
        if (snap.docs.length > 0) {
          return { id: snap.docs[0].id, ...snap.docs[0].data() } as Bovino;
        }
      }
      console.log(`[Firestore] Bovino não encontrado: ${numero}`);
      return null;
    } catch (error) {
      console.error("[Firestore] Erro ao buscar bovino:", error);
      return null;
    }
  }

  static async obterBovino(animalId: string, farmedaId: string): Promise<Bovino | null> {
    try {
      const snap = await getDocument(colBovinos(farmedaId), animalId);
      if (!snap.exists) return null;
      return { id: snap.id, ...snap.data() } as Bovino;
    } catch (error) {
      console.error("[Firestore] Erro ao buscar bovino:", error);
      return null;
    }
  }

  static async salvarBovino(bovino: Bovino, farmedaId: string): Promise<string> {
    try {
      if (bovino.id) {
        // merge: o mangueiro grava o animal inteiro, mas correções pontuais
        // não devem apagar campos preenchidos em outro momento.
        await setDocument(
          colBovinos(farmedaId),
          bovino.id,
          { ...bovino, atualizadoEm: agora() },
          { merge: true }
        );
        console.log(`[Firestore] Bovino salvo: ${bovino.id}`);
        return bovino.id;
      }

      const doc = await addDocument(colBovinos(farmedaId), {
        ...bovino,
        criadoEm: agora(),
        atualizadoEm: agora(),
      });
      console.log(`[Firestore] Bovino criado: ${doc.id}`);
      return doc.id;
    } catch (error) {
      console.error("[Firestore] Erro ao salvar bovino:", error);
      throw error;
    }
  }

  static async atualizarBovino(bovino: Bovino, farmedaId: string): Promise<void> {
    try {
      await updateDocument(colBovinos(farmedaId), bovino.id, {
        ...bovino,
        atualizadoEm: agora(),
      });
    } catch (error) {
      console.error("[Firestore] Erro ao atualizar bovino:", error);
      throw error;
    }
  }

  static async listarBovinos(farmedaId: string): Promise<Bovino[]> {
    try {
      const snap = await queryCollection(colBovinos(farmedaId), [fsOrderBy("nome")]);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Bovino));
    } catch (error) {
      console.error("[Firestore] Erro ao listar bovinos:", error);
      return [];
    }
  }

  static async obterBovinosPorLote(loteId: string, farmedaId: string): Promise<Bovino[]> {
    try {
      const snap = await queryCollection(colBovinos(farmedaId), [fsWhere("loteId", "==", loteId)]);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Bovino));
    } catch (error) {
      console.error("[Firestore] Erro ao buscar bovinos do lote:", error);
      return [];
    }
  }

  static async obterBovinosPorPiquete(piqueteId: string, farmedaId: string): Promise<Bovino[]> {
    try {
      const snap = await queryCollection(colBovinos(farmedaId), [
        fsWhere("piqueteId", "==", piqueteId),
      ]);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Bovino));
    } catch (error) {
      console.error("[Firestore] Erro ao buscar bovinos do piquete:", error);
      return [];
    }
  }

  // ─── Eventos sanitários ───────────────────────────────────────────────────

  static async salvarEventoSanitario(
    evento: EventoSanitario,
    farmedaId: string
  ): Promise<string> {
    const path = colSanitarios(farmedaId, evento.animalId);

    if (evento.id) {
      await setDocument(path, evento.id, { ...evento, atualizadoEm: agora() }, { merge: true });
      return evento.id;
    }
    const doc = await addDocument(path, { ...evento, criadoEm: agora() });
    return doc.id;
  }

  static async listarEventosSanitarios(
    animalId: string,
    farmedaId: string
  ): Promise<EventoSanitario[]> {
    try {
      const snap = await queryCollection(colSanitarios(farmedaId, animalId), [
        fsOrderBy("dataAplicacao", "desc"),
      ]);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as EventoSanitario));
    } catch {
      return [];
    }
  }

  static async excluirEventoSanitario(
    eventoId: string,
    animalId: string,
    farmedaId: string
  ): Promise<void> {
    await deleteDocument(colSanitarios(farmedaId, animalId), eventoId);
  }
}

export default PesagemFirestoreService;
