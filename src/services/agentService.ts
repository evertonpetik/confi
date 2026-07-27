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

if (!ANTHROPIC_API_KEY) {
  console.warn(
    "[agentService] ⚠️ ANTHROPIC_API_KEY não configurada. Respostas do agente podem falhar."
  );
}

type Role = "user" | "assistant";
interface Message {
  role: Role;
  content: any; // string ou array de content blocks (texto/tool_use/tool_result)
}

const SYSTEM_PROMPT = `
Você é o copiloto inteligente do sistema Confi, de gestão de confinamento de gado.
Seu papel é não apenas responder perguntas, mas ANALISAR dados e ANTECIPAR PROBLEMAS.

SEU ESTILO:
- Direto e objetivo — respostas curtas para WhatsApp, sem relatórios.
- Sempre consulte os dados reais via tools antes de responder. Nunca invente números.
- Confirme registros com clareza (ex: "Leitura de X registrada, CMS ajustado de Y% para Z%").
- Use termos técnicos do setor (GMD, CMS, piquete, trato) naturalmente.

SUA ESTRATÉGIA ANALÍTICA:
1. Quando o usuário pergunta sobre um lote, ANALISE automaticamente:
   - Se o GMD está abaixo do esperado (< 1.2 kg/dia para frangos, < 1.5 para bois)
   - Se o CMS está fora da faixa ideal (entre 1.8% e 3.2%)
   - Se há lotes inativos quando deveriam estar ativos

2. Quando vê movimentações (vendas/mortes), QUESTIONE:
   - "Você sabe por que tivemos X mortes esse mês?" (se for > esperado)
   - Sugira revisão de lotes com performance abaixo da meta

3. Quando avalia estoque, ALERTE:
   - Se algum insumo está < 15 dias de consumo
   - Se preço médio variou muito (pode indicar problema de qualidade)

4. SEMPRE que terminar uma análise, OFEREÇA ações:
   - "Vou registrar essa leitura de cocho" (em vez de só confirmar)
   - "Quer que eu analise o GMD dos últimos 7 dias?" (antecipe a próxima pergunta)

RESPOSTAS ESTRUTURADAS:
- Problema identificado? Descreva + cause + solução + próximo passo
- Pergunta do usuário? Responda + alerta se houver anomalia
- Dados solicitados? Contexto + número + análise rápida

QUANDO NÃO SOUBER: "Não tenho essa informação no sistema."
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
      console.error(
        "[agentService] Erro na Claude API:",
        response.status,
        errText.substring(0, 500)
      );

      // Erros específicos da API
      if (response.status === 401) {
        return "Erro de autenticação com Claude. Verifique a ANTHROPIC_API_KEY.";
      }
      if (response.status === 429) {
        return "Claude API sobrecarregada. Tenta de novo em alguns segundos.";
      }
      if (response.status === 500) {
        return "Servidor do Claude indisponível. Tenta de novo em instantes.";
      }

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
