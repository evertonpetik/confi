/**
 * whatsappAuth.ts
 *
 * Autoriza usuários do WhatsApp consultando o cadastro EXISTENTE de produtores.
 * Não precisa de coleção separada `whatsappUsuarios`.
 *
 * Fluxo:
 * 1. Número do WhatsApp chega
 * 2. Procura em `usuarios` (app users) - se for admin/gestor
 * 3. Se não achar, procura em `produtores` (de cada fazenda)
 * 4. Retorna dados do usuário autorizado
 */

import {
  getCollection,
  queryCollection,
  fsWhere,
} from "./firestoreServiceServer";

export interface WhatsAppUsuario {
  id: string;
  telefone: string;
  fazendaId: string;
  nome: string;
  email?: string;
  papel: "admin" | "gestor" | "cliente" | "produtor" | "tratador";
  ativo: boolean;
}

const cache = new Map<string, { usuario: WhatsAppUsuario | null; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

export async function getUsuarioAutorizado(
  telefone: string
): Promise<WhatsAppUsuario | null> {
  // Busca no cache primeiro
  const cached = cache.get(telefone);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.usuario;
  }

  try {
    // Estratégia 1: Procura em `usuarios` (usuários da app - admin/gestor)
    const usuariosSnap = await queryCollection(["usuarios"], [
      fsWhere("telefone", "==", telefone),
    ]);

    if (!usuariosSnap.empty) {
      const doc = usuariosSnap.docs[0];
      const data = doc.data();

      // Um usuário de app pode ter múltiplas fazendas
      // Para WhatsApp, usa a primeira fazenda (ou admin vê todas)
      const primeiraFazenda = data.fazendas?.[0];

      if (!primeiraFazenda) {
        console.warn(`usuario/${doc.id} sem fazendas associadas`);
        return null;
      }

      const usuario: WhatsAppUsuario = {
        id: doc.id,
        telefone: data.telefone,
        fazendaId: primeiraFazenda,
        nome: data.nome ?? "Usuário",
        email: data.email,
        papel: data.tipo ?? "cliente", // tipo do usuário app
        ativo: true,
      };

      cache.set(telefone, { usuario, expiresAt: Date.now() + CACHE_TTL_MS });
      return usuario;
    }

    // Estratégia 2: Procura em `produtores` de cada fazenda
    // Precisamos iterar fazendas pois produtores estão dentro delas (multi-tenant)
    const fazendaSnap = await getCollection("fazendas");

    for (const fazendaDoc of fazendaSnap.docs) {
      const fazendaId = fazendaDoc.id;
      const produtoresSnap = await getCollection("fazendas", fazendaId, "produtores");

      for (const prodDoc of produtoresSnap.docs) {
        const prodData = prodDoc.data();
        if (prodData.telefone === telefone) {
          const usuario: WhatsAppUsuario = {
            id: prodDoc.id,
            telefone: prodData.telefone,
            fazendaId: fazendaId,
            nome: prodData.nome ?? "Produtor",
            papel: prodData.papel ?? "produtor", // papel dentro da fazenda
            ativo: prodData.ativo !== false,
          };

          cache.set(telefone, { usuario, expiresAt: Date.now() + CACHE_TTL_MS });
          return usuario;
        }
      }
    }

    // Usuário não encontrado em nenhum lugar
    cache.set(telefone, { usuario: null, expiresAt: Date.now() + CACHE_TTL_MS });
    return null;
  } catch (err) {
    console.error("[whatsappAuth] Erro ao buscar usuário:", err);
    return null;
  }
}
