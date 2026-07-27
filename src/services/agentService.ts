/**
 * agentService.ts
 *
 * Orquestra a conversa com a Claude API: monta o histórico, define as tools
 * disponíveis, executa o loop de tool-use até a IA ter uma resposta final
 * em texto, e retorna essa resposta pra ser enviada de volta no WhatsApp.
 */

import { AGENT_TOOLS, executarTool } from "./agentTools";
import type { WhatsAppUsuario } from "./whatsappAuth";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY as string;
const MODEL = "claude-sonnet-5";

type Role = "user" | "assistant";
interface Message {
  role: Role;
  content: any; // string ou array de content blocks (texto/tool_use/tool_result)
}

const SYSTEM_PROMPT = `
Você é o copiloto do sistema Confi, de gestão de confinamento de gado.
Você conversa via WhatsApp com produtores e tratadores.

Regras:
- Seja direto e objetivo — respostas curtas, como uma mensagem de WhatsApp real, não um relatório.
- Use as tools disponíveis para consultar dados reais antes de responder. Nunca invente números.
- Ao registrar algo (ex: leitura de cocho), confirme o que foi registrado de forma clara.
- Se a pessoa pedir algo fora do escopo do sistema, diga que não tem essa informação.
- Use termos técnicos do setor (GMD, CMS, piquete, trato) normalmente, sem precisar explicar o significado.
`.trim();

/**
 * Processa uma mensagem recebida do WhatsApp e retorna o texto de resposta.
 * @param historico Mensagens anteriores da conversa (curto histórico, ex: últimas 10)
 * @param novaMensagem Texto da mensagem que acabou de chegar
 * @param usuario Usuário autenticado (pra dar contexto de quem está falando)
 */
export async function processarMensagem(
  historico: Message[],
  novaMensagem: string,
  usuario: WhatsAppUsuario
): Promise<string> {
  const messages: Message[] = [
    ...historico,
    { role: "user", content: novaMensagem },
  ];

  const systemComContexto = `${SYSTEM_PROMPT}\n\nUsuário atual: ${usuario.nome} (${usuario.papel}).`;

  // Loop de tool-use: chama a API, e se ela pedir tool_use, executa e manda o resultado de volta
  for (let turno = 0; turno < 5; turno++) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: systemComContexto,
        messages,
        tools: AGENT_TOOLS,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Erro na Claude API:", response.status, errText);
      return "Tive um problema pra processar sua mensagem agora. Tenta de novo em instantes.";
    }

    const data = await response.json();
    const content = data.content as any[];

    const toolUseBlocks = content.filter((b) => b.type === "tool_use");

    if (toolUseBlocks.length === 0) {
      // Resposta final em texto
      const textBlock = content.find((b) => b.type === "text");
      return textBlock?.text ?? "Não consegui gerar uma resposta.";
    }

    // Executa as tools solicitadas e monta os resultados
    messages.push({ role: "assistant", content });

    const toolResults = await Promise.all(
      toolUseBlocks.map(async (block) => {
        const resultado = await executarTool(block.name, block.input);
        return {
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(resultado),
        };
      })
    );

    messages.push({ role: "user", content: toolResults });
  }

  return "Essa consulta ficou complexa demais — tenta reformular a pergunta.";
}
