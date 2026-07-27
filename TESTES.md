#!/bin/bash
# TESTES - Copiloto WhatsApp + Claude AI

## ANTES DE TESTAR - Checklist ✅

echo "📋 Checklist pré-teste:"
echo "✓ Você tem as variáveis de ambiente no Vercel?"
echo "  - WHATSAPP_TOKEN"
echo "  - WHATSAPP_PHONE_NUMBER_ID"
echo "  - WHATSAPP_VERIFY_TOKEN"
echo "  - ANTHROPIC_API_KEY"
echo "  - FIREBASE_SERVICE_ACCOUNT_KEY"
echo ""
echo "✓ Você adicionou o campo 'telefone' em:"
echo "  - usuarios (seu doc, se for admin) OU"
echo "  - produtores (em alguma fazenda)"
echo ""
echo "✓ Vercel já fez deploy do webhook?"
echo "  https://vercel.com/seu-time/confi/deployments"
echo ""
echo "---"

## TESTE 1: Verificar Webhook (GET)
echo ""
echo "🧪 TEST 1: Webhook Verification"
echo "Isso simula o que Meta faz quando você configura o webhook"
echo ""

VERIFY_TOKEN="seu_token_aqui"  # MUDE PARA O SEU TOKEN
WEBHOOK_URL="https://seu-dominio.vercel.app/api/whatsapp/webhook"

echo "GET: $WEBHOOK_URL?hub.mode=subscribe&hub.verify_token=$VERIFY_TOKEN&hub.challenge=12345"
echo ""
echo "Esperado: Status 200 com body: 12345"
echo ""
echo "Para testar via curl:"
echo "curl \"$WEBHOOK_URL?hub.mode=subscribe&hub.verify_token=$VERIFY_TOKEN&hub.challenge=12345\""
echo ""

## TESTE 2: Enviar Mensagem (POST) - Simulado
echo "---"
echo ""
echo "🧪 TEST 2: Simular Webhook POST (teste offline)"
echo "Isso simula uma mensagem chegando do WhatsApp"
echo ""

cat << 'PAYLOAD'
curl -X POST https://seu-dominio.vercel.app/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [
      {
        "id": "123456",
        "changes": [
          {
            "value": {
              "messaging_product": "whatsapp",
              "metadata": {
                "display_phone_number": "1234567890",
                "phone_number_id": "seu_phone_id"
              },
              "messages": [
                {
                  "from": "5567999999999",
                  "id": "wamid.123",
                  "timestamp": "1630700192",
                  "type": "text",
                  "text": {
                    "body": "qual o status do lote 1?"
                  }
                }
              ]
            }
          }
        ]
      }
    ]
  }'
PAYLOAD

echo ""
echo "Mude '5567999999999' para um número que você cadastrou"
echo ""

## TESTE 3: Teste REAL no WhatsApp
echo "---"
echo ""
echo "✅ TEST 3: Teste Real (WhatsApp)"
echo ""
echo "1. Certifique-se que você:"
echo "   ✓ Cadastrou seu número (telefone) em usuarios/produtores"
echo "   ✓ Fez deploy (Vercel)"
echo "   ✓ Esperou 2-3 minutos"
echo ""
echo "2. Abra WhatsApp no seu celular"
echo ""
echo "3. Abra um chat com o número da sua empresa"
echo "   (O número cadastrado em WHATSAPP_PHONE_NUMBER_ID)"
echo ""
echo "4. Envie MENSAGENS DE TESTE:"
echo ""

echo "   📌 Teste 1: Consultar lote"
echo "      Envie: 'qual o status do lote 1?'"
echo "      Esperado: Dados do lote (quantidade, peso, GMD, CMS)"
echo ""

echo "   📌 Teste 2: Dashboard"
echo "      Envie: 'me manda o dashboard'"
echo "      Esperado: KPIs (lotes ativos, total de animais, vendas, mortes)"
echo ""

echo "   📌 Teste 3: Análise Proativa"
echo "      Envie: 'qual a saúde do rebanho?'"
echo "      Esperado: Análise com lotes problemáticos (se houver)"
echo ""

echo "   📌 Teste 4: Alertas"
echo "      Envie: 'alertas operacionais'"
echo "      Esperado: Lista de alertas (CMS crítico, estoque baixo, etc)"
echo ""

echo "   📌 Teste 5: Registrar leitura"
echo "      Envie: 'registrar leitura de cocho do piquete 1 com nota 4'"
echo "      Esperado: Confirmação + novo CMS calculado"
echo ""

## DEBUGGING
echo "---"
echo ""
echo "🐛 SE NÃO FUNCIONAR:"
echo ""
echo "❌ 'Seu número ainda não está autorizado'"
echo "   → Checklist:"
echo "     1. Você adicionou 'telefone' em usuarios ou produtores?"
echo "     2. Formato correto? 5567999999999 (sem + nem espaços)"
echo "     3. Esperou 5 minutos? (cache expira)"
echo "     4. Ativo = true?"
echo ""

echo "❌ 'Deu um erro aqui do meu lado'"
echo "   → Cheque os logs da Vercel:"
echo "     https://vercel.com/seu-time/confi/logs"
echo "     Procure por: [agentService] ou 'Erro'"
echo ""

echo "❌ Webhook não valida (configuração Meta)"
echo "   → Cheque:"
echo "     1. WHATSAPP_VERIFY_TOKEN está correto em Vercel?"
echo "     2. URL do webhook está certa em Meta?"
echo "     3. Servidor está rodando (Vercel não caiu)?"
echo ""

echo "❌ Resposta demora > 10 segundos"
echo "   → Possíveis causas:"
echo "     1. Claude API lenta (network)"
echo "     2. Queries Firestore lentas"
echo "     3. Fila de processamento no Vercel"
echo ""

## MONITORAMENTO
echo "---"
echo ""
echo "📊 MONITORAR EM TEMPO REAL:"
echo ""
echo "1. Logs da Vercel (busque por erros):"
echo "   https://vercel.com/seu-time/confi/logs"
echo ""
echo "2. Histórico de conversas (Firestore):"
echo "   Firestore > whatsappSessoes > {seu_telefone} > mensagens"
echo ""
echo "3. Status das integrações:"
echo "   - Meta Cloud API: https://developers.facebook.com/apps/"
echo "   - Claude API: https://console.anthropic.com/"
echo "   - Firebase: https://console.firebase.google.com/"
echo ""

## LIMPEZA
echo "---"
echo ""
echo "🧹 PARA DELETAR TESTES:"
echo ""
echo "Se quiser apagar o histórico de teste da conversa:"
echo "Firestore > whatsappSessoes > {seu_telefone} > Delete"
echo ""
