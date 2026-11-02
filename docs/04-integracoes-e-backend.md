# 04 — Integrações e Backend

[← Voltar ao índice](./README.md)

## 1. Mapa de infraestrutura

| Onde | Componente | Runtime |
| --- | --- | --- |
| Vercel (`confi-gilt.vercel.app`) | Web build do app (`dist/`) + `api/*` | Node 18+/Edge |
| Firebase Functions (`southamerica-east1`) | `consultarGTA`, `resolverCaptchaSintegra`, `extrairTextoGta` | Node (v2 `onRequest`) |
| Firebase | Firestore, Auth, Storage | — |
| Meta | WhatsApp Cloud API (Graph) | — |
| Anthropic | Messages API | — |
| Groq | Whisper `whisper-large-v3-turbo` | — |
| Capsolver | reCAPTCHA v2 | — |
| MAPA / IAGRO | Consulta pública de GTA (`pga.agricultura.gov.br`) | — |
| SEFAZ-MS | Consulta pública Sintegra (`servicos.efazenda.ms.gov.br`) | — |
| IBGE | Localidades (UF/município) | — |

`vercel.json`: build `npx expo export --platform web`; rewrite de tudo que não é `/api`, `/_expo`, `/assets` para `index.html`; cron `0 9 * * *` → `/api/cron/alertas`.

## 2. Variáveis de ambiente

| Variável | Onde | Uso |
| --- | --- | --- |
| `EXPO_PUBLIC_FIREBASE_*` (API_KEY, AUTH_DOMAIN, PROJECT_ID, STORAGE_BUCKET, MESSAGING_SENDER_ID, APP_ID, MEASUREMENT_ID) | app (eas.json / Vercel) | Config do SDK web |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Vercel | JSON da service account para `firestoreServiceServer.ts` |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN` | Vercel | Cloud API e verificação do webhook |
| `ANTHROPIC_API_KEY` | Vercel | Copiloto (`agentService.ts`) |
| `GROQ_API_KEY` | Vercel | Transcrição de áudio |
| `CRON_SECRET` | Vercel | Protege `/api/cron/alertas` (`Authorization: Bearer`) |
| `EXTRAIR_TEXTO_GTA_URL` | Vercel (opcional) | Sobrescreve URL da Cloud Function |
| `CAPSOLVER_API_KEY` | Functions | Resolver reCAPTCHA (MAPA e SEFAZ) |
| `ANTHROPIC_API_KEY` em `configuracoesIA` (Firestore) | app | Estimativa de peso por imagem (cliente) |

Setup detalhado do WhatsApp em [setup-whatsapp.md](./setup-whatsapp.md); do Bluetooth em [setup-bluetooth.md](./setup-bluetooth.md).

---

## 3. Endpoints Vercel (`api/`)

| Rota | Método | Runtime | Função |
| --- | --- | --- | --- |
| `/api/whatsapp/webhook` | GET | Node | Verificação Meta (`hub.mode=subscribe`, `hub.verify_token`) → devolve `hub.challenge` |
| `/api/whatsapp/webhook` | POST | Node | Recebe mensagens (texto/áudio), autentica o número, roda o agente, responde e persiste histórico |
| `/api/cron/alertas` | GET | Node | Varre todas as fazendas, detecta CMS fora de ±10 % e envia WhatsApp aos `whatsappUsuarios` do produtor |
| `/api/anthropic` | POST | Edge | Proxy transparente para `api.anthropic.com/v1/messages` (header `x-api-key` do cliente); resolve CORS na web |
| `/api/gta` | POST | Edge | Proxy `{barcode}` → Cloud Function `consultarGTA` |
| `/api/gta-texto` | POST | Node (body 25 MB) | Proxy `{pdfs: base64[]}` → Cloud Function `extrairTextoGta` |
| `/api/sintegra` | POST | Node (60 s) | `{inscricaoEstadual, captchaToken}` → sessão + POST no SEFAZ-MS → devolve HTML |
| `/api/captcha-sintegra` | POST | Node | Proxy → `resolverCaptchaSintegra` |

Observação de concorrência: `setCurrentFazendaId` é variável de módulo; o webhook reseta para `null` no início e no `finally` e **não pode** virar Edge Function nem paralelizar fazendas diferentes na mesma requisição.

## 4. Cloud Functions (`functions/index.js`)

| Export | Config | O que faz |
| --- | --- | --- |
| `consultarGTA` | 120 s, 256 MiB | Abre sessão no portal do MAPA, resolve reCAPTCHA v2 via Capsolver (`createTask`/`getTaskResult`, polling 3 s × 30), submete o código de barras e parseia o HTML em `GTAData` (identificação, espécie, emissão, origem, destino, animais[], totalAnimais) |
| `resolverCaptchaSintegra` | 120 s, 256 MiB | Resolve o reCAPTCHA do SEFAZ-MS e devolve `{token}` (CORS habilitado; chamada direta do app) |
| `extrairTextoGta` | 60 s, 512 MiB | Recebe até 20 PDFs em base64, descomprime streams FlateDecode (`zlib`) e extrai operadores de texto → `{resultados: [{indice, texto|erro}]}` |

---

## 5. Copiloto WhatsApp + Claude

### 5.1 Fluxo (`api/whatsapp/webhook.ts`)
1. `parseIncomingWebhook` extrai `from`, `messageId`, `type` (text/audio), `text`/`audioId`/`mimeType`. Eventos de status são ignorados (200 imediato).
2. `markAsRead(messageId)`.
3. `getUsuarioAutorizado(telefone)` (`whatsappAuth.ts`, cache 5 min):
   - procura `usuarios` com `telefone` igual → usa a **primeira fazenda** do perfil, papel = `tipo`;
   - senão percorre `fazendas/*/produtores` procurando `telefone` → papel `produtor` (ou `papel` do doc).
   - Não autorizado → mensagem padrão.
4. `setCurrentFazendaId(usuario.fazendaId)` — a partir daqui tudo é escopado.
5. Áudio: `getMediaUrl` + `downloadMedia` (Graph API) → `transcreverAudio` (Groq Whisper).
6. Carrega as últimas 20 mensagens de `whatsappSessoes/{from}/mensagens`.
7. `processarMensagem(historico, texto, usuario)` (`agentService.ts`).
8. `sendWhatsAppText` e grava os dois turnos (`_u`, `_a`).

### 5.2 Agente (`agentService.ts`)
- Modelo `claude-sonnet-5`, `max_tokens` 1024, até **5 rodadas** de tool-use por mensagem.
- System prompt: respostas curtas para WhatsApp, sempre consultar dados via tools, análise proativa (GMD baixo, CMS fora de 1,8–3,2 %, insumo < 15 dias), estrutura problema → causa → solução → próximo passo, oferecer ações.
- Erros 401/429/500 geram mensagens específicas ao usuário.

### 5.3 Ferramentas (`agentTools.ts`)

| Tool | Entrada | Lê/grava |
| --- | --- | --- |
| `consultar_lote` | `numero` | `lotes` + `movimentacoes` + `leituras`: qtd, peso projetado, GMD estimado, CMS atual, piquete |
| `consultar_dashboard` | — | KPIs: lotes ativos, animais, entradas, vendas, mortes |
| `registrar_leitura_cocho` | `piqueteNome`, `nota` 1–5 | Grava em `lotes/{id}/leituras` com a mesma fórmula da tela (base do dia + `CMS_BASE × (fator − 1)`) |
| `consultar_estoque_insumo` | `nome` | Estoque e MPM a partir de `compras`/`saidas` |
| `consultar_historico_gmd` | `numeroLote`, `dias` (7) | `historicoMapaTrato.msPorLote.gmdReal` |
| `analisar_saude_rebanho` | — | GMD vs meta, lotes problemáticos, mortalidade |
| `alertas_operacionais` | — | CMS crítico, estoques baixos, anomalias de GMD |

`whatsappFormatter.ts` limita respostas a ~1 000 caracteres e formata análises com bullets/emojis.

### 5.4 WhatsApp Cloud API (`whatsappService.ts`)
`https://graph.facebook.com/v21.0/{PHONE_NUMBER_ID}/messages` para `sendWhatsAppText` (type text) e `markAsRead`; `/{mediaId}` para URL de mídia; download autenticado por Bearer token. Alertas proativos fora da janela de 24 h exigem template aprovado (não implementado — ver comentário em `api/cron/alertas.ts`).

---

## 6. Pesagem Bluetooth e Serial

### 6.1 Dispositivos
| Dispositivo | Papel | Transporte |
| --- | --- | --- |
| Balança **BPB 085 / ACR HD Easy** (Açores) | Peso | BLE Nordic UART Service (NUS) — service `6e400001-…`, TX write `6e400002-…`, RX notify `6e400003-…`. No navegador: Web Serial |
| Leitor **XRS2i** (Tru-Test) | Chip RFID (EID 15 dígitos) | BLE NUS |

### 6.2 `bluetoothService.ts` (nativo, `react-native-ble-plx`)
- `descobrirDispositivos` → identifica tipo pelo nome; `conectar`/`desconectar`; listeners `onPeso`, `onChip`, `onErro`, `onDispositivoConectado/Desconectado`.
- `subscritoPeso`: localiza serviço NUS (ou primeiro não padrão), assina RX, guarda TX e inicia **polling** do comando de peso a cada 700 ms. Comandos `tara` e `batt`.
- `subscritoChip`: assina RX do leitor.
- Parsers e formatos em [02-calculos.md §13](./02-calculos.md#13-dispositivos-de-pesagem-parsing).
- Erros tipados (`BLE_POWERED_OFF`, `BLE_PARSE_PESO_ERROR`, `BLE_PARSE_CHIP_ERROR`, …) com flag `recuperavel`.

### 6.3 `serialService.web.ts` / `serialService.ts`
Web Serial API no navegador (porta por tipo balança/rfid, baud rate, `write`, polling `;peso\r\n` 700 ms, `tara`, reconexão de portas já autorizadas). No nativo é um stub (`isSupported: false`).

### 6.4 `WeighingContext.tsx`
Orquestra sessão (`SessaoPesagem`), timeouts, estabilização (`status === "estavel"` → etapa `confirmacao`) e grava via `PesagemFirestoreService.salvarPesagem` (validação em §12.4 dos cálculos).

---

## 7. GTA — importação por PDF e consulta online

### 7.1 Importação (`gtaImportService.ts`, `gtaParser.ts`, `gtaPdfParser(.web).ts`)
1. PDFs → base64 (em blocos de 32 KB).
2. **Web**: extração local com `DecompressionStream` (`gtaPdfParser.web.ts`); falhas vão ao servidor. **Nativo**: sempre servidor (`/api/gta-texto`, lotes de 20).
3. `parseGtaText(texto)` → `Partial<GTA>` (número, série, UF, procedência/destino completos, finalidade, transporte, animais com faixa etária/sexo/quantidade, totais, datas). Verificado contra 3 guias reais (`scripts/verificar-gta.ts`).
4. `conferirLoteDeGtas` aponta origens/destinos divergentes e guias repetidas.
5. PDF original vai ao Storage via `uploadBase64` (`pdfUrl`/`pdfPath` no doc).

### 7.2 Consulta (`gtaService.ts`)
`consultarGTA(barcode)` → `/api/gta` (web) ou URL absoluta da Vercel (nativo) → Cloud Function → `GTAData`.

## 8. Sintegra (`sintegraService.ts`)
1. `POST resolverCaptchaSintegra` → `{token}`.
2. `POST /api/sintegra {inscricaoEstadual, captchaToken}` → HTML do SEFAZ-MS → parse para `SintegraData` (razão social, CNPJ/CPF, IE, endereço, situação…).

## 9. SISBOV / Certificadora
- Regras de numeração e conferências: `services/sisbov.ts` ([cálculos §11](./02-calculos.md#11-sisbov--numeração-e-conferências)).
- **Planilha de campo** (`planilhaCampo.ts`): colunas `Sisbov;Manejo;Sexo;Raca;DataNasc;Data identificação`, CSV com BOM e `;`, XLSX com todas as células em texto (preserva zeros à esquerda).
- **Pacote** (`fechamentoProcesso.ts::montarPacoteCertificadora`): ZIP (`zip.ts`, modo *store*, sem dependências) com `.xlsx`, `.csv`, `gtas/GTA-{serie}{numero}.pdf` e `resumo.txt`.
- `xlsx.ts`: gerador OOXML mínimo sem o pacote `xlsx` do npm (motivo: vulnerabilidades abertas).
- `downloadArquivo.ts`: salvar/compartilhar bytes (web: download; nativo: `expo-file-system` + `expo-sharing`).

## 10. OCR, QR Code e IA de imagem
- **OCR**: `@react-native-ml-kit/text-recognition` (nativo). `ocrService.web.ts` é stub. Regras em [cálculos §14.1](./02-calculos.md#141-ocr-servicesocrservicets-ml-kit).
- **QR do veículo**: `qrCodeService.ts` gera/parseia JSON `{"type":"confi_veiculo","id","nome","tipoMarcador"}`; leitura com `expo-camera`, geração com `react-native-qrcode-svg`.
- **Estimativa de peso**: `aiWeightEstimation.ts` (Anthropic, visão) e `localWeightEstimation.ts` (TFLite `assets/models/cattle_weight_model.tflite`, treinado em `notebooks/train_cattle_weight.ipynb`). Detalhes em [cálculos §15](./02-calculos.md#15-estimativa-de-peso-por-imagem).

## 11. Firebase no cliente
- `firebaseConfig.js`: web usa `initializeApp` + `initializeFirestore` com `persistentLocalCache({ tabManager: persistentMultipleTabManager() })`; nativo exporta `@react-native-firebase` (`google-services.json`, `GoogleService-Info.plist`).
- `authService.ts`: `signIn`, `signOut`, `onAuthStateChanged`; criação de usuários pelo admin usa um app secundário para não trocar a sessão.
- `storageService.ts`: `uploadFile`, `uploadBase64`, `uploadBlob`, `getDownloadUrl`, `deleteFile`, `baixarBytes`.

## 12. Build e distribuição
- `app.json`: `com.evertompetik.confi` (iOS/Android), scheme `confi`, versão 1.0.1, plugins expo-router, @react-native-firebase/app e auth, expo-build-properties, datetimepicker, image-picker, fast-tflite, camera; permissões Bluetooth/localização.
- `eas.json`: perfis `development` (dev client), `preview` (APK interno), `production` (auto-increment); variáveis Firebase embutidas.
- Web: `npx expo export --platform web` → Vercel.

## 13. Qualidade e verificação
`npm run verificar` executa os cinco scripts de `scripts/` (SISBOV, GTA, PDF, planilha, MS) e `tsc --noEmit`. Os módulos verificados são puros, sem React Native, justamente para rodar em Node.
