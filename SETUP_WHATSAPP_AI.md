
# Setup: Copiloto WhatsApp + Claude AI para Confi

## Visão Geral

Este guia descreve como configurar e fazer deploy do copiloto inteligente de confinamento que usa WhatsApp para conversar com produtores e tratadores.

## Arquitetura

```
WhatsApp User
    ↓ (mensagem)
Meta Cloud API (Webhook)
    ↓
Vercel: api/whatsapp/webhook.ts
    ├─ Valida autorização (whatsappAuth.ts)
    ├─ Consulta histórico da conversa (Firestore)
    ├─ Chama Claude API com context (agentService.ts)
    │   └─ Claude usa "tools" para consultar dados (agentTools.ts)
    └─ Envia resposta via Meta Cloud API
    ↓
WhatsApp User (mensagem de volta)
```

## Pré-requisitos

1. **Firebase Project** - Confi 5c988
2. **Meta Business Account** - Com permissão WhatsApp Cloud API
3. **Anthropic Account** - Para Claude API
4. **Vercel Account** - Deploy do webhook

## Variáveis de Ambiente (Vercel)

Defina as seguintes no painel da Vercel:

### WhatsApp
```
WHATSAPP_TOKEN=<seu_access_token>
WHATSAPP_PHONE_NUMBER_ID=<seu_phone_number_id>
WHATSAPP_VERIFY_TOKEN=<um_token_aleatorio_que_voce_cria>
```

### Claude (Anthropic)
```
ANTHROPIC_API_KEY=sk-ant-...
```

### Firebase (Service Account)
```
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
```

Gere a chave em: Firebase Console → Project Settings → Service Accounts → Generate New Private Key

Se for grande demais, pode fazer Base64:
```bash
cat firebase-key.json | base64 -w 0
```

### Segurança
```
CRON_SECRET=<token_para_proteger_/api/cron/alertas>
```

## Configurar WhatsApp Cloud API

### 1. Obter Access Token
- Ir a: https://developers.facebook.com/apps/
- Selecionar sua app
- Ir a: WhatsApp > API Setup
- Copiar "Access Token" permanente
- Salvar como `WHATSAPP_TOKEN`

### 2. Obter Phone Number ID
- Em API Setup, há um "Phone number ID"
- Salvar como `WHATSAPP_PHONE_NUMBER_ID`

### 3. Configurar Webhook
- Em WhatsApp > Configuration
- Webhook URL: `https://seu-dominio.vercel.app/api/whatsapp/webhook`
- Verify Token: use o valor de `WHATSAPP_VERIFY_TOKEN`
- Subscribe to messages: ✅
- Clica "Verify and Save"

Meta vai fazer um GET para seu webhook. Se vir erro, cheque:
- `WHATSAPP_VERIFY_TOKEN` está correto?
- Sua função Vercel está deployada?
- Você tem internet? 😄

## Autorizar Números de Telefone

Usuários precisam ser cadastrados em `whatsappUsuarios` (coleção Firestore raiz):

```
Firestore > Database > whatsappUsuarios > Add document
{
  "telefone": "5567999999999",      # internacional, sem +
  "fazendaId": "fazenda-001",        # OBRIGATÓRIO - vincula ao Firestore
  "produtorId": "produtor-123",      # opcional
  "nome": "João Silva",
  "papel": "produtor",               # "admin" | "tratador" | "produtor"
  "ativo": true
}
```

## Deploy

```bash
# 1. Commit & push
git add src/services/agentService.ts src/services/agentTools.ts src/services/whatsappFormatter.ts
git commit -m "chore: melhorias na IA do copiloto - análise proativa"
git push

# 2. Vercel faz auto-deploy
# Acompanha em: https://vercel.com/seu-time/confi/deployments
```

## Testar

### Test 1: Webhook Verification
```bash
curl -X GET "http://localhost:3001/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=seu_token&hub.challenge=test_challenge"
# Esperado: 200 com body "test_challenge"
```

### Test 2: Enviar Mensagem (via WhatsApp)
- Use um número cadastrado em `whatsappUsuarios`
- Envie: "qual o status do lote 1?"
- Esperado: Resposta com dados do lote em ~2-5 segundos

### Test 3: Testar Tool
- Envie: "quais os alertas operacionais?"
- Esperado: Lista de problemas/alertas detectados

## Monitoramento

### Logs
- Vercel Logs: https://vercel.com/seu-time/confi/logs
- Procura por erros em: `[agentService]`, `Erro na Claude API`

### Firestore
- Cheque em: `whatsappSessoes/{telefone}/mensagens`
- Histórico de todas as conversas

### Alertas Agendados
- Vercel Cron: `/api/cron/alertas` roda diariamente às 9 AM
- Logs: https://vercel.com/seu-time/confi/cron-jobs

## Troubleshooting

### "Erro ao processar mensagem"
- Cheque se `ANTHROPIC_API_KEY` está correto
- Cheque se Firebase está inicializado: `FIREBASE_SERVICE_ACCOUNT_KEY`
- Logs da Vercel: o erro real está lá

### "Seu número ainda não está autorizado"
- Adicione o telefone em `whatsappUsuarios`
- Use formato: `5567999999999` (sem +, sem espaços)

### Webhook não valida
- Verifique `WHATSAPP_VERIFY_TOKEN`
- Cheque se URL está acessível (sem firewall)

### Resposta demora > 10 segundos
- Meta pode descartar (espera ~30s)
- Cheque performance de queries Firestore
- Considere cache se muita repetição

## Funcionalidades Disponíveis

### Tools para o Copiloto
```
1. consultar_lote {numero}
   → status atual do lote

2. consultar_dashboard
   → KPIs gerais do confinamento

3. registrar_leitura_cocho {piqueteNome, nota 1-5}
   → registra leitura e ajusta CMS automaticamente

4. consultar_estoque_insumo {nome}
   → quantidade e preço médio

5. consultar_historico_gmd {numeroLote, dias?}
   → GMD dos últimos dias

6. analisar_saude_rebanho
   → análise geral de saúde (novo!)

7. alertas_operacionais
   → alertas críticos (novo!)
```

## Próximos Passos

1. ✅ Deploy inicial
2. ✅ Testar com alguns números autorizados
3. 🔄 Coletar feedback de 1-2 semanas
4. 🚀 Expandir para mais ferramentas de análise (veja agentTools.ts)
5. 🧪 Adicionar testes automatizados

## Contato & Suporte

- Documentação técnica: `DOCUMENTACAO_TECNICA.md`
- Código do agente: `src/services/agentService.ts` e `agentTools.ts`
- Firebase Admin: `src/services/firestoreServiceServer.ts`
