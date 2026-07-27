/**
 * whatsappService.ts
 *
 * Camada fina sobre a WhatsApp Cloud API (Meta) para enviar e receber mensagens.
 * Não confundir com a API da Anthropic — esta é a API do WhatsApp em si.
 *
 * Docs oficiais: https://developers.facebook.com/docs/whatsapp/cloud-api
 */

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN as string;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID as string;
const GRAPH_API_VERSION = "v21.0";

const BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}`;

/**
 * Envia uma mensagem de texto simples para um número de WhatsApp.
 * @param to Número no formato internacional sem símbolos, ex: "5567999999999"
 * @param body Texto da mensagem
 */
export async function sendWhatsAppText(to: string, body: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Erro ao enviar mensagem WhatsApp:", res.status, errText);
    throw new Error(`WhatsApp API error: ${res.status}`);
  }
}

/**
 * Marca uma mensagem recebida como lida (double-check azul).
 * Opcional, mas melhora a experiência do usuário.
 */
export async function markAsRead(messageId: string): Promise<void> {
  try {
    await fetch(`${BASE_URL}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
      }),
    });
  } catch (err) {
    // Não crítico — não derruba o fluxo se falhar
    console.warn("Falha ao marcar mensagem como lida:", err);
  }
}

/**
 * Estrutura mínima do payload que a Meta envia no webhook POST.
 * A Meta pode mandar vários formatos (status updates, mensagens, etc.),
 * então extraímos com cuidado e retornamos null se não for uma mensagem de texto de usuário.
 */
export interface IncomingWhatsAppMessage {
  from: string; // telefone de quem enviou
  messageId: string;
  text: string;
  timestamp: string;
}

export function parseIncomingWebhook(payload: any): IncomingWhatsAppMessage | null {
  try {
    const entry = payload?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    if (!message) return null; // pode ser um "status" update (entregue/lido), ignoramos

    if (message.type !== "text") {
      // Poderia expandir aqui para lidar com áudio (transcrever) ou imagem no futuro
      return null;
    }

    return {
      from: message.from,
      messageId: message.id,
      text: message.text.body,
      timestamp: message.timestamp,
    };
  } catch (err) {
    console.error("Erro ao parsear webhook do WhatsApp:", err);
    return null;
  }
}
