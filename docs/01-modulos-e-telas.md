# 01 — Módulos, Navegação e Telas

[← Voltar ao índice](./README.md)

## 1. Os três módulos

A seleção de módulo (`src/app/selecao-modulo.tsx`) oferece ao usuário apenas os módulos presentes em `usuarios/{uid}.modulos` (admin vê todos). O drawer (`src/app/(app)/_layout.tsx`) monta o menu a partir do catálogo `src/constants/telas.ts` (`menuDoModulo`), filtrando pelas **telas permitidas** do perfil (`usuarios/{uid}.telas`); uma guarda de rota no mesmo layout redireciona para a primeira tela permitida quem tenta abrir uma rota não liberada.

| Módulo | Rotas do menu | Rotas internas (sem item de menu) |
| --- | --- | --- |
| **iConfi** | home, produtores, lotes, leitura, insumos, dietas, roteiros, mapa-trato, tratador, estimativa-peso, analise-lote, relatorio-historico | — |
| **iFarm** | home-ifarm, animais, movimentacoes, sanidade, consulta-gta, pesagem-lista, processos | pesagem-leitura, pesagem-historico, pesagem-balanca, animal-detalhe, brincos, fechar-processo |
| **Abastecimento** | home-abastecimento, tanques, veiculos, abastecimento, historico-combustivel | — |
| **Comuns** | configuracoes, signup (só admin) | — |

Rodapé do drawer: *Trocar Módulo*, *Trocar Fazenda*, *Sair*. O drawer é fixo (280 px) em desktop (≥ 1024 px) e deslizante em telas menores (`DrawerContext` + `Animated`).

## 2. Telas de entrada (fora do módulo)

### `index.tsx` — Login
Formulário e-mail/senha via Firebase Auth (`authService.signIn`). Após autenticar, `AuthContext.loadUserProfile` lê `usuarios/{uid}`. Se a coleção `usuarios` estiver vazia, o primeiro usuário é gravado como `admin` (bootstrap). Usuário autenticado sem documento em `usuarios` fica sem acesso.

### `selecao-fazenda.tsx`
Lista as fazendas permitidas (ordenadas por nome). Admin pode criar uma nova fazenda inline (`addRawDocument(["fazendas"])`). Ao selecionar, chama `setCurrentFazendaId`, que passa a prefixar todas as consultas.

### `selecao-modulo.tsx`
Cards iConfi / iFarm / Abastecimento. Com um único módulo disponível, seleciona automaticamente após 300 ms. Sem módulos, exibe aviso para contatar o administrador.

### `(app)/_layout.tsx`
Na primeira abertura de cada fazenda executa `prefetchAllData` (21 coleções + subcoleções de lotes e insumos) para popular o cache offline e grava `@lastSync:{fazendaId}`. Envolve as telas em `WeighingProvider` e `DrawerProvider`.

## 3. Contextos React

| Contexto | Arquivo | Estado gerenciado |
| --- | --- | --- |
| `AuthContext` | `src/contexts/AuthContext.tsx` | `user`, `userProfile` (nome, email, tipo, fazendas[], modulos[]), fazenda e módulo selecionados, lista de fazendas; `signIn/signOut/selectFazenda/clearFazenda/selectModulo/clearModulo`. Persiste seleção em AsyncStorage |
| `ThemeContext` | `src/contexts/ThemeContext.tsx` | `primaryColor` (padrão `#3366FF`) e `logoUrl`. Lê do AsyncStorage e depois de `config/app` da fazenda; gravações sincronizam nos dois |
| `DrawerContext` | `src/contexts/DrawerContext.tsx` | `isOpen`, `open/close/toggle`, `progress` (Animated.Value) do drawer mobile |
| `WeighingContext` | `src/contexts/WeighingContext.tsx` | Sessão de pesagem Bluetooth: dispositivos descobertos/conectados, última leitura de chip e de peso, animal identificado, etapa (`aguardando_chip → lendo_chip → aguardando_peso → lendo_peso → confirmacao → concluida`), configuração (`timeoutLeituraChip` 10 s, `timeoutLeituraPeso` 30 s, `timeoutEstabilizacao` 5 s), erros recentes. Expõe `iniciarDescoberta`, `conectarBalanca`, `conectarRfid`, `iniciarPesagem`, `identificarAnimal`, `confirmarPesagem`, `cancelarPesagem` |

---

## 4. Módulo iConfi — Confinamento

### 4.1 `home.tsx` — Dashboard
Painel principal do confinamento. Lê `lotes` (+ `movimentacoes`, `leituras`, `embarquesAgendados`), `historicoMapaTrato`, `insumos` (+ `compras`, `saidas`, `conferencias`), `parametros`, `roteiros`, `dietas`.

- **KPIs**: lotes ativos, total de animais, entradas, vendas, mortes.
- **Alertas**: insumos com conferência de MS vencida (parâmetro `tempoMS` em dias — só conferências *finalizadas* contam); insumos com estoque baixo (autonomia ≤ `autonomiaMinimaDias`); embarques agendados para hoje.
- **Relatório de lotes** (tabela com mapa de calor nas colunas de CMS): piquete, lote, dieta, qtde, produtor, categoria, data de entrada, peso de entrada, dias, raça, MO/cab e MS/cab de ontem, CMS %PV ontem, MO/cab e MS/cab previstos, CMS %PV previsto, leitura de cocho de hoje, GMD estimado, peso projetado, GMD real médio, peso real, CMS %PV médio. Linhas com embarque agendado são destacadas.
- **Trocar roteiro de um piquete** (`handleTrocarRoteiro`): move o piquete para outro roteiro, atualizando o array `piquetes` de origem e destino (destino reordenado por `compararPiquetes`).
- **Transferência entre lotes** (`handleTransferirLote`) e **agendamento de embarque** (`AgendarEmbarqueModal`) direto do relatório.
- **Gerar PDF** do relatório (`expo-print`, paisagem 842×595) para compartilhar.

Fórmulas em [02-calculos.md §1 e §6](./02-calculos.md).

### 4.2 `produtores.tsx`
CRUD de produtores (`ProdutorCard`, `ProdutorFormModal`). Busca UF/município na API do IBGE; valida CPF/CNPJ (`utils/validators.ts`). O campo `telefone` é usado pelo copiloto WhatsApp para autorizar produtores.

### 4.3 `lotes.tsx`
CRUD de lotes e suas movimentações. Carrega tabelas auxiliares (`raca`, `categoria`, `compensatorio`, `implante`, `tamanhoCorporal`, `produtores`, `movimentacao`, `piquetes`) e o `historicoMapaTrato` para o financeiro.

- `LoteFormModal`: número sequencial automático, raça, categoria, compensatório, implante, tamanho corporal, produtor, GMD estimado, **peso de abate** (meta), piquete (só piquetes livres), ativo. Permite criar produtor inline.
- `MovimentacaoFormModal`: Entrada/Saída com tipo (da tabela `movimentacao`), data, quantidade, peso médio, observação. Saída que zera o lote inativa-o e remove o piquete de todos os roteiros.
- `TransferenciaLoteModal`: transfere animais entre lotes (`services/transferenciaLote.ts`) gerando Saída na origem e Entrada no destino com tipo "Transferência".
- `AgendarEmbarqueModal`: grava em `lotes/{id}/embarquesAgendados` (data, quantidade, observação, status `agendado`/`cancelado`). Embarque total previsto para hoje tira o lote do mapa de trato; parcial reduz a quantidade.
- `FaturamentoModal`: lista por dia os kg de MS consumidos e o custo do lote (de `historicoMapaTrato.custoPorLote` / `msPorLote`) e o custo acumulado.
- Inativar lote limpa piquete e o remove dos roteiros; excluir lote exige confirmação.

### 4.4 `insumos.tsx`
CRUD de insumos (`InsumoCard`, `InsumoFormModal`, `CompraFormModal`, `ConferenciaMSModal`).

- Campos: nome, % matéria seca, `materiaSecaVariavel`, `autonomiaMinimaDias`.
- **Compras** (`compras`): data, quantidade (kg), preço/kg. Exibe estoque e preço médio ponderado móvel.
- **Conferência de MS** (para insumos com MS variável): dois modos — *Nova Secagem* (tara, peso inicial bruto, repesagens a 60 min e depois 10 min até estabilizar; pode ficar "em andamento") e *Informar %MS* direto. Ao finalizar, a %MS da conferência finalizada mais recente vira `percentualMateriaSeca` do insumo.
- Renomear insumo propaga o nome para `dietas[].insumos[].insumoNome`. Excluir apaga `compras`, `saidas` e `conferencias`.

### 4.5 `dietas.tsx`
CRUD de dietas (`DietaCard`, `DietaFormModal`). Composição por insumo em % na base MS (soma obrigatória = 100 %, tolerância 0,01), %MS da dieta (manual ou automática via toggle *Manter MS*), NDT (0–100), aditivo (tabela `aditivos`). Exibe custo R$/kg MS. Permite criar insumo inline.

### 4.6 `roteiros.tsx`
CRUD de roteiros (`RoteiroCard`, `RoteiroFormModal`): número, dieta (só dietas ativas), lista ordenada de piquetes (define ordem de descarga; oferece apenas piquetes ocupados por lotes ativos), `minTratos`, ativo. Permite criar dieta e insumo inline.

### 4.7 `leitura.tsx` — Leitura de Cocho
Lista lotes ativos com piquete, ordenados por `compararPiquetes` (prefixo "piquete" < "rinc" < "rn", depois número). Para cada lote mostra o CMS vigente e as notas 1–5 (tabela `notaLeitura`, cores verde/laranja/vermelho conforme fator > 1, = 1, < 1).

- Marcar nota grava documento em `lotes/{id}/leituras` e recalcula o CMS a partir da **base do dia** (realizado ou previsto de ontem, conforme `config/app.baseCmsLeitura`), de modo que remarcar não acumula.
- **Ajuste fino** ± 0,01 % (`fator: 0`), **Repetir Previsto** (`fator: 1`, força `cmsNovo = cmsPrevisto de ontem`).
- **Alertas**: CMS realizado de ontem fora de `[cmsPrevisto × menorFator, cmsPrevisto × maiorFator]`.

### 4.8 `mapa-trato.tsx`
Planejamento e execução do trato por roteiro (desktop). Fluxo: escolher vagão → ver roteiros calculados (`buildCalcData`) → `CargaModal` (insumos e água realizados por trato) → `DescargaModal` (kg descarregados por piquete, com CMS realizado e GMD em tempo real).

- Salvar carga: grava `insumos/{id}/saidas/{roteiroId}_{data}_{insumoId}` (uma por insumo/roteiro/dia, `setDocument` idempotente), calcula `%MS final`, `custoTotal`, `custoPorLote` (proporcional ao previsto) e grava `historicoMapaTrato/{roteiroId}_{data}`.
- Salvar descarga: calcula `msPorLote` (MO/MS realizados, CMS previsto × realizado, GMD estimado × real via NRC) e redistribui `custoPorLote` proporcional ao realizado.
- Exporta/importa **CSV** (ingredientes por dieta e descarga por piquete/trato; match por nome normalizado sem acento).

### 4.9 `tratador.tsx`
Versão mobile em wizard para o operador do vagão: `SELECT_VAGAO → SELECT_ROTEIRO → CARREGAMENTO → DESCARREGAMENTO → CONCLUIDO`, com indicador de tratos (dots) e detecção automática do próximo trato pendente (`detectNextTrato`). Navegação horizontal entre insumos/piquetes, valores pré-preenchidos com o previsto arredondado. Usa exatamente os mesmos cálculos e gravações do mapa de trato.

### 4.10 `estimativa-peso.tsx`
Foto do animal (câmera ou galeria) → estimativa de peso. Dois métodos: **IA visual** (Anthropic, chave em `configuracoesIA` com `descricao = "ANTHROPIC_API_KEY"`; passa raça, categoria, tamanho corporal, peso projetado e GMD como contexto) ou **modelo local TFLite** (offline, se `assets/models/cattle_weight_model.tflite` existir). Resultado: peso, faixa de confiança, escore de condição corporal, observação. Salva em `lotes/{id}/estimativasPeso` ou `estimativasPesoAvulsas`.

### 4.11 `analise-lote.tsx`
Seleciona um lote e consolida `historicoMapaTrato`, `leituras`, `parametros` (custo_operacional) e `roteiros`. KPIs: custo diária (média, últimos 5 dias, hoje — ponderados por animais-dia), peso por animal (projetado, entrada, real por consumo, meta de abate), dias de confinamento, GMD previsto por consumo. Gráficos: CMS %PV por dia; consumo de MS e custo por animal/dia. Os gráficos ocupam toda a largura do card sem rolagem horizontal: o espaçamento entre pontos/barras e a densidade dos rótulos do eixo X se ajustam à quantidade de dias (estilo painel de BI).

### 4.12 `relatorio-historico.tsx`
Tabela dia × lote (`services/relatorioHistoricoLotes.ts`): quantidade, dieta, CMS %PV, GMD calculado, consumo MS/cab, consumo previsto e realizado de MO/cab, faturamento (custo do dia), evolução de peso acumulada. Exporta **.xlsx** com números puros para Power BI.

---

## 5. Módulo iFarm — Rebanho e Rastreabilidade

### 5.1 `home-ifarm.tsx`
Acesso rápido: Processos, Mangueiro, Rebanho, Movimentações, Sanidade, Consulta GTA, Brincos.

### 5.2 `brincos.tsx`
- **Pedidos de brinco** (`pedidos_brinco`): fábrica, nº do pedido MAPA, SISBOV inicial/final (validados pelo DV), manejo derivado, total calculado, `proximoIndice`. Cada card mostra utilizados, disponíveis, próximo brinco e anulados.
- **Locais** (`locais`): piquetes/baias/currais/pastos com regime (pasto, confinamento, boitel, semi-confinamento) e capacidade; exclusão é lógica (`ativo: false`).

### 5.3 `processos.tsx`
Gestão de GTAs e processos de mangueiro.
- **GTAs**: importação em lote de PDFs (`importarGtas` — extração local no navegador com fallback no servidor; no nativo sempre servidor), revisão dos campos, upload do PDF original ao Storage (`fazendas/{id}/gtas/…`), aviso de divergências entre guias (`conferirLoteDeGtas`), cadastro manual, exclusão (apaga PDF). Só GTAs `ativa` e não vinculadas podem compor novo processo.
- **Processos** (`processos_mangueiro`): nome, tipo (entrada/saída/transferência), GTAs vinculadas, total previsto (soma das GTAs), pedido de brinco (entrada), origem/destino. Status: aberto → em_andamento → concluído / cancelado. Botões *Mangueiro* (→ `pesagem-balanca`) e *Fechar / Ver fechamento* (→ `fechar-processo`).

### 5.4 `pesagem-balanca.tsx` — Mangueiro
Tela central da entrada de animais (2.800 linhas). Conecta balança e leitor RFID (BLE no nativo, Web Serial no navegador), identifica o animal (chip ou número digitado — 6 dígitos = manejo, 15 = SISBOV ou chip) e, para processos de entrada, grava **um animal por toque**:

1. Reserva o próximo brinco do pedido (`BrincoService.reservarBrinco`, transação no nativo).
2. Confere que o chip lido termina com os 4 dígitos do manejo (`chipConfereComManejo`).
3. Operador escolhe faixa etária (botões vindos das GTAs — `faixasDoProcesso`), sexo, raça, categoria, pelagem, regime, local, proprietário (próprio/terceiro) e protocolos sanitários.
4. Cria `bovinos/{sisbov}` com `pesoEntrada`, `dataNascimento` (ponto médio da faixa), `certificacao`, `proprietario`, `metadados` (processo, GTAs, origem, faixa, regime, local).
5. Grava pesagem rápida (`bovinos/{id}/pesagens`) e atualiza `pesoAnterior`.
6. Grava em lote (batch) os eventos `cadastro`, `pesagem`, `movimentacao` e um `sanitario` por produto dos protocolos (carência e próxima dose já calculadas).
7. Grava a ficha sanitária (`bovinos/{id}/eventos_sanitarios`).
8. Incrementa `animaisManejados` do processo (conclui ao atingir o previsto).

Permite **desfazer a última gravação** (estorno dos eventos, inativa o bovino, devolve o brinco, decrementa o processo) e **anular brinco** com motivo (defeito, danificado, perdido, outro). Fora de processo, serve para pesagem avulsa de animal já cadastrado.

### 5.5 `pesagem-lista.tsx` / `pesagem-leitura.tsx` / `pesagem-historico.tsx`
Fluxo de pesagem via `WeighingContext`: lista/busca de animais com status dos dispositivos → leitura em tempo real de chip e peso (animações, estabilização) → confirmação → histórico de pesagens do animal com estatísticas e gráfico de ganho.

### 5.6 `animais.tsx` — Rebanho
Lista de bovinos com busca, filtro por categoria SISBOV (bezerro, novilho, novilha, touros, vacas, bois) e por proprietário (todos/próprios/terceiros — `TarjaProprietario` destaca boitel). Cadastro/edição manual de animal (gera evento `cadastro` com origem `manual`). Atalhos para detalhe e para pesar no mangueiro.

### 5.7 `animal-detalhe.tsx`
Ficha do animal: dados, **GMD entre primeira e última pesagem** com classificação (≥ 1,5 ótimo; ≥ 1,0 bom; ≥ 0,5 regular; abaixo ruim), carência sanitária ativa, **linha do tempo de eventos** (`LinhaDoTempo`, agrupada por instante, sem estornados), eventos sanitários (incluir/excluir), pesagens.

### 5.8 `movimentacoes.tsx`
Histórico geral da fazenda (`eventos` mais recentes, até 300), com filtro por tipo de evento e busca; contagem de animais distintos por tipo.

### 5.9 `sanidade.tsx`
CRUD de **protocolos sanitários** (`protocolos`): nome, descrição, itens (tipo, produto, dose, via, carência em dias, repetir em dias). Desativação lógica (protocolos aplicados continuam referenciados nos eventos).

### 5.10 `consulta-gta.tsx`
Duas abas: **GTA** (código de barras → Cloud Function `consultarGTA`, que consulta o portal do MAPA resolvendo o reCAPTCHA) e **Sintegra** (inscrição estadual → `resolverCaptchaSintegra` + proxy SEFAZ-MS; pode levar ~30 s).

### 5.11 `fechar-processo.tsx`
Resumo do fechamento (`resumirFechamento`): previsto × manejado por faixa etária, pendências que impedem (faltas/excessos por faixa, animais fora das faixas) e avisos (sem peso, sem chip, sem destino, sem GTA, animais de terceiros). Gera o **pacote da certificadora** (`certificadora-{processo}-{data}.zip`: planilha de campo .xlsx + .csv, PDFs das GTAs, resumo.txt) e marca o processo como `concluido`.

---

## 6. Módulo Abastecimento — Combustível

### 6.1 `home-abastecimento.tsx`
Acesso rápido: Abastecer, Tanques, Veículos, Histórico.

### 6.2 `tanques.tsx`
CRUD (`TanqueCard`, `TanqueFormModal`): nome, tipo de combustível, capacidade (L), localização fixo/móvel, nível atual, alerta de nível mínimo, ativo. Barra de nível com percentual e alerta vermelho quando `nivelAtual ≤ alertaNivelMinimo`.

### 6.3 `veiculos.tsx`
CRUD (`VeiculoCard`, `VeiculoFormModal`): nome, placa, tipo (veículo/máquina/equipamento), tipo de marcador (km/horímetro/nenhum), combustível, marcador atual, ativo. Gera **QR Code** (`QRCodeModal`) com payload `{"type":"confi_veiculo","id","nome","tipoMarcador"}` para colar no veículo.

### 6.4 `abastecimento.tsx`
Wizard `SCAN_QR → PHOTO_BOMBA → PHOTO_PAINEL → CONFIRM → SAVED`:
1. Lê QR do veículo (ou seleção manual) e escolhe o tanque.
2. Foto da bomba → OCR (ML Kit) sugere os litros.
3. Foto do painel → OCR sugere km/horímetro; valida que não é menor que o anterior.
4. Confirma e grava `abastecimentos` (com `consumo` calculado), abate os litros do `nivelAtual` do tanque e atualiza `marcadorAtual` do veículo. Marca `criadoOffline` quando sem rede.

### 6.5 `historico-combustivel.tsx`
Lista de abastecimentos com filtros por veículo/tanque/período (`AbastecimentoCard`) e total de litros do filtro.

---

## 7. Telas comuns

### 7.1 `configuracoes.tsx`
- **Identidade visual**: cor primária (paleta) e logo (upload ao Storage em `config/logo.png`) — gravados em `config/app`. Atenção: `storage.rules` só libera escrita sob `fazendas/{fazendaId}/…`, então o upload do logo nesse caminho raiz tende a ser negado pelas regras atuais.
- **Base do CMS da leitura**: `realizado` (padrão) ou `previsto`.
- **Tabelas auxiliares** com CRUD genérico (`TabelaAuxiliarFormModal`): Piquetes, Vagão, Nota de Leitura, Parâmetros (`tempoMS`, `custo_operacional`), Configurações IA (`ANTHROPIC_API_KEY`). As demais tabelas (raça, categoria, GEC…) são populadas pelo **seed** (`seedTabelasAuxiliares`, ignora coleções já preenchidas).
- **Migração multi-tenant** (`migrateToMultiTenant`): copia coleções legadas da raiz para `fazendas/{id}/…` preservando IDs.
- Sincronização offline manual.

### 7.2 `signup.tsx` — Usuários (admin)
Cria usuários no Firebase Auth via app secundário (não desloga o admin) e grava `usuarios/{uid}` com nome, e-mail, tipo (cliente, gestor, tratador, admin), fazendas[], módulos[] e **telas permitidas**: "Todas dos módulos" (grava `telas: null`) ou "Selecionar telas" com checkboxes agrupados por módulo (+ Configurações). Edita/exclui usuários e cria/exclui fazendas.

---

## 8. Componentes relevantes

| Componente | Papel |
| --- | --- |
| `LoteCard` | Exporta `calcularQuantidadeAtual`, `calcularPesoMedio`, `calcularPesoMedioInicial`; mostra qtde, peso projetado, GMD estimado/real, próximo embarque |
| `InsumoCard` | Tipos `Compra`, `Saida`, `ConferenciaMS`, `PesagemMS`, `Insumo`; `calcularEstoque`, `calcularPrecoMedio`, autonomia |
| `CargaModal` / `DescargaModal` | Registro por trato; `DescargaModal` exibe `getCmsRealizado` e `getGmdReal` (NRC inline) |
| `ConferenciaMSModal` | Secagem passo a passo com cronômetro sugerido (60/10 min) |
| `DietaFormModal` | Composição, MS automática, validação 100 % |
| `LinhaDoTempo` | Timeline de eventos agrupada por instante |
| `TarjaProprietario` | Faixa "terceiro/boitel" nos cards de animal |
| `AgendarEmbarqueModal`, `TransferenciaLoteModal`, `FaturamentoModal` | Operações de lote |
| `QRCodeModal` | QR do veículo (`react-native-qrcode-svg`) |
| `DatePickerInput(.web)` | Date picker nativo/web |
| `Select`, `MultiSelect`, `Input`, `Button`, `ConfirmDialog`, `DrawerToggleButton`, `drawe-scene-wrapper` | UI base |

`services/alerta.ts` (`Aviso.alert`) substitui `Alert.alert`, que é vazio no react-native-web, por `window.alert/confirm` no navegador.
