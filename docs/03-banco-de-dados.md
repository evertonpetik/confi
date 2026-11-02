# 03 — Estrutura do Banco de Dados (Firestore + Storage)

[← Voltar ao índice](./README.md)

Projeto Firebase: **`confi-5c988`** (bucket `confi-5c988.firebasestorage.app`). Sem Prisma/SQL — todo o modelo é documental.

## 1. Camada de acesso

`src/services/firestoreService.ts` expõe uma API única (`getCollection`, `queryCollection`, `getDocument`, `addDocument`, `setDocument`, `updateDocument`, `deleteDocument`, `createBatch`, helpers `fsWhere/fsOrderBy/fsLimit`) e escolhe a implementação por `Platform.OS` (web: `firebase/firestore` modular com cache persistente multi-aba; nativo: `@react-native-firebase/firestore`). Versão para servidor em `firestoreServiceServer.ts` (firebase-admin, credencial em `FIREBASE_SERVICE_ACCOUNT_KEY`).

Datas são gravadas como **strings** (`yyyy-mm-dd` para datas civis, ISO 8601 para instantes). Nenhum campo usa `Timestamp` do Firestore.

## 2. Modelo multi-tenant

```ts
const ROOT_COLLECTIONS = new Set(["usuarios", "fazendas"]);          // cliente
const ROOT_COLLECTIONS = new Set(["usuarios", "fazendas", "whatsappSessoes"]); // servidor

function resolvePath(colPath) {
  if (!_currentFazendaId) return colPath;                 // sem fazenda → raiz (legado)
  if (ROOT_COLLECTIONS.has(colPath[0])) return colPath;   // raiz ou já absoluto ("fazendas", id, ...)
  return ["fazendas", _currentFazendaId, ...colPath];     // escopo da fazenda
}
```

Consequência: o código escreve `getCollection("lotes")` e o documento real fica em `fazendas/{fazendaId}/lotes`. Serviços do iFarm usam caminhos absolutos `["fazendas", fazendaId, "bovinos"]`, que passam intactos. As funções `*Raw*` ignoram o prefixo (usadas para `usuarios`, `fazendas` e migração).

## 3. Árvore de coleções

```
usuarios/{uid}
fazendas/{fazendaId}
├── config/app                              ← tema e preferências da fazenda
│
│   ── iConfi ──
├── produtores/{id}
├── lotes/{id}
│   ├── movimentacoes/{id}
│   ├── leituras/{id}
│   ├── embarquesAgendados/{id}
│   └── estimativasPeso/{id}
├── insumos/{id}
│   ├── compras/{id}
│   ├── saidas/{id}
│   └── conferencias/{id}
├── dietas/{id}
├── roteiros/{id}
├── historicoMapaTrato/{roteiroId}_{yyyy-mm-dd}
├── estimativasPesoAvulsas/{id}
├── raca · categoria · compensatorio · implante · tamanhoCorporal · gec · aditivos
├── piquetes · vagao · notaLeitura · movimentacao · parametros · configuracoesIA
│
│   ── iFarm ──
├── bovinos/{sisbov}
│   ├── pesagens/{id}
│   └── eventos_sanitarios/{id}
├── eventos/{id}                            ← append-only, coleção plana
├── movimentacoes/{id}                      ← MovimentacaoBovino (fluxo WeighingContext)
├── pedidos_brinco/{id}
├── gtas/{id}
├── locais/{id}
├── protocolos/{id}
├── processos_mangueiro/{id}
├── processos_sisbov/{id}                   ← legado/pouco usado
│
│   ── Abastecimento ──
├── tanques/{id}
├── veiculos/{id}
└── abastecimentos/{id}

whatsappSessoes/{telefone}/mensagens/{timestamp_u|a}   ← raiz (servidor)
whatsappUsuarios/{id}                                   ← raiz (lido só pelo cron; cadastro externo)
lotes/{…}                                               ← raiz, legado pré multi-tenant (rules permitem)
```

---

## 4. Coleções raiz

### 4.1 `usuarios/{uid}` — ID = UID do Firebase Auth
| Campo | Tipo | Descrição |
| --- | --- | --- |
| nome | string | Nome exibido |
| email | string | E-mail de login |
| tipo | `"admin" \| "gestor" \| "cliente" \| "tratador"` | Papel (padrão `cliente`) |
| fazendas | string[] | IDs das fazendas permitidas (admin ignora) |
| modulos | `("iconfi" \| "ifarm" \| "abastecimento")[]` | Módulos liberados |
| telas | string[] \| null? | Rotas liberadas (ex.: `["home","leitura","tratador"]`). Ausente/null/vazio = todas as telas dos módulos. Ignorado para admin. Catálogo em `src/constants/telas.ts` |
| telefone | string? | Número WhatsApp (E.164 sem `+`) para o copiloto |

### 4.2 `fazendas/{fazendaId}`
| Campo | Tipo | Descrição |
| --- | --- | --- |
| nome | string | Nome da fazenda |
| criadoEm | string? | ISO |

### 4.3 `whatsappSessoes/{telefone}/mensagens/{id}`
ID = `${Date.now()}_u` (usuário) ou `_a` (assistente).
| Campo | Tipo | Descrição |
| --- | --- | --- |
| role | `"user" \| "assistant"` | |
| content | string | Texto |
| timestamp | number | Epoch ms (ordenação; últimas 20 viram contexto) |

### 4.4 `whatsappUsuarios/{id}` (consumido por `api/cron/alertas.ts`)
`fazendaId`, `produtorId`, `telefone`, `ativo`. A autenticação do webhook **não** usa esta coleção — usa `usuarios.telefone` e `produtores.telefone`.

---

## 5. Configuração da fazenda

### `config/app`
| Campo | Tipo | Descrição |
| --- | --- | --- |
| primaryColor | string | Cor primária (#RRGGBB) |
| logoUrl | string | URL do logo no Storage |
| baseCmsLeitura | `"realizado" \| "previsto"` | Base do CMS do dia na leitura de cocho (padrão realizado) |

### Tabelas auxiliares (seed em `utils/seedTabelasAuxiliares.ts`)
| Coleção | Campos | Observação |
| --- | --- | --- |
| `raca` | descricao, fator | Fator NRC |
| `categoria` | descricao, fator | Informativa; chave do GEC |
| `compensatorio` | descricao, fator | |
| `implante` | descricao, fator | |
| `tamanhoCorporal` | descricao, fator (3–9) | `fator` vira o TC usado no GEC |
| `gec` | descricao, tamanhoCorporal (1–9), categoria, fator | 36 linhas |
| `aditivos` | descricao, fator | Chave = `dieta.aditivoNome` |
| `piquetes` | descricao, capacidade | |
| `vagao` | descricao, capacidade (kg) | |
| `notaLeitura` | descricao ("1"–"5"), fator | |
| `movimentacao` | descricao, tipo (`"Entrada" \| "Saida"`) | Tipos de movimentação de lote |
| `parametros` | descricao (`tempoMS`, `custo_operacional`), valor (number) | |
| `configuracoesIA` | descricao (`ANTHROPIC_API_KEY`), valor | Chave usada pela estimativa de peso |

---

## 6. iConfi

### 6.1 `produtores/{id}`
| Campo | Tipo |
| --- | --- |
| nome, abreviacao, fazenda, cidade, uf, inscricaoEstadual, telefone, email, cpfCnpj | string |
| papel | string? (`produtor`/`tratador`, usado pelo WhatsApp) |
| ativo | boolean? |

### 6.2 `lotes/{id}`
| Campo | Tipo | Descrição |
| --- | --- | --- |
| numero | number | Sequencial |
| raca, categoria, compensatorio, implante, tamanhoCorporal | string | `descricao` das tabelas auxiliares |
| produtor, produtorId | string | Desnormalizado + referência |
| gmdEstimado | number | kg/dia |
| pesoAbate | number? | Meta de peso de abate (kg) |
| ativo | boolean | |
| piqueteId, piqueteNome | string | Vazios quando inativo |
| dietaId, dietaNome | string? | Presentes em dados legados |

**`lotes/{id}/movimentacoes/{id}`**
| Campo | Tipo | Descrição |
| --- | --- | --- |
| evento | `"Entrada" \| "Saida"` | |
| movimentacao | string | Tipo (Compra, Venda, Morte, Transferência…) |
| data | string `yyyy-mm-dd` | |
| quantidade | number | Cabeças |
| pesoMedio | number | kg |
| observacao | string | |

**`lotes/{id}/leituras/{id}`**
| Campo | Tipo | Descrição |
| --- | --- | --- |
| data | string | Dia da leitura |
| nota | string | "1"–"5", "Ajuste", "Repetir Previsto" |
| fator | number | Fator aplicado (0 ajuste fino, 1 repetir previsto) |
| cmsAnterior, cmsNovo | number | % PV |
| criadoEm | number | Epoch ms — desempate entre leituras do mesmo dia |

**`lotes/{id}/embarquesAgendados/{id}`**
| Campo | Tipo |
| --- | --- |
| data | string `yyyy-mm-dd` |
| quantidade | number |
| observacao | string |
| status | `"agendado" \| "cancelado"` |
| createdAt | string ISO |

**`lotes/{id}/estimativasPeso/{id}`** e **`estimativasPesoAvulsas/{id}`**
| Campo | Tipo |
| --- | --- |
| data, hora | string |
| pesoEstimado, confiancaMin, confiancaMax, escoreCondicaoCorporal | number |
| metodo | `"ia_visual" \| "modelo_local"` |
| observacao | string |
| loteId, loteNumero, raca, categoria, pesoProjetadoSistema | nullable |

### 6.3 `insumos/{id}`
| Campo | Tipo | Descrição |
| --- | --- | --- |
| nome | string | |
| percentualMateriaSeca | number | MS vigente (atualizada pelas conferências) |
| materiaSecaVariavel | boolean | Habilita conferências |
| autonomiaMinimaDias | number? | Limite para alerta de estoque baixo |

**`compras/{id}`**: `data`, `quantidade` (kg), `precoKg` (R$).
**`saidas/{id}`** (ID = `{roteiroId}_{data}_{insumoId}` quando gerada pelo trato — regravar a carga no mesmo dia sobrescreve em vez de duplicar): `data`, `quantidade`, `precoKg` (MPM no momento), `origem` (`"mapa-trato"`), `roteiroId`, `roteiroNumero`.
**`conferencias/{id}`**:
| Campo | Tipo | Descrição |
| --- | --- | --- |
| data | string | |
| percentualMS | number | Resultado (0–100) |
| tara, pesoInicialBruto | number? | gramas (só secagem) |
| pesagens | `{tempoMin, pesoBruto}[]`? | Repesagens |
| finalizada | boolean? | `false` = em andamento; ausente = finalizada |
| observacao | string? | |

### 6.4 `dietas/{id}`
| Campo | Tipo |
| --- | --- |
| nome | string |
| percentualMS | number |
| ndt | number |
| aditivoId, aditivoNome | string |
| ativo | boolean |
| insumos | `{insumoId, insumoNome, percentual}[]` (base MS, soma 100) |

### 6.5 `roteiros/{id}`
| Campo | Tipo |
| --- | --- |
| numero | number |
| dietaId, dietaNome | string |
| piquetes | `{piqueteId, piqueteNome}[]` (ordem de descarga) |
| minTratos | number |
| ativo | boolean |

### 6.6 `historicoMapaTrato/{roteiroId}_{data}`
| Campo | Tipo | Descrição |
| --- | --- | --- |
| data | string | Dia |
| roteiroId, roteiroNumero, dietaId, dietaNome, vagaoId, vagaoNome | | Contexto |
| totalMS, totalMO | number | Previstos (kg) |
| numTratos | number | |
| cargas | `CargaTrato[]` | Por trato: `{tratoNumero, insumos: [{insumoId, insumoNome, previsto, realizado, percentualMS}], aguaPrevista, aguaRealizada}` |
| descargas | `DescargaTrato[]` | Por trato: `{tratoNumero, itens: [{piqueteId, piqueteNome, loteNumero, previsto, realizado}]}` |
| percentualMSFinal | number | %MS real da carga |
| custoTotal | number | R$ |
| custoPorLote | `{loteId, loteNumero, piqueteNome, custo}[]` | |
| msPorLote | `{loteId, loteNumero, piqueteNome, totalMO, previsto, totalMS, cmsPrevisto, cmsRealizado, gmdEstimado, gmdReal}[]` | Preenchido na descarga |

---

## 7. iFarm (tipos em `src/services/weighing.types.ts`)

### 7.1 `bovinos/{id}` — ID = número SISBOV
| Campo | Tipo | Descrição |
| --- | --- | --- |
| id, sisbov | string | 15 dígitos com DV |
| manejo | string | 6 dígitos |
| chipRfid | string? | 15 dígitos do transponder |
| nome | string | Ex.: "Nelore 807803" |
| categoria | `bezerro \| novilho \| novilha \| touros \| vacas \| bois` | |
| raca | string | |
| sexo | `"M" \| "F"` | |
| dataNascimento | string | Ponto médio da faixa da GTA |
| pesoEntrada, pesoAnterior | number? | kg |
| dataUltimaPesagem, dataEntrada, dataSaida | string? | ISO |
| motivoSaida | `venda \| abate \| morte \| transferencia \| outro`? | |
| farmedaId | string | FK fazenda (grafia histórica) |
| loteId, loteNome, piqueteId | string? | |
| ativo | boolean | |
| pelagem, pai, mae, propriedadeOrigem, municipioOrigem, estadoOrigem | string? | |
| certificacao | `{numeroInscricao, certificado, dataCertificacao?, numeroOrdemBrinco?, codigoEstabelecimento?}` | SISBOV |
| proprietario | `{tipo: "proprio" \| "terceiro", nome, cpfCnpj?}` | Boitel |
| metadados | `{processoId, gtaIds, origem, faixaEtaria, regime, localId, localNome, racaCodigo?}` | Contexto da entrada |
| criadoEm, atualizadoEm | string | |

**`bovinos/{id}/pesagens/{id}`** (`Pesagem`)
| Campo | Tipo |
| --- | --- |
| animalId, sisbov | string |
| peso, pesoPrevisto?, diferencaPeso? | number |
| dataHora | string ISO |
| tipoPesagem | `entrada \| transferencia \| saida \| retorno` |
| leituraChip | `{chipRfid, timestamp, sinSinal, dispositivoId, valido, erro?}` |
| leituraPeso | `{peso, timestamp, status: aguardando\|instavel\|estavel\|timeout, dispositivoId, valido, erro?}` |
| farmedaId, usuarioId | string |
| fotoPesagem?, observacoes? | string |
| validacao? | `{validoPorSisbov, validadoEm?, validadoPor?}` |
| sincronizado | boolean |
| criadoEm, atualizadoEm | string |

**`bovinos/{id}/eventos_sanitarios/{id}`** (`EventoSanitario`)
`animalId`, `tipo` (`vacinacao | vermifugacao | tratamento | exame | outro`), `descricao` (produto), `dataAplicacao`, `dose?`, `via?` (`subcutanea | intramuscular | oral | topica | intravenosa`), `tecnico?`, `crmv?`, `lote?`, `validade?`, `reentrada?` (liberação para abate), `proxAplicacao?`, `observacoes?`, `farmedaId`, `criadoEm`.

### 7.2 `eventos/{id}` — append-only
| Campo | Tipo | Descrição |
| --- | --- | --- |
| animalId, sisbov, manejo | string | Identificação redundante |
| tipo | `cadastro \| pesagem \| movimentacao \| sanitario \| saida \| certificacao \| estorno` | |
| dataHora | string ISO | Quando o fato ocorreu |
| processoId, gtaId | string? | Contexto |
| faixaEtaria | string? | Label da faixa (cadastro) |
| observacoes | string? | |
| peso | number? | pesagem |
| de, para | `{regime?, localId?, localNome?}`? | movimentacao / cadastro / saida |
| sanitario | `{protocoloId?, protocoloNome?, tipo, produto, dose?, via?, lote?, validade?, carenciaAte?, proximaEm?}`? | |
| motivoSaida | string? | |
| eventoEstornadoId | string? | estorno |
| usuarioId, usuarioNome? | string | |
| origem | `mangueiro \| manual \| importacao` | |
| farmedaId, criadoEm | string | |

Correções nunca editam/apagam: grava-se um `estorno` apontando o original.

### 7.3 `movimentacoes/{id}` (`MovimentacaoBovino`)
`animalId`, `sisbov`, `tipo`, `dataHora`, `pesoAoMover`, `pesagem` (objeto), `de?/para?` (`{tipo: lote|piquete|externo|abate|venda, id?, nome?}`), `farmedaId`, `usuarioId`, `documentos?` (`{gta?, certificadoOriginacao?, nfeId?}`), `observacoes?`, `criadoEm`.

### 7.4 `pedidos_brinco/{id}`
| Campo | Tipo |
| --- | --- |
| fabrica, numeroPedidoMapa | string |
| sisbovInicial, sisbovFinal | string (15) |
| manejoInicial, manejoFinal | string (6) |
| brincosTotal | number |
| proximoIndice | number (0-based, incrementado por transação) |
| anulados | `{sisbov, manejo, motivo: defeito\|danificado\|perdido\|outro, observacoes?, dataHora, usuarioId}[]`? |
| ativo | boolean |
| farmedaId, criadoEm, atualizadoEm? | string |

### 7.5 `gtas/{id}`
| Campo | Tipo |
| --- | --- |
| numero, serie, uf | string |
| procCpfCnpj, procNome, procFazenda, procCodigoMapa, procInscricaoEstadual, procMunicipio, procUf, procRegiao? | string |
| destCpfCnpj, destNome, destFazenda, destCodigoMapa, destInscricaoEstadual, destMunicipio, destUf, destRegiao? | string |
| finalidade, transporte, rota?, unidadeExpedidora? | string |
| animais | `{descricao, quantidade, sexo: M\|F\|ambos, idadeCategoria?}[]` |
| totalMachos, totalFemeas, total | number |
| dataEmissao, dataValidade | string |
| status | `ativa \| vencida \| processada` |
| pdfUrl, pdfPath | string? (Storage — nunca base64 no doc) |
| farmedaId, criadoEm | string |

### 7.6 `locais/{id}`
`nome`, `tipo` (`piquete | baia | curral | pasto | outro`), `capacidade?`, `regime` (`pasto | confinamento | boitel | semi_confinamento`), `ativo`, `farmedaId`.

### 7.7 `protocolos/{id}`
`nome`, `descricao?`, `itens: {tipo, produto, dose?, via?, carenciaDias?, repetirEmDias?}[]`, `ativo`, `farmedaId`, `criadoEm`.

### 7.8 `processos_mangueiro/{id}`
| Campo | Tipo |
| --- | --- |
| nome | string |
| tipo | `entrada \| saida \| transferencia` |
| status | `aberto \| em_andamento \| concluido \| cancelado` |
| gtaIds | string[] |
| totalAnimaisPrevisto, animaisManejados | number |
| pedidoBrincoId | string? (entrada) |
| fazendaOrigemNome, fazendaDestinoId, fazendaDestinoNome | string? |
| dataAbertura, dataConclusao? | string |
| observacoes? | string |
| farmedaId, usuarioId, criadoEm | string |

### 7.9 `processos_sisbov/{id}` (legado)
`nome`, `gtaIds`, `animalIds`, `status` (`aberto | aguardando_certificadora | aprovado | rejeitado`), `dataAbertura`, `dataEnvio?`, `dataResposta?`, `observacoes?`, `farmedaId`, `criadoEm`.

---

## 8. Abastecimento

### `tanques/{id}`
`nome`, `tipoCombustivel`, `capacidadeLitros`, `localizacao` (`fixo | movel`), `nivelAtual`, `alertaNivelMinimo`, `ativo`.

### `veiculos/{id}`
`nome`, `placa`, `tipo` (`veiculo | maquina | equipamento`), `tipoMarcador` (`km | horimetro | nenhum`), `tipoCombustivel`, `marcadorAtual`, `ativo`.

### `abastecimentos/{id}`
| Campo | Tipo | Descrição |
| --- | --- | --- |
| data, hora | string | `yyyy-mm-dd`, `HH:mm` |
| veiculoId, veiculoNome, veiculoTipo | string | |
| tanqueId, tanqueNome | string | |
| litros | number | |
| marcadorAnterior, marcadorAtual | number | km ou horas |
| consumo | number \| null | L por km/h |
| fotoBomba, fotoPainel | string | URI local |
| ocrLitros, ocrMarcador | number \| null | Valores sugeridos pelo OCR |
| observacao | string | |
| criadoOffline | boolean | |
| criadoEm | string ISO | |

---

## 9. Regras de segurança (`firestore.rules`)

```
usuarios/{uid}      read: próprio ou admin · create: próprio · update/delete: próprio ou admin
fazendas/{id}       read: temAcessoAFazenda · write: admin
fazendas/{id}/**    read/write: temAcessoAFazenda(id)   (admin OU id ∈ perfil().fazendas)
lotes/**            read/write: autenticado            (legado raiz)
tudo o mais         negado
```
`perfil()` faz `get()` em `usuarios/{request.auth.uid}`. As coleções raiz `whatsappSessoes`/`whatsappUsuarios` só são acessadas pelo backend (firebase-admin, que ignora rules).

### Storage (`storage.rules`)
```
fazendas/{fazendaId}/**   read: temAcessoAFazenda · write: temAcessoAFazenda e tamanho < 20 MB
tudo o mais               negado
```
Conteúdo: PDFs das GTAs em `fazendas/{fazendaId}/gtas/{serie}{numero}.pdf`. O logo é enviado para `config/logo.png` (raiz do bucket), caminho que as regras atuais **não** autorizam — candidato a correção (mover para `fazendas/{fazendaId}/config/logo.png`).

## 10. Índices compostos (`firestore.indexes.json`)

| Coleção (collectionGroup, escopo COLLECTION) | Campos |
| --- | --- |
| `eventos` | animalId ASC, dataHora DESC — linha do tempo do animal |
| `eventos` | processoId ASC, dataHora ASC — eventos do processo (fechamento) |
| `eventos` | tipo ASC, dataHora ASC — relatório de pesagens por período |
| `movimentacoes` | animalId ASC, dataHora DESC — movimentações do animal |

Consultas com `orderBy` simples (`leituras` por `data`, `pesagens` por `dataHora`, `gtas` por `dataEmissao`, `pedidos_brinco`/`processos_mangueiro` por `criadoEm`) usam índices automáticos. `protocolos` e `locais` filtram/ordenam em memória de propósito, para não depender de índice.

Publicação: `firebase deploy --only firestore:rules,firestore:indexes,storage`.

## 11. Migração e seed

- `utils/migrateToMultiTenant.ts` — copia da raiz para `fazendas/{id}/…` (preservando IDs) as coleções simples (`raca … parametros`, `dietas`, `roteiros`, `produtores`, `historicoMapaTrato`), `lotes` (+ `movimentacoes`, `leituras`) e `insumos` (+ `compras`, `saidas`, `conferencias`). Executar uma vez por fazenda.
- `utils/seedTabelasAuxiliares.ts` — cria 12 tabelas auxiliares via batch, pulando as que já têm dados.
- `utils/prefetchFirestore.ts` — aquece o cache offline: 21 coleções de topo + subcoleções de lotes e insumos.
