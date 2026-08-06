import firestore from "@react-native-firebase/firestore";
import {
  Bovino,
  EventoSanitario,
  MovimentacaoBovino,
  Pesagem,
  ResultadoPesagem
} from "./weighing.types";

/**
 * Serviço de persistência de pesagens em Firestore
 * Estrutura de banco:
 * /fazendas/{farmedaId}/bovinos/{bovinoId}/pesagens/{pesagemId}
 * /fazendas/{farmedaId}/movimentacoes/{movimentacaoId}
 */
export class PesagemFirestoreService {
  /**
   * Salva uma pesagem em Firestore
   */
  static async salvarPesagem(
    pesagem: Pesagem,
    farmedaId: string
  ): Promise<ResultadoPesagem> {
    try {
      // Validações básicas
      const validacoes = this.validarPesagem(pesagem);
      if (validacoes.some((v) => !v.valido)) {
        return {
          sucesso: false,
          erro: "Validação falhou",
          validacoes,
        };
      }

      const pesagemRef = firestore()
        .collection("fazendas")
        .doc(farmedaId)
        .collection("bovinos")
        .doc(pesagem.animalId)
        .collection("pesagens");

      // Cria documento
      const docRef = await pesagemRef.add({
        ...pesagem,
        sincronizado: true,
        criadoEm: new Date(),
        atualizadoEm: new Date(),
      });

      console.log(`[Firestore] Pesagem salva: ${docRef.id}`);

      return {
        sucesso: true,
        pesagemId: docRef.id,
        validacoes: validacoes.filter((v) => !v.valido), // Apenas avisos
      };
    } catch (error) {
      console.error("[Firestore] Erro ao salvar pesagem:", error);
      return {
        sucesso: false,
        erro: error instanceof Error ? error.message : "Erro desconhecido",
      };
    }
  }

  /**
   * Salva uma movimentação de bovino
   */
  static async salvarMovimentacao(
    movimentacao: MovimentacaoBovino,
    farmedaId: string
  ): Promise<ResultadoPesagem> {
    try {
      const movRef = firestore()
        .collection("fazendas")
        .doc(farmedaId)
        .collection("movimentacoes");

      const docRef = await movRef.add({
        ...movimentacao,
        criadoEm: new Date(),
      });

      console.log(`[Firestore] Movimentação salva: ${docRef.id}`);

      return {
        sucesso: true,
        movimentacaoId: docRef.id,
      };
    } catch (error) {
      console.error("[Firestore] Erro ao salvar movimentação:", error);
      return {
        sucesso: false,
        erro: error instanceof Error ? error.message : "Erro desconhecido",
      };
    }
  }

  /**
   * Busca histórico de pesagens de um bovino
   */
  static async obterPesagensAnimal(
    animalId: string,
    farmedaId: string,
    limite: number = 50
  ): Promise<Pesagem[]> {
    try {
      const snapshot = await firestore()
        .collection("fazendas")
        .doc(farmedaId)
        .collection("bovinos")
        .doc(animalId)
        .collection("pesagens")
        .orderBy("dataHora", "desc")
        .limit(limite)
        .get();

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as Pesagem));
    } catch (error) {
      console.error("[Firestore] Erro ao buscar pesagens:", error);
      return [];
    }
  }

  /**
   * Busca movimentações de um bovino
   */
  static async obterMovimentacoesAnimal(
    animalId: string,
    farmedaId: string,
    limite: number = 50
  ): Promise<MovimentacaoBovino[]> {
    try {
      const snapshot = await firestore()
        .collection("fazendas")
        .doc(farmedaId)
        .collection("movimentacoes")
        .where("animalId", "==", animalId)
        .orderBy("dataHora", "desc")
        .limit(limite)
        .get();

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as MovimentacaoBovino));
    } catch (error) {
      console.error("[Firestore] Erro ao buscar movimentações:", error);
      return [];
    }
  }

  /**
   * Busca um bovino pelo chipId (SISBOV)
   */
  static async obterBovinoPorChip(
    chipId: string,
    farmedaId: string
  ): Promise<Bovino | null> {
    try {
      const snapshot = await firestore()
        .collection("fazendas")
        .doc(farmedaId)
        .collection("bovinos")
        .where("chipId", "==", chipId)
        .limit(1)
        .get();

      if (snapshot.empty) {
        console.log(`[Firestore] Bovino não encontrado: ${chipId}`);
        return null;
      }

      return {
        id: snapshot.docs[0].id,
        ...snapshot.docs[0].data(),
      } as Bovino;
    } catch (error) {
      console.error("[Firestore] Erro ao buscar bovino:", error);
      return null;
    }
  }

  /**
   * Salva ou atualiza um bovino
   */
  static async salvarBovino(bovino: Bovino, farmedaId: string): Promise<string> {
    try {
      const ref = firestore()
        .collection("fazendas")
        .doc(farmedaId)
        .collection("bovinos");

      let docId = bovino.id;

      if (bovino.id) {
        // Atualiza documento existente
        await ref.doc(bovino.id).update({
          ...bovino,
          atualizadoEm: new Date(),
        });
        console.log(`[Firestore] Bovino atualizado: ${bovino.id}`);
      } else {
        // Cria novo documento
        const docRef = await ref.add({
          ...bovino,
          criadoEm: new Date(),
          atualizadoEm: new Date(),
        });
        docId = docRef.id;
        console.log(`[Firestore] Bovino criado: ${docId}`);
      }

      return docId;
    } catch (error) {
      console.error("[Firestore] Erro ao salvar bovino:", error);
      throw error;
    }
  }

  /**
   * Busca bovinos por lote
   */
  static async obterBovinosPorLote(
    loteId: string,
    farmedaId: string
  ): Promise<Bovino[]> {
    try {
      const snapshot = await firestore()
        .collection("fazendas")
        .doc(farmedaId)
        .collection("bovinos")
        .where("loteId", "==", loteId)
        .get();

      return snapshot.docs.map(
        (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        } as Bovino)
      );
    } catch (error) {
      console.error("[Firestore] Erro ao buscar bovinos do lote:", error);
      return [];
    }
  }

  /**
   * Busca bovinos por piquete
   */
  static async obterBovinosPorPiquete(
    piqueteId: string,
    farmedaId: string
  ): Promise<Bovino[]> {
    try {
      const snapshot = await firestore()
        .collection("fazendas")
        .doc(farmedaId)
        .collection("bovinos")
        .where("piqueteId", "==", piqueteId)
        .get();

      return snapshot.docs.map(
        (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        } as Bovino)
      );
    } catch (error) {
      console.error("[Firestore] Erro ao buscar bovinos do piquete:", error);
      return [];
    }
  }

  /**
   * Valida dados de uma pesagem
   */
  private static validarPesagem(
    pesagem: Pesagem
  ): Array<{ campo: string; valido: boolean; mensagem?: string }> {
    const validacoes = [];

    // Campos obrigatórios
    if (!pesagem.animalId) {
      validacoes.push({
        campo: "animalId",
        valido: false,
        mensagem: "ID do animal é obrigatório",
      });
    }

    if (!pesagem.chipId) {
      validacoes.push({
        campo: "chipId",
        valido: false,
        mensagem: "Chip ID é obrigatório",
      });
    } else if (!/^\d{15}$/.test(pesagem.chipId)) {
      validacoes.push({
        campo: "chipId",
        valido: false,
        mensagem: "Chip ID deve ter 15 dígitos",
      });
    }

    if (!pesagem.peso || pesagem.peso <= 0) {
      validacoes.push({
        campo: "peso",
        valido: false,
        mensagem: "Peso deve ser maior que zero",
      });
    }

    if (!pesagem.dataHora) {
      validacoes.push({
        campo: "dataHora",
        valido: false,
        mensagem: "Data/hora é obrigatória",
      });
    }

    // Validações adicionais
    if (pesagem.peso && pesagem.peso < 50) {
      validacoes.push({
        campo: "peso",
        valido: false,
        mensagem: "Peso muito baixo (mínimo 50 kg)",
      });
    }

    if (pesagem.peso && pesagem.peso > 1500) {
      validacoes.push({
        campo: "peso",
        valido: false,
        mensagem: "Peso muito alto (máximo 1500 kg)",
      });
    }

    if (!pesagem.leituraChip?.timestamp) {
      validacoes.push({
        campo: "leituraChip",
        valido: false,
        mensagem: "Leitura do chip inválida",
      });
    }

    if (!pesagem.leituraPeso?.timestamp) {
      validacoes.push({
        campo: "leituraPeso",
        valido: false,
        mensagem: "Leitura do peso inválida",
      });
    }

    return validacoes;
  }

  /**
   * Gera relatório de pesagens por período
   */
  static async gerarRelatorioPesagens(
    farmedaId: string,
    dataInicio: Date,
    dataFim: Date
  ): Promise<{
    total: number;
    mediasPeso: { [categoria: string]: number };
    erros: number;
  }> {
    try {
      const snapshot = await firestore()
        .collectionGroup("pesagens")
        .where("farmedaId", "==", farmedaId)
        .where("dataHora", ">=", dataInicio.toISOString())
        .where("dataHora", "<=", dataFim.toISOString())
        .get();

      const pesagens = snapshot.docs.map((doc) => doc.data() as Pesagem);

      const mediasPeso: { [categoria: string]: number } = {};
      let totalPeso = 0;
      let contagem = 0;
      let erros = 0;

      pesagens.forEach((p) => {
        if (p.peso > 0) {
          totalPeso += p.peso;
          contagem++;
        } else {
          erros++;
        }
      });

      return {
        total: pesagens.length,
        mediasPeso: {
          geral: contagem > 0 ? totalPeso / contagem : 0,
        },
        erros,
      };
    } catch (error) {
      console.error("[Firestore] Erro ao gerar relatório:", error);
      return { total: 0, mediasPeso: {}, erros: 0 };
    }
  }

  /**
   * Lista todos os bovinos de uma fazenda
   */
  static async listarBovinos(farmedaId: string): Promise<Bovino[]> {
    try {
      const snapshot = await firestore()
        .collection("fazendas")
        .doc(farmedaId)
        .collection("bovinos")
        .orderBy("nome")
        .get();

      return snapshot.docs.map(
        (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        } as Bovino)
      );
    } catch (error) {
      console.error("[Firestore] Erro ao listar bovinos:", error);
      return [];
    }
  }

  /**
   * Atualiza campos de um bovino existente
   */
  static async atualizarBovino(bovino: Bovino, farmedaId: string): Promise<void> {
    try {
      await firestore()
        .collection("fazendas")
        .doc(farmedaId)
        .collection("bovinos")
        .doc(bovino.id)
        .update({
          ...bovino,
          atualizadoEm: new Date(),
        });
    } catch (error) {
      console.error("[Firestore] Erro ao atualizar bovino:", error);
      throw error;
    }
  }

  /**
   * Excluir uma pesagem (para correção)
   */
  static async excluirPesagem(
    pesagemId: string,
    animalId: string,
    farmedaId: string
  ): Promise<boolean> {
    try {
      await firestore()
        .collection("fazendas")
        .doc(farmedaId)
        .collection("bovinos")
        .doc(animalId)
        .collection("pesagens")
        .doc(pesagemId)
        .delete();

      console.log(`[Firestore] Pesagem excluída: ${pesagemId}`);
      return true;
    } catch (error) {
      console.error("[Firestore] Erro ao excluir pesagem:", error);
      return false;
    }
  }

  /**
   * Sincroniza pesagens offline com Firestore
   */
  static async sincronizarPesagensOffline(
    pesagensOffline: Pesagem[],
    farmedaId: string
  ): Promise<{ sincronizadas: number; erros: number }> {
    let sincronizadas = 0;
    let erros = 0;

    for (const pesagem of pesagensOffline) {
      try {
        const resultado = await this.salvarPesagem(pesagem, farmedaId);
        if (resultado.sucesso) {
          sincronizadas++;
        } else {
          erros++;
        }
      } catch (error) {
        erros++;
      }
    }

    console.log(
      `[Firestore] Sincronização concluída: ${sincronizadas} OK, ${erros} erros`
    );
    return { sincronizadas, erros };
  }

  // ─── Eventos Sanitários ───────────────────────────────────────────────────

  static async salvarEventoSanitario(
    evento: EventoSanitario,
    farmedaId: string
  ): Promise<string> {
    const ref = firestore()
      .collection("fazendas")
      .doc(farmedaId)
      .collection("bovinos")
      .doc(evento.animalId)
      .collection("eventos_sanitarios");

    if (evento.id) {
      await ref.doc(evento.id).set({ ...evento, atualizadoEm: new Date() });
      return evento.id;
    }
    const doc = await ref.add({ ...evento, criadoEm: new Date() });
    return doc.id;
  }

  static async listarEventosSanitarios(
    animalId: string,
    farmedaId: string
  ): Promise<EventoSanitario[]> {
    try {
      const snapshot = await firestore()
        .collection("fazendas")
        .doc(farmedaId)
        .collection("bovinos")
        .doc(animalId)
        .collection("eventos_sanitarios")
        .orderBy("dataAplicacao", "desc")
        .get();

      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as EventoSanitario));
    } catch {
      return [];
    }
  }

  static async excluirEventoSanitario(
    eventoId: string,
    animalId: string,
    farmedaId: string
  ): Promise<void> {
    await firestore()
      .collection("fazendas")
      .doc(farmedaId)
      .collection("bovinos")
      .doc(animalId)
      .collection("eventos_sanitarios")
      .doc(eventoId)
      .delete();
  }

  // ─── Pesagem rápida (salva peso e atualiza pesoAnterior do bovino) ────────

  static async registrarPesagemRapida(
    animalId: string,
    chipId: string,
    peso: number,
    farmedaId: string,
    usuarioId: string,
    observacoes?: string
  ): Promise<string> {
    const agora = new Date().toISOString();

    const pesagem: Omit<Pesagem, "id"> = {
      animalId,
      chipId,
      peso,
      dataHora: agora,
      tipoPesagem: "entrada" as any,
      leituraChip: {
        chipId,
        timestamp: agora,
        sinSinal: 0,
        dispositivoId: "manual",
        valido: true,
      },
      leituraPeso: {
        peso,
        timestamp: agora,
        status: "estavel" as any,
        dispositivoId: "manual",
        valido: true,
      },
      farmedaId,
      usuarioId,
      observacoes,
      sincronizado: true,
      criadoEm: agora,
      atualizadoEm: agora,
    };

    const ref = firestore()
      .collection("fazendas")
      .doc(farmedaId)
      .collection("bovinos")
      .doc(animalId)
      .collection("pesagens");

    const docRef = await ref.add(pesagem);

    // Atualiza pesoAnterior e dataUltimaPesagem no registro do bovino
    await firestore()
      .collection("fazendas")
      .doc(farmedaId)
      .collection("bovinos")
      .doc(animalId)
      .update({
        pesoAnterior: peso,
        dataUltimaPesagem: agora,
        atualizadoEm: new Date(),
      });

    return docRef.id;
  }
}
