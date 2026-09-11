/**
 * Protocolos sanitários: conjuntos de aplicações feitas juntas no mangueiro.
 *
 * Cadastrar uma vez e aplicar com um toque é o que faz o registro sanitário
 * acontecer de verdade. Preencher produto, dose e via a cada animal garante
 * que o operador vai pular.
 */
import {
  addDocument,
  getCollection,
  setDocument,
  updateDocument,
} from "./firestoreService";
import { ProtocoloSanitario } from "./weighing.types";

const col = (fazendaId: string) => ["fazendas", fazendaId, "protocolos"];

export class ProtocoloService {
  /**
   * Lista os protocolos ativos.
   *
   * Filtra e ordena em memória de propósito: `where + orderBy` no Firestore
   * exige índice composto, e uma fazenda tem dezenas de protocolos, não
   * milhares. Depender de índice aqui faria a tela falhar em qualquer projeto
   * onde ele ainda não foi publicado.
   */
  static async listar(fazendaId: string): Promise<ProtocoloSanitario[]> {
    const snap = await getCollection(...col(fazendaId));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as ProtocoloSanitario))
      .filter((p) => p.ativo !== false)
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }

  static async salvar(
    protocolo: Omit<ProtocoloSanitario, "id" | "criadoEm"> & { id?: string },
    fazendaId: string
  ): Promise<string> {
    if (protocolo.id) {
      await setDocument(
        col(fazendaId),
        protocolo.id,
        { ...protocolo, atualizadoEm: new Date().toISOString() },
        { merge: true }
      );
      return protocolo.id;
    }
    const doc = await addDocument(col(fazendaId), {
      ...protocolo,
      criadoEm: new Date().toISOString(),
    });
    return doc.id;
  }

  /** Desativa em vez de apagar: protocolos já aplicados continuam referenciados nos eventos. */
  static async desativar(protocoloId: string, fazendaId: string): Promise<void> {
    await updateDocument(col(fazendaId), protocoloId, {
      ativo: false,
      atualizadoEm: new Date().toISOString(),
    });
  }
}

// Cálculo de aplicações e carência fica em ./protocoloUtils (puro).
export * from "./protocoloUtils";

export default ProtocoloService;
