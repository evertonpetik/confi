#!/bin/bash
# test-webhook.sh - Script prático para testar o webhook

set -e

# Cores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Teste do Webhook WhatsApp + Claude${NC}\n"

# 1. Pedir dados do usuário
read -p "Digite seu domínio Vercel (ex: confi.vercel.app): " DOMAIN
read -p "Digite seu WHATSAPP_VERIFY_TOKEN: " VERIFY_TOKEN
read -p "Digite seu telefone para teste (ex: 5567999999999): " PHONE_NUMBER
read -p "Digite seu ANTHROPIC_API_KEY (para debug): " -s API_KEY
echo ""

WEBHOOK_URL="https://${DOMAIN}/api/whatsapp/webhook"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}TEST 1: Webhook Verification (GET)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo "URL: $WEBHOOK_URL"
echo "Teste 1/3..."
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" \
  "${WEBHOOK_URL}?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=test_challenge_12345")

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
  if [ "$BODY" = "test_challenge_12345" ]; then
    echo -e "${GREEN}✅ PASS: Webhook verification OK${NC}"
    echo -e "  Status: 200"
    echo -e "  Body: $BODY\n"
  else
    echo -e "${RED}❌ FAIL: Body incorreto${NC}"
    echo -e "  Esperado: test_challenge_12345"
    echo -e "  Recebido: $BODY\n"
  fi
else
  echo -e "${RED}❌ FAIL: HTTP $HTTP_CODE${NC}"
  echo -e "  Body: $BODY\n"
fi

# 2. Teste POST - Simular mensagem
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}TEST 2: POST - Simular mensagem WhatsApp${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo "Teste 2/3..."
echo "Enviando mensagem: 'qual o status do lote 1?'"
echo ""

PAYLOAD=$(cat <<EOF
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "123456",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "1234567890",
          "phone_number_id": "11111111111"
        },
        "messages": [{
          "from": "${PHONE_NUMBER}",
          "id": "wamid.test.123",
          "timestamp": "$(date +%s)",
          "type": "text",
          "text": {
            "body": "qual o status do lote 1?"
          }
        }]
      }
    }]
  }]
}
EOF
)

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✅ PASS: Webhook recebeu POST${NC}"
  echo -e "  Status: 200"
  echo -e "  Response: $BODY"
  echo ""
  echo -e "${YELLOW}⏱️  A IA está processando... Aguarde 2-5 segundos${NC}"
  echo -e "${YELLOW}    Verifique em Firestore: whatsappSessoes > ${PHONE_NUMBER} > mensagens${NC}\n"
else
  echo -e "${RED}❌ FAIL: HTTP $HTTP_CODE${NC}"
  echo -e "  Body: $BODY"
  echo ""
  echo -e "${YELLOW}⚠️  Possíveis problemas:${NC}"
  echo -e "  1. Número ${PHONE_NUMBER} não está cadastrado?"
  echo -e "  2. ANTHROPIC_API_KEY inválida?"
  echo -e "  3. Firebase não inicializou?"
  echo ""
  echo -e "  Cheque logs em: https://vercel.com/seu-time/confi/logs\n"
fi

# 3. Teste WhatsApp Real
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}TEST 3: Teste Real no WhatsApp${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo "Teste 3/3..."
echo ""
echo -e "${YELLOW}📱 Instruções para teste real:${NC}"
echo ""
echo "1. Abra WhatsApp no seu celular"
echo "2. Envie mensagem para seu número de empresa"
echo "3. Teste com uma destas mensagens:"
echo ""
echo "   → 'qual o status do lote 1?'"
echo "   → 'me manda o dashboard'"
echo "   → 'qual a saúde do rebanho?'"
echo "   → 'alertas operacionais'"
echo ""
echo "4. Aguarde 2-5 segundos pela resposta"
echo ""

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✨ Testes automáticos concluídos!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo -e "${YELLOW}📊 Monitoramento:${NC}"
echo "  Logs: https://vercel.com/seu-time/confi/logs"
echo "  Mensagens: Firestore > whatsappSessoes > ${PHONE_NUMBER} > mensagens"
echo ""

echo -e "${YELLOW}🐛 Se der erro:${NC}"
echo "  - 'Sua número ainda não está autorizado' → Adicione telefone em usuarios/produtores"
echo "  - 'Deu um erro aqui do meu lado' → Cheque logs da Vercel"
echo "  - Sem resposta → Firestore/Claude API fora"
echo ""
