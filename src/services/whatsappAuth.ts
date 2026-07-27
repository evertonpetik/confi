/**
 * whatsappAuth.ts
 *
 * Controla quais números de telefone podem interagir com o copiloto.
 * Nova coleção Firestore: "whatsappUsuarios"
 *
 *   telefone    string   ex: "5567999999999" (mesmo formato que a Meta envia, sem "+")
 *   fazendaId   string   OBRIGATÓRIO — qual fazenda esse número pertence (seu sistema é
 *                        multi-tenant: toda consulta de lotes/insumos/etc. é escopada
 *                        por fazenda via setCurrentFazendaId())
 *   produtorId  string   vincula a um produtor dentro da fazenda (opcional)
 *   nome        string   nome de exibição
 *   papel       string   "admin" | "tratador" | "produtor"
 *   ativo       boolean  permite desativar acesso sem apagar o registro
 *
 * IMPORTANTE — coleção raiz: como ainda não sabemos a fazenda quando o número
 * escreve pela primeira vez, essa busca precisa acontecer FORA do escopo de
 * fazenda. Este arquivo usa firestoreServiceServer.ts (não o
 * firestoreService.ts do app), cujo ROOT_COLLECTIONS já inclui
 * "whatsappUsuarios" e "whatsappSessoes".
 */

import {
  queryCollection,
  fsWhere,
} from "./firestoreServiceServer";

export interface WhatsAppUsuario {
  id: string;
  telefone: string;
  fazendaId: string;
  produtorId?: string;
  nome: string;
  papel: "admin" | "tratador" | "produtor";
  ativo: boolean;
}

const cache = new Map<string, { usuario: WhatsAppUsuario | null; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min, pra não bater no Firestore a cada mensagem

export async function getUsuarioAutorizado(
  telefone: string
): Promise<WhatsAppUsuario | null> {
  const cached = cache.get(telefone);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.usuario;
  }

  const snapshot = await queryCollection(["whatsappUsuarios"], [
    fsWhere("telefone", "==", telefone),
  ]);

  if (snapshot.empty) {
    cache.set(telefone, { usuario: null, expiresAt: Date.now() + CACHE_TTL_MS });
    return null;
  }

  const doc = snapshot.docs[0];
  const data = doc.data();
  const usuario: WhatsAppUsuario | null =
    data.ativo === false
      ? null
      : {
          id: doc.id,
          telefone: data.telefone,
          fazendaId: data.fazendaId,
          produtorId: data.produtorId,
          nome: data.nome ?? "Usuário",
          papel: data.papel ?? "tratador",
          ativo: data.ativo !== false,
        };

  if (usuario && !usuario.fazendaId) {
    console.error(`whatsappUsuarios/${doc.id} sem fazendaId — bloqueando acesso.`);
    return null;
  }

  cache.set(telefone, { usuario, expiresAt: Date.now() + CACHE_TTL_MS });
  return usuario;
}
