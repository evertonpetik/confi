# Confi — Documentação Técnica Completa

> Sistema de gestão pecuária multi-fazenda (confinamento, rastreabilidade SISBOV e controle de combustível).
> Gerada a partir da análise do código-fonte em 02/11/2026.

## Índice dos documentos

| Arquivo | Conteúdo |
| --- | --- |
| [01-modulos-e-telas.md](./01-modulos-e-telas.md) | Os três módulos (iConfi, iFarm, Abastecimento), fluxo de entrada, navegação, descrição funcional de todas as 32 telas, contextos React e componentes |
| [02-calculos.md](./02-calculos.md) | Todas as fórmulas do sistema extraídas do código: NRC/GMD, CMS, mapa de trato, matéria seca, custos, SISBOV, faixas etárias, combustível, pesagem, IA |
| [03-banco-de-dados.md](./03-banco-de-dados.md) | Modelo multi-tenant do Firestore, árvore de coleções, schema de cada documento, regras de segurança, índices e Storage |
| [04-integracoes-e-backend.md](./04-integracoes-e-backend.md) | API serverless (Vercel), Cloud Functions, copiloto WhatsApp + Claude, Bluetooth (balança/RFID), importação de GTA, SISBOV, Sintegra, OCR, TFLite, exportações, variáveis de ambiente, scripts de verificação |
| [setup-whatsapp.md](./setup-whatsapp.md) | Guia de configuração do copiloto WhatsApp (Meta, Vercel, variáveis de ambiente, troubleshooting) |
| [setup-bluetooth.md](./setup-bluetooth.md) | Guia de build nativo e pareamento da balança e do leitor RFID |

---

## 1. Visão geral

O **Confi** é um aplicativo React Native/Expo (Android, iOS e Web) que atende três frentes de uma propriedade pecuária, cada uma como um módulo com menu próprio:

| Módulo | Identificador | Propósito |
| --- | --- | --- |
| **iConfi** | `iconfi` | Gestão de confinamento: lotes, dietas, insumos, leitura de cocho, mapa de trato (carga/descarga), cálculo de GMD pelo modelo NRC, custos, análise de lote, estimativa de peso por IA |
| **iFarm** | `ifarm` | Rebanho e rastreabilidade SISBOV: pedidos de brinco, importação de GTA, processos de mangueiro (entrada com pesagem via Bluetooth), histórico de eventos por animal (append-only), protocolos sanitários, fechamento para a certificadora |
| **Abastecimento** | `abastecimento` | Controle de combustível: tanques, veículos/máquinas com QR Code, registro de abastecimento com fotos + OCR, consumo (km/L ou L/h) e histórico |

Complementam o sistema um **copiloto por WhatsApp** (Claude + ferramentas que leem/gravam no Firestore), um **cron diário de alertas**, e integrações com **MAPA (consulta de GTA)**, **SEFAZ-MS (Sintegra)**, **Anthropic**, **Groq (Whisper)** e dispositivos **BLE** (balança e leitor RFID).

## 2. Stack tecnológica

| Camada | Tecnologia |
| --- | --- |
| Framework | React Native 0.81 + Expo SDK 54, React 19, TypeScript strict |
| Roteamento | Expo Router v6 (file-based), drawer customizado (`src/app/(app)/_layout.tsx`) |
| Banco | Firebase Firestore — SDK web modular (`firebase`) na web; `@react-native-firebase/*` no nativo; `firebase-admin` no backend |
| Autenticação | Firebase Auth (e-mail/senha). Perfil em `usuarios/{uid}` |
| Arquivos | Firebase Storage (PDFs de GTA, logo) |
| Backend serverless | Vercel Functions (`api/`) — Node e Edge; Vercel Cron |
| Cloud Functions | Firebase Functions v2 (`functions/index.js`), região `southamerica-east1` |
| IA | Anthropic Messages API (copiloto `claude-sonnet-5`; visão `claude-sonnet-4-20250514`), Groq Whisper (áudio), TFLite local (`react-native-fast-tflite`) |
| Hardware | `react-native-ble-plx` (BLE/NUS), Web Serial no navegador, `expo-camera` (QR), ML Kit (`@react-native-ml-kit/text-recognition`) |
| Gráficos | `react-native-gifted-charts` |
| Build/Deploy | EAS Build (`eas.json`: development / preview APK / production), Vercel (`npx expo export --platform web` → `dist/`) |
| Offline | Cache persistente do Firestore (multi-aba na web) + prefetch inicial (`src/utils/prefetchFirestore.ts`) |
| Path alias | `@/*` → `./src/*` |

## 3. Arquitetura em alto nível

```
┌──────────────────────── App Expo (web / Android / iOS) ────────────────────────┐
│  src/app            telas (expo-router)                                        │
│  src/contexts       AuthContext · ThemeContext · DrawerContext · WeighingContext│
│  src/components     cards, modais de formulário, LinhaDoTempo, etc.            │
│  src/utils          mapaTratoCalc · loteCalcCore · materiaSecaCalc · ...       │
│  src/services       firestoreService (abstração web/nativo) + serviços de      │
│                     domínio (brinco, evento, protocolo, gta, pesagem, BLE...)  │
└──────────────┬──────────────────────────────┬──────────────────────────────────┘
               │ Firestore / Storage / Auth   │ HTTPS
               ▼                              ▼
   ┌───────────────────────┐     ┌───────────────────────────────────────────┐
   │ Firebase (confi-5c988)│     │ Vercel  (confi-gilt.vercel.app)           │
   │  fazendas/{id}/...    │◄────┤  /api/whatsapp/webhook  (Claude + tools)  │
   │  usuarios/{uid}       │     │  /api/cron/alertas      (diário 09:00)    │
   │  whatsappSessoes      │     │  /api/anthropic  /api/gta  /api/gta-texto │
   │  Storage: fazendas/.. │     │  /api/sintegra  /api/captcha-sintegra     │
   └───────────┬───────────┘     └───────────────┬───────────────────────────┘
               │                                 │
               ▼                                 ▼
   ┌───────────────────────┐     ┌───────────────────────────────────────────┐
   │ Cloud Functions v2    │     │ Serviços externos                         │
   │  consultarGTA (MAPA)  │     │  Meta WhatsApp Cloud API · Anthropic      │
   │  resolverCaptcha...   │     │  Groq Whisper · Capsolver · MAPA · SEFAZ  │
   │  extrairTextoGta      │     └───────────────────────────────────────────┘
   └───────────────────────┘
```

**Camada de dados única:** todo acesso ao Firestore passa por `src/services/firestoreService.ts`, que (a) escolhe a implementação web ou nativa, (b) aceita caminhos como `string[]` e (c) **prefixa automaticamente `fazendas/{fazendaAtual}/`** em qualquer coleção que não seja raiz. Isso faz o mesmo código servir a várias fazendas. Detalhes em [03-banco-de-dados.md](./03-banco-de-dados.md#2-modelo-multi-tenant).

## 4. Estrutura de diretórios

```
confi/
├── api/                      # Vercel Functions
│   ├── anthropic.js          # proxy Edge p/ Anthropic (estimativa de peso na web)
│   ├── gta.js                # proxy → Cloud Function consultarGTA
│   ├── gta-texto.js          # proxy → Cloud Function extrairTextoGta
│   ├── sintegra.js           # proxy SEFAZ-MS (consulta por IE + captcha)
│   ├── captcha-sintegra.js   # proxy → Cloud Function resolverCaptchaSintegra
│   ├── cron/alertas.ts       # cron diário de alertas de CMS via WhatsApp
│   └── whatsapp/webhook.ts   # webhook Meta → agente Claude
├── functions/index.js        # Cloud Functions: consultarGTA, resolverCaptchaSintegra, extrairTextoGta
├── src/
│   ├── app/
│   │   ├── _layout.tsx       # providers raiz + guarda de rota
│   │   ├── index.tsx         # login
│   │   ├── selecao-fazenda.tsx
│   │   ├── selecao-modulo.tsx
│   │   └── (app)/            # 32 telas autenticadas + _layout (ver 01-modulos-e-telas.md)
│   ├── components/           # 36 componentes
│   ├── contexts/             # Auth, Theme, Drawer, Weighing
│   ├── hooks/useResponsive.ts
│   ├── services/             # ~48 arquivos (Firestore, BLE, GTA, SISBOV, WhatsApp, IA...)
│   └── utils/                # cálculos puros, seed, migração, prefetch, validadores
├── scripts/verificar-*.ts    # verificações executáveis dos cálculos críticos (npm run verificar)
├── notebooks/train_cattle_weight.ipynb  # treino do modelo TFLite de peso
├── firestore.rules · firestore.indexes.json · storage.rules · firebase.json
├── app.json · eas.json · vercel.json · firebaseConfig.js
└── docs/                     # esta documentação
```

## 5. Fluxo de entrada no app

```
index.tsx (login e-mail/senha)
   └─► AuthContext carrega usuarios/{uid}
         ├─ primeiro usuário do sistema → criado como admin automaticamente
         └─ perfil existente → lista fazendas permitidas
              └─► selecao-fazenda.tsx  (admin vê todas; demais só as do array `fazendas`)
                    └─► selecao-modulo.tsx (filtra por `modulos` do perfil; 1 módulo = auto-seleção)
                          └─► (app)/_layout.tsx
                                ├─ 1ª vez na fazenda: prefetch de 21 coleções p/ cache offline (@lastSync:{fazendaId})
                                └─ drawer com rotas do módulo + Configurações (+ Usuários se admin)
```

Fazenda e módulo selecionados ficam em AsyncStorage (`@selectedFazendaId`, `@selectedFazendaNome`, `@selectedModulo`) e são restaurados no próximo login.

## 6. Papéis de usuário

| `tipo` | Permissões |
| --- | --- |
| `admin` | Vê todas as fazendas e módulos; único que pode criar/editar fazendas e usuários (tela *Usuários*) e escrever no documento da fazenda |
| `gestor` | Acesso às fazendas e módulos listados no perfil; leitura/escrita total dentro delas |
| `cliente` | Idem gestor (a diferenciação é apenas semântica; as regras do Firestore tratam ambos igualmente) |

No WhatsApp existem ainda os papéis `produtor` e `tratador`, atribuídos quando o número é encontrado em `produtores` de uma fazenda (ver 04).

## 7. Scripts npm

| Script | Função |
| --- | --- |
| `npm start` / `android` / `ios` / `web` | Expo dev server |
| `npm run verificar` | Roda todas as verificações abaixo + `tsc --noEmit` |
| `verificar:sisbov` | Regras de numeração SISBOV, embarque de terceiros (dados reais do lote 807803–807862) |
| `verificar:gta` | Parser de e-GTA contra 3 guias reais (IAGRO/MS série Q) + faixas do processo |
| `verificar:pdf` | Extração de texto da Cloud Function `extrairTextoGta` |
| `verificar:planilha` | Integridade estrutural do ZIP/XLSX gerado à mão |
| `verificar:ms` | Conferência de matéria seca (bagaço de cana: tara 1306 g, 1605 g → 58,2 %) |

## 8. Glossário

| Termo | Significado |
| --- | --- |
| CMS | Consumo de Matéria Seca, expresso em % do peso vivo |
| MS / MO | Matéria Seca / Matéria Original (natural, com umidade) |
| NDT | Nutrientes Digestíveis Totais da dieta (%) |
| GMD | Ganho Médio Diário (kg/dia) |
| NRC | National Research Council — modelo nutricional usado para estimar GMD |
| DE, ME, NEm, NEg | Energia Digestível, Metabolizável, Líquida de Manutenção, Líquida de Ganho (Mcal/kg) |
| SBW / EQSBW | Shrunk Body Weight (peso em jejum) / Equivalent SBW |
| GEC | Grau de Estrutura Corporal (fator tamanho corporal × categoria) |
| Piquete | Curral onde fica um lote. Cada piquete comporta um lote ativo |
| Roteiro | Sequência de piquetes servidos com a mesma dieta por um vagão |
| Trato | Uma viagem do vagão (carga + descarga) |
| Leitura de cocho | Nota visual 1–5 da sobra no cocho que ajusta o CMS do dia |
| SISBOV | Sistema Brasileiro de Identificação Individual de Bovinos — número de 15 dígitos com DV |
| Manejo | 6 dígitos (posições 9–14 do SISBOV) impressos no brinco visual |
| Chip RFID | Transponder de 15 dígitos; termina com os 4 últimos dígitos do manejo |
| GTA | Guia de Trânsito Animal (e-GTA) |
| Mangueiro | Curral de manejo onde se faz a entrada (brinco + chip + peso) |
| Processo | Lote de animais sendo manejado contra um conjunto de GTAs (entrada/saída/transferência) |
| Certificadora | Empresa que valida o SISBOV; recebe planilha de campo + PDFs das GTAs |
| Boitel | Animal de terceiro hospedado no confinamento |
| MPM | Média Ponderada Móvel (custeio do estoque de insumos) |
