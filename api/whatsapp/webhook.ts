/**
 * api/whatsapp/webhook.ts
 *
 * Endpoint Vercel (Node.js) que recebe eventos do WhatsApp Cloud API.
 *
 * GET  -> verificação do webhook (a Meta chama isso uma vez ao configurar)
 * POST -> recebe mensagens novas dos usuários
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  parseIncomingWebhook,
  sendWhatsAppText,
  markAsRead,
} from "../../src/services/whatsappService";
import { getUsuarioAutorizado } from "../../src/services/whatsappAuth";
import { processarMensagem } from "../../src/services/agentService";
import {
  queryCollection,
  setDocument,
  setCurrentFazendaId,
  fsLimit,
  fsOrderBy,
} from "../../src/services/firestoreServiceServer";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN as string;
const HISTORICO_MAX = 10;

/**
 * ATENÇÃO — MULTI-TENANCY E CONCORRÊNCIA
 *
 * setCurrentFazendaId() no seu firestoreService.ts guarda o ID da fazenda
 * numa variável de módulo (_currentFazendaId), não por requisição. Isso é
 * seguro em Vercel Serverless Functions com runtime Node.js (não "edge"),
 * porque cada instância de execução processa UMA invocação por vez — não há
 * duas requisições concorrentes compartilhando a mesma variável de módulo ao
 * mesmo tempo dentro do mesmo container.
 *
 * Ainda assim, seguimos o padrão defensivo de sempre resetar para null no
 * início e no fim (bloco finally) de cada requisição, e:
 *   - NÃO configure este endpoint como Edge Function.
 *   - NÃO use Promise.all/paralelismo aqui misturando chamadas de fazendas
 *     diferentes na mesma requisição.
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    // Verificação do webhook exigida pela Meta
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send("Verificação falhou.");
  }

  if (req.method === "POST") {
    const incoming = parseIncomingWebhook(req.body);

    // Sempre responde 200 rápido pra Meta não reenviar o evento,
    // mesmo se não for uma mensagem de texto de usuário (ex: status update)
    if (!incoming) {
      return res.status(200).send("ok");
    }

    setCurrentFazendaId(null); // defensivo: garante que não há resíduo de invocação anterior

    try {
      await markAsRead(incoming.messageId);

      // getUsuarioAutorizado consulta "whatsappUsuarios" (coleção raiz — ver
      // nota em whatsappAuth.ts) ANTES de sabermos a fazenda, então essa
      // chamada acontece com _currentFazendaId ainda null.
      const usuario = await getUsuarioAutorizado(incoming.from);
      if (!usuario) {
        await sendWhatsAppText(
          incoming.from,
          "Seu número ainda não está autorizado a usar o copiloto do Confi. Peça pro administrador te cadastrar."
        );
        return res.status(200).send("ok");
      }

      // A partir daqui, toda consulta a lotes/insumos/dietas/etc. precisa
      // estar escopada à fazenda do usuário.
      setCurrentFazendaId(usuario.fazendaId);

      // whatsappSessoes é coleção raiz (não precisa do escopo de fazenda),
      // mas mantemos a chamada depois de setCurrentFazendaId sem problema,
      // já que "whatsappSessoes" está em ROOT_COLLECTIONS.
      const sessaoRef = ["whatsappSessoes"];
      const historicoSnap = await queryCollection(
        [...sessaoRef, incoming.from, "mensagens"],
        [fsOrderBy("timestamp", "desc"), fsLimit(HISTORICO_MAX)]
      );
      const historico = historicoSnap.docs
        .map((d) => d.data())
        .reverse()
        .map((m) => ({ role: m.role, content: m.content }));

      const resposta = await processarMensagem(historico, incoming.text, usuario);

      await sendWhatsAppText(incoming.from, resposta);

      // Salva o novo turno no histórico (fire-and-forget seria arriscado; aguardamos)
      await setDocument(
        [...sessaoRef, incoming.from, "mensagens"],
        `${Date.now()}_u`,
        { role: "user", content: incoming.text, timestamp: Date.now() }
      );
      await setDocument(
        [...sessaoRef, incoming.from, "mensagens"],
        `${Date.now()}_a`,
        { role: "assistant", content: resposta, timestamp: Date.now() + 1 }
      );
    } catch (err) {
      console.error("Erro ao processar mensagem do WhatsApp:", err);
      try {
        await sendWhatsAppText(
          incoming.from,
          "Deu um erro aqui do meu lado. Tenta de novo em instantes."
        );
      } catch {
        // se nem isso funcionar, só loga
      }
    } finally {
      setCurrentFazendaId(null); // sempre limpa o contexto ao final da requisição
    }

    return res.status(200).send("ok");
  }

  return res.status(405).send("Método não permitido");
}
