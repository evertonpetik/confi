# ⚡ Guia Rápido: Teste em 3 Passos

## ✅ PASSO 1: Prepare-se (5 min)

1. **Verifique seu número de telefone**
   ```
   Firestore > usuarios (seu doc)
     OU
   Firestore > fazendas > [sua_fazenda] > produtores > [seu_produtor]
   ```
   - Certifique-se que tem campo `telefone`
   - Formato: `5567999999999` (sem +, sem espaços)

2. **Verifique Vercel**
   - Suas variáveis estão lá?
     - WHATSAPP_TOKEN ✓
     - WHATSAPP_PHONE_NUMBER_ID ✓
     - WHATSAPP_VERIFY_TOKEN ✓
     - ANTHROPIC_API_KEY ✓
     - FIREBASE_SERVICE_ACCOUNT_KEY ✓

3. **Verifique Deploy**
   ```
   https://vercel.com/seu-time/confi/deployments
   ```
   - Vê "Ready" ou status verde? ✓

---

## 🧪 PASSO 2: Teste Webhook (2 min)

Execute o script (use seu OS):

**Windows PowerShell:**
```powershell
# Script rápido - edite com seus dados
$domain = "confi.vercel.app"
$token = "seu_WHATSAPP_VERIFY_TOKEN"
$phone = "5567999999999"

# Teste 1: GET (webhook verification)
$url = "https://$domain/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=$token&hub.challenge=12345"
Invoke-WebRequest -Uri $url

# Esperado: Status 200, Body: 12345
```

**Mac/Linux:**
```bash
# Instale o script
chmod +x test-webhook.sh
./test-webhook.sh

# Responde as perguntas e roda os testes
```

**Ou manual com cURL:**
```bash
curl "https://confi.vercel.app/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=SEU_TOKEN&hub.challenge=12345"

# Esperado: HTTP 200 e body "12345"
```

---

## 💬 PASSO 3: Teste Real no WhatsApp (5 min)

1. **Abra WhatsApp** no seu celular

2. **Procure o chat** com o número da sua empresa
   - (O número que você registrou em `WHATSAPP_PHONE_NUMBER_ID`)

3. **Envie uma das mensagens**:
   ```
   "qual o status do lote 1?"
   ```
   Resposta esperada:
   ```
   📊 Status do lote:
   • Número: 1 | 350 head
   • Peso: 420kg | GMD: 1.2
   • CMS: 2.4%
   ✅ Rebanho saudável
   ```

4. **Tente outras mensagens**:
   ```
   "me manda o dashboard"
   "qual a saúde do rebanho?"
   "alertas operacionais"
   "registrar leitura de cocho do piquete 1 com nota 4"
   ```

---

## ✔️ Como saber que funcionou

| Indicador | ✅ Tá bom | ❌ Problema |
|-----------|----------|-----------|
| **Webhook (GET)** | HTTP 200 + body é o challenge | HTTP não 200 |
| **Webhook (POST)** | HTTP 200 | HTTP não 200 ou erro |
| **Histórico** | Mensagens aparecem em Firestore | Nada em `whatsappSessoes` |
| **WhatsApp** | Respostas em 2-5 seg | Sem resposta ou lentidão |
| **Logs** | Sem `ERROR` ou `Erro` | Há erros em Vercel logs |

---

## 🐛 Troubleshooting Rápido

### ❌ "Seu número ainda não está autorizado"
```
✓ Adicione telefone em usuarios ou produtores
✓ Use formato: 5567999999999 (sem +)
✓ Aguarde 5 min (cache expira)
✓ Ativo = true
```

### ❌ "Deu um erro aqui do meu lado"
```
✓ Cheque Vercel logs: https://vercel.com/seu-time/confi/logs
✓ Procure por: [agentService] ou Erro
✓ Comum: ANTHROPIC_API_KEY inválida
```

### ❌ HTTP 404 no webhook
```
✓ URL está correta? Sem typo?
✓ Domínio está certo em Vercel?
✓ Deploy finalizou? (status verde)
```

### ❌ Sem resposta (timeout)
```
✓ Claude API pode estar lenta
✓ Firestore pode estar lentos
✓ Aguarde 30 seg (Meta desiste se > 30s)
```

---

## 📊 Monitorar Tudo

**Logs em tempo real:**
```
https://vercel.com/seu-time/confi/logs
```

**Ver conversas:**
```
Firestore > whatsappSessoes > {seu_telefone} > mensagens
```

**Histórico completo:**
```
Firestore > whatsappSessoes > qualquer_telefone > mensagens
(você vê conversas de TODOS os usuários - útil para debug)
```

---

## 🎉 Pronto!

Se chegou aqui e tudo funcionou:

✅ Seu copiloto está **VIVO**  
✅ Recebendo mensagens do WhatsApp  
✅ Processando com Claude IA  
✅ Respondendo com análise inteligente  

Próximos passos:
- 🔄 Usar por 1-2 semanas para feedback
- 🚀 Adicionar mais ferramentas conforme necessário
- 📈 Monitorar performance nos logs

**Divirta-se! 🎊**
