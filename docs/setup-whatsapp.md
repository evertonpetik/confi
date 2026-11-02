# Setup: Copiloto WhatsApp + Claude AI para Confi

## Visão Geral

Este guia descreve como configurar e fazer deploy do copiloto inteligente de confinamento que usa WhatsApp para conversa com produtores e tratadores.

## Arquitetura

```
WhatsApp User
    ↓ (mensagem)
Meta Cloud API (Webhook)
    ↓
Vercel: api/whatsapp/webhook.ts
    ├─ Valida autorização (whatsappAuth.ts)
    │  └─ Busca em: usuarios (app) ou produtores (de cada fazenda)
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

### Segurança
```
CRON_SECRET=<token_para_proteger_/api/cron/alertas>
```

## ✅ Autorizar Números de Telefone

**Bom news**: Você já tem tudo pronto! Reutiliza o cadastro existente.

### Opção 1️⃣: Admin/Gestor da App
Se o usuário JÁ está cadastrado em `usuarios` com acesso à app:
```
Firestore > Database > usuarios > [seu_doc]
Adicionar campo:
{
  "telefone": "5567999999999"   # internacional, sem +
}
```
O copiloto vai achar automaticamente.

### Opção 2️⃣: Produtor de uma Fazenda
Se é um produtor (sem acesso admin), adicione telefone no cadastro:
```
Firestore > Database > fazendas > [fazenda_id] > produtores > [produtor_doc]
{
  "telefone": "5567999999999",   # adicione este campo
  "nome": "João da Silva",
  "papel": "produtor",           # ou "tratador"
  "ativo": true
}
```
O copiloto vai achar automaticamente.

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

## Deploy

```bash
git add .
git commit -m "feat: whatsapp auth agora usa cadastro existente de usuarios/produtores"
git push
# Vercel faz auto-deploy
```

## Testar

### Test: Enviar Mensagem (via WhatsApp)
- Use um número que você cadastrou em `usuarios` ou `produtores`
- Envie: "qual o status do lote 1?"
- Esperado: Resposta com dados do lote em ~2-5 segundos

### Test: Analisar Rebanho
- Envie: "qual a saúde do rebanho?"
- Esperado: Análise com lotes e alertas se houver

## Monitoramento

### Logs
- Vercel: https://vercel.com/seu-time/confi/logs

### Firestore - Histórico de Conversas
- Cheque em: `whatsappSessoes/{telefone}/mensagens`

## Funcionalidades

```
1. consultar_lote {numero}
2. consultar_dashboard
3. registrar_leitura_cocho {piqueteNome, nota 1-5}
4. consultar_estoque_insumo {nome}
5. consultar_historico_gmd {numeroLote, dias?}
6. analisar_saude_rebanho
7. alertas_operacionais
```

## Troubleshooting

### "Seu número ainda não está autorizado"
- Cheque se o `telefone` foi adicionado em `usuarios` ou `produtores`
- Use formato: `5567999999999` (sem +, sem espaços)
- Cache expira em 5 minutos

### "Erro ao processar mensagem"
- Cheque `ANTHROPIC_API_KEY` em Vercel
- Cheque `FIREBASE_SERVICE_ACCOUNT_KEY`
- Logs da Vercel têm o erro real

### Resposta demora > 10 segundos
- Cheque performance de queries Firestore
