# Documentacao Tecnica - Sistema de Confinamento (Confi)

> Documento de referencia para futuras consultas e manutencoes.
> Ultima atualizacao: 19/03/2026

---

## Indice

1. [Visao Geral do Projeto](#1-visao-geral-do-projeto)
2. [Stack Tecnologica](#2-stack-tecnologica)
3. [Estrutura de Diretorio](#3-estrutura-de-diretorio)
4. [Modelo de Dados (Firestore)](#4-modelo-de-dados-firestore)
5. [Logicas de Calculo](#5-logicas-de-calculo)
6. [Telas (Screens)](#6-telas-screens)
7. [Componentes](#7-componentes)
8. [Utilitarios](#8-utilitarios)
9. [Hooks](#9-hooks)
10. [Fluxos de Negocio](#10-fluxos-de-negocio)

---

## 1. Visao Geral do Projeto

Sistema de gestao de confinamento de gado bovino desenvolvido em React Native com Expo. Gerencia todo o ciclo operacional, desde a entrada de animais, formulacao de dietas, controle de insumos e estoque, leitura de cocho, ate o mapa de trato diario com calculo de GMD (Ganho Medio Diario) baseado no modelo nutricional NRC.

---

## 2. Stack Tecnologica

| Componente     | Tecnologia                                           |
| -------------- | ---------------------------------------------------- |
| Framework      | React Native 0.81 + Expo SDK 54                      |
| Linguagem      | TypeScript (strict mode)                             |
| Navegacao      | Expo Router v6 + @react-navigation/drawer            |
| Banco de Dados | Firebase/Firestore                                   |
| Animacoes      | react-native-reanimated                              |
| Arquivos       | expo-document-picker, expo-file-system, expo-sharing |
| Path alias     | `@/*` -> `./src/*`                                   |

---

## 3. Estrutura de Diretorio

```
src/
  app/                    # Telas (file-based routing)
    _layout.tsx           # Layout raiz (Drawer navigation)
    index.tsx             # Login
    signup.tsx            # Cadastro de usuario
    home.tsx              # Dashboard com KPIs e relatorio
    produtores.tsx        # CRUD produtores
    lotes.tsx             # CRUD lotes + movimentacoes
    insumos.tsx           # CRUD insumos + compras
    dietas.tsx            # CRUD dietas (composicao)
    roteiros.tsx          # CRUD roteiros de trato
    leitura.tsx           # Leitura de cocho (ajuste CMS)
    mapa-trato.tsx        # Mapa de trato (carga/descarga)
    tratador.tsx          # Wizard mobile para tratador
    configuracoes.tsx     # Tabelas auxiliares
  components/             # Componentes reutilizaveis
  hooks/                  # Custom hooks
  utils/                  # Funcoes utilitarias e calculos
  assets/                 # Imagens
```

---

## 4. Modelo de Dados (Firestore)

### 4.1 Colecoes Principais

#### `produtores`

| Campo             | Tipo   | Descricao                |
| ----------------- | ------ | ------------------------ |
| nome              | string | Nome completo            |
| abreviacao        | string | Nome abreviado           |
| fazenda           | string | Nome da fazenda          |
| cidade            | string | Municipio (via IBGE API) |
| uf                | string | Estado (UF)              |
| inscricaoEstadual | string | IE                       |
| telefone          | string | Telefone                 |
| email             | string | Email                    |
| cpfCnpj           | string | CPF ou CNPJ formatado    |

#### `lotes`

| Campo           | Tipo    | Descricao                        |
| --------------- | ------- | -------------------------------- |
| numero          | number  | Numero sequencial do lote        |
| raca            | string  | Raca dos animais                 |
| categoria       | string  | Categoria (Macho castrado, etc.) |
| compensatorio   | string  | Tipo de ganho compensatorio      |
| implante        | string  | Tipo de implante                 |
| tamanhoCorporal | string  | Tamanho corporal da raca         |
| produtor        | string  | Nome do produtor                 |
| produtorId      | string  | ID do produtor                   |
| gmdEstimado     | number  | GMD estimado (kg/dia)            |
| ativo           | boolean | Se o lote esta ativo             |
| dietaId         | string  | ID da dieta vinculada            |
| dietaNome       | string  | Nome da dieta                    |
| piqueteId       | string  | ID do piquete                    |
| piqueteNome     | string  | Nome do piquete                  |

**Subcolecao `lotes/{id}/movimentacoes`:**
| Campo | Tipo | Descricao |
| ------------ | ------ | ---------------------------------------- |
| evento | string | "Entrada" ou "Saida" |
| movimentacao | string | Tipo (Compra, Venda, Morte, etc.) |
| data | string | Data ISO (YYYY-MM-DD) |
| quantidade | number | Qtd de animais |
| pesoMedio | number | Peso medio em kg |
| observacao | string | Observacao livre |

**Subcolecao `lotes/{id}/leituras`:**
| Campo | Tipo | Descricao |
| ----------- | ------ | ----------------------------------- |
| data | string | Data ISO |
| nota | string | Nota da leitura (1-5 ou "Ajuste") |
| fator | number | Fator de ajuste aplicado |
| cmsAnterior | number | CMS antes do ajuste (%) |
| cmsNovo | number | CMS apos o ajuste (%) |

#### `insumos`

| Campo                 | Tipo    | Descricao                   |
| --------------------- | ------- | --------------------------- |
| nome                  | string  | Nome do insumo              |
| percentualMateriaSeca | number  | % de Materia Seca           |
| materiaSecaVariavel   | boolean | Se a MS varia entre compras |

**Subcolecao `insumos/{id}/compras`:**
| Campo | Tipo | Descricao |
| ---------- | ------ | -------------------------- |
| data | string | Data ISO |
| quantidade | number | Quantidade em kg |
| precoKg | number | Preco por kg (R$) |

**Subcolecao `insumos/{id}/saidas`:**
| Campo | Tipo | Descricao |
| -------------- | ------ | ------------------------------- |
| data | string | Data ISO |
| quantidade | number | Quantidade em kg |
| precoKg | number | Preco medio no momento (R$) |
| origem | string | Origem da saida ("mapa-trato") |
| roteiroId | string | ID do roteiro |
| roteiroNumero | number | Numero do roteiro |

#### `dietas`

| Campo        | Tipo    | Descricao                                     |
| ------------ | ------- | --------------------------------------------- |
| nome         | string  | Nome da dieta                                 |
| percentualMS | number  | % de Materia Seca da dieta                    |
| ndt          | number  | % de Nutrientes Digestiveis Totais            |
| aditivoId    | string  | ID do aditivo                                 |
| aditivoNome  | string  | Nome do aditivo                               |
| ativo        | boolean | Status ativo/inativo                          |
| insumos      | array   | Lista de { insumoId, insumoNome, percentual } |

#### `roteiros`

| Campo     | Tipo    | Descricao                           |
| --------- | ------- | ----------------------------------- |
| numero    | number  | Numero sequencial do roteiro        |
| dietaId   | string  | ID da dieta                         |
| dietaNome | string  | Nome da dieta                       |
| piquetes  | array   | Lista de { piqueteId, piqueteNome } |
| minTratos | number  | Numero minimo de tratos             |
| ativo     | boolean | Status ativo/inativo                |

#### `historicoMapaTrato`

| Campo             | Tipo   | Descricao                                  |
| ----------------- | ------ | ------------------------------------------ |
| data              | string | Data ISO                                   |
| roteiroId         | string | ID do roteiro                              |
| roteiroNumero     | number | Numero do roteiro                          |
| dietaId           | string | ID da dieta                                |
| dietaNome         | string | Nome da dieta                              |
| vagaoId           | string | ID do vagao utilizado                      |
| vagaoNome         | string | Nome do vagao                              |
| totalMS           | number | Total de Materia Seca prevista (kg)        |
| totalMO           | number | Total de Materia Original prevista (kg)    |
| numTratos         | number | Numero de tratos realizados                |
| percentualMSFinal | number | % MS real calculada da carga               |
| custoTotal        | number | Custo total do trato (R$)                  |
| cargas            | array  | Array de CargaTrato (detalhes da carga)    |
| descargas         | array  | Array de DescargaTrato (detalhes descarga) |
| custoPorLote      | array  | Distribuicao do custo por lote             |
| msPorLote         | array  | MS, CMS e GMD real por lote                |

### 4.2 Tabelas Auxiliares (11 colecoes)

| Colecao           | Campos                            | Descricao                             |
| ----------------- | --------------------------------- | ------------------------------------- |
| `raca`            | descricao, fator                  | Racas com fator de ajuste NRC         |
| `categoria`       | descricao, fator                  | Categorias (macho castrado, etc.)     |
| `compensatorio`   | descricao, fator                  | Ganho compensatorio                   |
| `implante`        | descricao, fator                  | Tipo de implante                      |
| `tamanhoCorporal` | descricao, fator                  | Tamanho corporal (escala 3-9)         |
| `gec`             | tamanhoCorporal, categoria, fator | Fator GEC (combinacao TC x categoria) |
| `aditivos`        | descricao, fator                  | Aditivos alimentares                  |
| `piquetes`        | descricao, capacidade             | Piquetes/currais                      |
| `vagao`           | descricao, capacidade             | Vagoes de trato                       |
| `notaLeitura`     | descricao, fator                  | Notas de leitura de cocho (1-5)       |
| `movimentacao`    | descricao, evento                 | Tipos de movimentacao                 |

---

## 5. Logicas de Calculo

### 5.1 Calculo NRC de GMD (Ganho Medio Diario)

**Arquivo:** `src/utils/mapaTratoCalc.ts` - funcao `calcGmdNRC()`
**Tambem em:** `src/components/DescargaModal.tsx` - funcao `getGmdReal()`

Implementa o modelo nutricional NRC (National Research Council) para estimar o ganho de peso diario de bovinos com base no consumo de materia seca.

#### Parametros de entrada:

- `cmsAnimalKgMS`: Consumo de materia seca por animal (kg)
- `pesoVivo`: Peso vivo do animal (kg)
- `ndt`: Nutrientes Digestiveis Totais da dieta (%)
- `fatores`: Fatores de ajuste { fatorRaca, fatorGec, fatorImplante, fatorCompensatorio, fatorAditivo }

#### Passo a passo:

**1. Conversao de NDT para Energia:**

```
DE  = NDT * 0.04409          // Energia Digestivel (Mcal/kg)
ME  = 0.82 * DE              // Energia Metabolizavel (Mcal/kg)
NEm = 1.37*ME - 0.138*ME^2 + 0.0105*ME^3 - 1.12   // Energia Liquida de Manutencao
NEg = 1.42*ME - 0.174*ME^2 + 0.0122*ME^3 - 1.65   // Energia Liquida de Ganho
```

**2. Calculo do Peso Corporal:**

```
SBW   = PesoVivo * 0.96          // Shrunk Body Weight (peso em jejum)
EQSBW = SBW * fatorGec           // Equivalent SBW (ajustado pelo GEC)
```

**3. Requerimento de Manutencao:**

```
NEmReq    = 0.077 * EQSBW^0.75   // Exigencia de energia p/ manutencao (Mcal/dia)
NEmIntake = CMS * NEm             // Energia de manutencao ingerida
```

**4. Disponibilidade para Ganho:**

```
feedMaint = NEmReq / NEm          // kg de MS necessarios para manutencao
feedGain  = CMS - feedMaint       // kg de MS disponiveis para ganho
RE        = feedGain * NEg        // Energia Retida (Mcal/dia)
```

(Se NEmIntake <= NEmReq, o animal nao ganha peso -> GMD = 0)

**5. Calculo do GMD base:**

```
base    = RE / (0.0557 * EQSBW^0.75)
gmdBase = base^(1 / 1.097)       // GMD base em kg/dia
```

**6. Aplicacao dos fatores de ajuste:**

```
GMD_final = gmdBase * fatorRaca * fatorImplante * fatorCompensatorio * fatorAditivo
```

#### Valores tipicos dos fatores (dados do seed):

| Fator         | Valores                                                     |
| ------------- | ----------------------------------------------------------- |
| Raca          | Nelore=0.89, Anelorado=0.93, 1/2 sangue=1, ... Holandes=1.2 |
| Implante      | Nenhum=0.95, Simples=1, Duplo=1.05, Triplo=1.1              |
| Compensatorio | Ausente=1, Moderado=1.1, Intenso=1.2                        |
| Aditivo       | Nenhum=1, Monensina/Salinomicina/Lasolicida=1.1             |
| GEC           | Combinacao de tamanhoCorporal(3-9) x categoria(4)           |

---

### 5.2 Calculo de Peso Medio Atual

**Arquivo:** `src/utils/mapaTratoCalc.ts` - funcao `calcPesoMedio()`
**Tambem em:** `src/components/LoteCard.tsx` - funcao `calcularPesoMedio()`

Calcula o peso medio estimado atual dos animais de um lote considerando todas as movimentacoes.

```
Para cada movimentacao:
  dias = (hoje - dataMovimentacao) em dias
  pesoAjustado = pesoMedioEntrada + (gmdEstimado * dias)

  Se Entrada:  pesoTotal += quantidade * pesoAjustado
  Se Saida:    pesoTotal -= quantidade * pesoAjustado

pesoMedio = pesoTotal / quantidadeAtual
```

**Logica:** O peso de cada grupo de animais e projetado individualmente a partir da data em que entraram/sairam, usando o GMD estimado do lote para simular o crescimento.

---

### 5.3 Quantidade Atual de Animais

**Arquivo:** `src/utils/mapaTratoCalc.ts` - funcao `calcQtdAtual()`
**Tambem em:** `src/components/LoteCard.tsx` - funcao `calcularQuantidadeAtual()`

```
quantidadeAtual = SUM(Entradas.quantidade) - SUM(Saidas.quantidade)
```

---

### 5.4 Leitura de Cocho (Ajuste de CMS)

**Arquivo:** `src/app/leitura.tsx` - funcao `handleSelectNota()`

O CMS (Consumo de Materia Seca em % do peso vivo) e ajustado diariamente com base na avaliacao visual do cocho.

#### Constantes:

- `CMS_INICIAL = 1.3%` (valor padrao p/ lotes novos)
- `CMS_BASE = 2.6%` (base para calculo do delta de ajuste)

#### Notas de leitura e seus fatores (dados do seed):

| Nota | Fator | Significado              |
| ---- | ----- | ------------------------ |
| 1    | 1.10  | Cocho limpo - aumentar   |
| 2    | 1.03  | Pouco sobra - aumentar   |
| 3    | 1.00  | Adequado - manter        |
| 4    | 0.97  | Muita sobra - diminuir   |
| 5    | 0.90  | Excesso - diminuir muito |

#### Formula do ajuste:

```
cmsNovo = cmsAnterior + CMS_BASE * (fator - 1)
```

**Exemplos:**

- Nota 1 (fator=1.10): `cmsNovo = 1.3 + 2.6 * (1.10 - 1) = 1.3 + 0.26 = 1.56%`
- Nota 3 (fator=1.00): `cmsNovo = 1.3 + 2.6 * (1.00 - 1) = 1.3 + 0 = 1.30%` (sem alteracao)
- Nota 5 (fator=0.90): `cmsNovo = 1.3 + 2.6 * (0.90 - 1) = 1.3 - 0.26 = 1.04%`

#### Ajuste fino:

Botoes +/- que alteram o CMS em incrementos de 0.01%.

#### Prioridade do CMS:

1. Se existe leitura de hoje -> usa `cmsNovo` dessa leitura
2. Se existe CMS realizado do dia anterior (do historico de trato) -> usa o realizado
3. Se existe leitura anterior -> usa `cmsNovo` da ultima leitura
4. Caso contrario -> usa `CMS_INICIAL` (1.3%)

#### Alertas:

Quando o CMS realizado do dia anterior esta fora dos limites esperados:

```
limiteMax = cmsPrevisto_ontem * maiorFator  (ex: cmsPrevisto * 1.10)
limiteMin = cmsPrevisto_ontem * menorFator  (ex: cmsPrevisto * 0.90)

Se cmsRealizado > limiteMax -> alerta "acima"
Se cmsRealizado < limiteMin -> alerta "abaixo"
```

O operador pode usar o botao "Repetir Previsto" para forcar o CMS previsto do dia anterior.

---

### 5.5 Calculo do Mapa de Trato

**Arquivo:** `src/utils/mapaTratoCalc.ts` - funcao `buildCalcData()`

Calcula toda a distribuicao de alimento por roteiro, incluindo quantidades de insumos e agua.

#### 5.5.1 MS e MO por Lote:

```
msLote = qtdAnimais * pesoMedio * (cmsAtual / 100)
  // MS = Materia Seca total necessaria para o lote (kg)

moLote = msLote / (percentualMS_dieta / 100)
  // MO = Materia Original (materia natural) total para o lote (kg)
```

#### 5.5.2 Totais do Roteiro:

```
totalMS = SUM(msLote)  para todos os lotes do roteiro
totalMO = totalMS / (percentualMS_dieta / 100)
```

#### 5.5.3 Numero de Tratos:

```
numTratos = MAX(minTratos_roteiro, CEIL(totalMO / capacidade_vagao))
```

O numero minimo de tratos e respeitado, mas se o total de MO excede a capacidade do vagao, mais tratos sao adicionados.

#### 5.5.4 Distribuicao por Trato:

```
moPerTrato = totalMO / numTratos   // MO por trato
msPerTrato = totalMS / numTratos   // MS por trato
```

#### 5.5.5 Quantidade de Cada Insumo por Trato:

```
Para cada insumo na dieta:
  msInsumo = msPerTrato * (percentual_insumo / 100)
  moInsumo = msInsumo / (percentualMS_insumo / 100)
```

O `percentual_insumo` e a participacao do insumo na dieta (em base MS), e a conversao para MO usa o % MS do proprio insumo.

#### 5.5.6 Agua por Trato:

```
aguaPrevista = MAX(0, moPerTrato - soma_moInsumos)
```

A agua completa a diferenca entre a MO total do trato e a soma das MO dos insumos.

#### 5.5.7 Descarga (Previsao por Piquete):

```
previsto_piquete = moLote / numTratos
```

---

### 5.6 Preco Medio Ponderado Movel (Estoque de Insumos)

**Arquivo:** `src/components/InsumoCard.tsx` - funcao `calcularPrecoMedio()`
**Tambem em:** `src/utils/mapaTratoCalc.ts` - dentro de `fetchMapaTratoData()`

Metodo de custeio de estoque Media Ponderada Movel (MPM).

```
Eventos ordenados cronologicamente (compras + saidas):

Para cada evento:
  Se COMPRA (Entrada):
    estoque     += quantidade
    valorTotal  += quantidade * precoKg

  Se SAIDA:
    avgMomento   = valorTotal / estoque     // preco medio naquele instante
    valorTotal  -= quantidade * avgMomento
    estoque     -= quantidade

Preco Medio Atual = valorTotal / estoque
```

**Importante:** Este calculo processa os eventos em ordem cronologica, recalculando o custo medio a cada saida.

---

### 5.7 Estoque de Insumo

**Arquivo:** `src/components/InsumoCard.tsx` - funcao `calcularEstoque()`

```
estoque = SUM(compras.quantidade) - SUM(saidas.quantidade)
```

---

### 5.8 Custo por kg de Materia Seca (Dieta)

**Arquivo:** `src/app/dietas.tsx` - funcao `calcularCustoKgMS()`

Calcula o custo da dieta em R$/kg de materia seca.

```
Para cada insumo na dieta:
  1. precoMedioMO = totalValor_compras / totalQtd_compras
     (media ponderada do preco por kg de MO)

  2. precoKgMS = precoMedioMO / (percentualMS_insumo / 100)
     (converte para preco por kg de MS)

  3. custo += (percentual_na_dieta / 100) * precoKgMS

custoKgMS = SUM(custo)  // R$ por kg de MS da dieta completa
```

---

### 5.9 % MS da Dieta (Automatico)

**Arquivo:** `src/components/DietaFormModal.tsx`

Quando o toggle "Manter MS da Dieta" esta ativo:

```
msDieta = SUM((percentual_insumo / 100) * percentualMS_insumo)
```

Media ponderada da MS de cada insumo pela sua participacao na dieta.

---

### 5.10 % MS Final da Carga (Realizado)

**Arquivo:** `src/components/CargaModal.tsx` e `src/app/tratador.tsx`

```
totalMSRealizada = SUM(realizado_insumo * (percentualMS_insumo / 100))
totalMORealizada = SUM(realizado_insumo) + aguaRealizada

percentualMSFinal = (totalMSRealizada / totalMORealizada) * 100
```

---

### 5.11 CMS Realizado (pos-Descarga)

**Arquivo:** `src/app/mapa-trato.tsx` - funcao `handleSaveDescarga()`
**Tambem em:** `src/components/DescargaModal.tsx` - funcao `getCmsRealizado()`

```
totalRealizadoLote = SUM(realizado de todas as descargas deste lote)
totalMS = totalRealizadoLote * (percentualMSFinal / 100)

cmsRealizado = (totalMS / (qtdAnimais * pesoMedio)) * 100
  // CMS como % do peso vivo
```

---

### 5.12 Distribuicao de Custo por Lote

**Arquivo:** `src/app/mapa-trato.tsx` e `src/app/tratador.tsx`

```
custoTotal = SUM(realizado_insumo * precoMedio_insumo)  // para todos os insumos

Se descarga realizada existe:
  custo_lote = custoTotal * (realizado_descarga_lote / totalRealizado_descarga)
  // Proporcional ao volume real descarregado

Senao (fallback):
  custo_lote = custoTotal * (moLote / totalMO)
  // Proporcional ao volume previsto
```

---

### 5.13 Peso Real e GMD Real Medio

**Arquivo:** `src/components/LoteCard.tsx` e `src/app/home.tsx`

```
gmdRealValues = array de gmdReal de cada dia (do historicoMapaTrato)
gmdRealMedio  = MEDIA(gmdRealValues)

pesoReal = pesoMedioInicial + SUM(gmdRealValues)
  // Peso real = peso de entrada + soma dos ganhos reais diarios
```

---

### 5.14 Dias de Trato

**Arquivo:** `src/app/home.tsx`

```
diasTrato = FLOOR((hoje - dataPrimeiraEntrada) / 86400000)
```

---

### 5.15 Peso Hoje Projetado

**Arquivo:** `src/app/home.tsx`

```
pesoHojeProjetado = pesoMedioEntrada + (gmdEstimado * diasTrato)
```

---

### 5.16 Consumo por Cabeca (Dashboard)

**Arquivo:** `src/app/home.tsx`

```
consMOCab = totalMO_hoje / qtdAnimais   // MO por cabeca (kg)
consMSCab = totalMS_hoje / qtdAnimais   // MS por cabeca (kg)

cmsPctPV = (consMSCab / pesoHojeProjetado) * 100
  // CMS como % do peso vivo
```

---

### 5.17 Validacao de CPF

**Arquivo:** `src/utils/validators.ts` - funcao `validateCPF()`

Algoritmo padrao brasileiro de validacao de CPF:

1. Remove caracteres nao numericos
2. Verifica se tem 11 digitos
3. Rejeita sequencias iguais (111.111.111-11, etc.)
4. Calcula 1o digito verificador: soma ponderada (fator 10 a 2), mod 11
5. Calcula 2o digito verificador: soma ponderada (fator 11 a 2), mod 11

---

### 5.18 Validacao de CNPJ

**Arquivo:** `src/utils/validators.ts` - funcao `validateCNPJ()`

Algoritmo padrao brasileiro de validacao de CNPJ:

1. Remove caracteres nao numericos
2. Verifica se tem 14 digitos
3. Rejeita sequencias iguais
4. Calcula digitos verificadores com pesos `[5,4,3,2,9,8,7,6,5,4,3,2]` e `[6,5,4,3,2,9,8,7,6,5,4,3,2]`

---

## 6. Telas (Screens)

### 6.1 Login (`index.tsx`)

- Campos: email, senha
- Acao: navega para `/home` (autenticacao nao implementada)

### 6.2 Cadastro (`signup.tsx`)

- Campos: nome, email, senha, confirmar senha
- Acao: nao implementada (botao sem handler)

### 6.3 Dashboard (`home.tsx`)

#### KPIs exibidos:

| Card          | Calculo                                      |
| ------------- | -------------------------------------------- |
| Lotes Ativos  | Count de lotes com `ativo === true`          |
| Total Animais | SUM das quantidades atuais de todos os lotes |
| Entradas      | SUM de todas as movimentacoes de entrada     |
| Vendas        | SUM de saidas com tipo "Venda"               |
| Mortes        | SUM de saidas com tipo "Morte"               |

#### Relatorio de Lotes (tabela com 19 colunas):

Piquete, Lote, Dieta, Qtde, Produtor, Categoria, Dt Entrada, Peso Ent., Dias, Raca, MO/cab, MS/cab, CMS %PV, Leit. Cocho, GMD Est., Peso Proj., GMD Real, Peso Real, CMS %PV Med.

**Fonte dos dados:** Cruza informacoes de `lotes`, `movimentacoes`, `leituras` e `historicoMapaTrato`.

### 6.4 Produtores (`produtores.tsx`)

CRUD simples. Busca estados/municipios via API IBGE. Valida CPF/CNPJ.

### 6.5 Lotes (`lotes.tsx`)

#### Funcoes principais:

- **CRUD de lotes** com todos os campos de selecao (raca, categoria, etc.)
- **Movimentacoes** (entrada/saida de animais)
- **Faturamento** (visualizacao de custos acumulados)
- **Filtro ativo/inativo**

#### Regras de negocio:

- Ao inativar um lote: limpa o piquete e remove o piquete de todos os roteiros
- Ao adicionar saida que zera o lote: inativa automaticamente
- Piquetes ja ocupados por outros lotes nao aparecem nas opcoes
- Permite criar Produtor e Dieta inline (via modal)

### 6.6 Insumos (`insumos.tsx`)

#### Funcoes principais:

- CRUD de insumos
- Registro de compras (com preco por kg)
- Exibicao de estoque e preco medio

#### Regra de negocio:

- Ao alterar o nome de um insumo, propaga a alteracao para todas as dietas que o utilizam

### 6.7 Dietas (`dietas.tsx`)

#### Funcoes principais:

- CRUD de dietas com composicao de insumos
- Calculo de custo/kg MS (ver secao 5.8)
- Toggle para manter MS automatica (ver secao 5.9)

#### Validacao:

- Soma dos percentuais dos insumos deve ser exatamente 100%

### 6.8 Roteiros (`roteiros.tsx`)

#### Funcoes principais:

- CRUD de roteiros de trato
- Vinculacao de dieta e piquetes
- Reordenacao de piquetes (define ordem de descarga)

#### Regra de negocio:

- So exibe piquetes cujos lotes estao na mesma dieta selecionada

### 6.9 Leitura de Cocho (`leitura.tsx`)

Ver secao 5.4 para detalhes dos calculos.

#### Fluxo:

1. Exibe todos os lotes ativos com piquete, ordenados pelo numero do piquete
2. Operador seleciona nota (1-5) para cada lote
3. Sistema calcula novo CMS e salva no Firestore
4. Mostra alertas se CMS realizado do dia anterior estiver fora dos limites

### 6.10 Mapa de Trato (`mapa-trato.tsx`)

#### Fluxo:

1. Selecionar vagao
2. Visualizar roteiros com previsoes calculadas
3. Abrir modal de Carga para registrar quantidades carregadas
4. Abrir modal de Descarga para registrar quantidades descarregadas
5. Sistema calcula custos, CMS realizado e GMD real

#### Funcionalidades extras:

- **Exportar CSV**: Gera arquivo com tabela de ingredientes (percentuais por dieta) e tabela de descarga (oferta por piquete/trato)
- **Importar CSV**: Le arquivos de carga e descarga em formato CSV, fazendo match por nome de ingrediente (normalizado, sem acentos)

#### Salvamento de dados:

- Carga: grava saidas de insumos, calcula custos, grava historico
- Descarga: calcula MS por lote, CMS realizado, GMD real (NRC), redistribui custos

### 6.11 Tratador (`tratador.tsx`)

Interface simplificada (mobile-first) para o operador de trato, com wizard em etapas:

```
SELECT_VAGAO -> SELECT_ROTEIRO -> CARREGAMENTO -> DESCARREGAMENTO -> CONCLUIDO
```

- Suporta multiplos tratos (dots de progresso)
- Detecta automaticamente onde o operador parou (`detectNextTrato`)
- Mesma logica de calculo e salvamento do mapa-trato
- Interface de scroll horizontal para navegar entre insumos/piquetes

### 6.12 Configuracoes (`configuracoes.tsx`)

Gerencia as 11 tabelas auxiliares com CRUD generico. Tem botao para executar seed inicial.

---

## 7. Componentes

### 7.1 Componentes de UI Base

| Componente           | Arquivo                   | Descricao                         |
| -------------------- | ------------------------- | --------------------------------- |
| `Button`             | `Button.tsx`              | Botao primario azul               |
| `Input`              | `Input.tsx`               | Campo de texto padrao             |
| `Select`             | `Select.tsx`              | Select unico com busca e modal    |
| `MultiSelect`        | `MultiSelect.tsx`         | Select multiplo com checkboxes    |
| `ConfirmDialog`      | `ConfirmDialog.tsx`       | Dialog de confirmacao (excluir)   |
| `DrawerSceneWrapper` | `drawe-scene-wrapper.tsx` | Wrapper com animacao 3D do drawer |

### 7.2 Componentes de Negocio

#### `LoteCard` + `LoteFormModal` + `MovimentacaoFormModal` + `FaturamentoModal`

- Exibe info do lote (animais, peso, GMD)
- Formulario de criacao/edicao
- Gestao de movimentacoes
- Visualizacao de custos acumulados

#### `InsumoCard` + `InsumoFormModal` + `CompraFormModal`

- Exibe insumo (estoque, preco medio)
- Formulario de criacao/edicao
- Gestao de compras

#### `DietaCard` + `DietaFormModal`

- Exibe dieta (insumos, NDT, custo/kg MS)
- Formulario com composicao de insumos

#### `RoteiroCard` + `RoteiroFormModal`

- Exibe roteiro (dieta, piquetes, tratos)
- Formulario com selecao de dieta e piquetes

#### `ProdutorCard` + `ProdutorFormModal`

- Exibe produtor (fazenda, localizacao)
- Formulario com integracao IBGE

#### `CargaModal`

- Registro de carga com abas por trato
- Calcula % MS final

#### `DescargaModal`

- Registro de descarga com abas por trato
- Exibe CMS realizado e GMD real em tempo real

#### `TabelaAuxiliarFormModal`

- Formulario dinamico baseado em schema de campos

---

## 8. Utilitarios

### `mapaTratoCalc.ts` (~490 linhas)

Motor de calculo central do sistema. Contem:

- `calcQtdAtual()` - Quantidade atual de animais
- `calcPesoMedio()` - Peso medio estimado
- `calcGmdNRC()` - GMD via modelo NRC
- `buildCalcData()` - Calculo completo do mapa de trato
- `fetchMapaTratoData()` - Busca todos os dados necessarios do Firestore
- `getHojeStr()` - Data de hoje em formato ISO
- Todos os tipos (TypeScript) usados nos calculos

### `validators.ts`

- `validateCPF()` / `formatCPF()` - Validacao e formatacao de CPF
- `validateCNPJ()` / `formatCNPJ()` - Validacao e formatacao de CNPJ
- `onlyDigits()` - Remove caracteres nao-numericos

### `seedTabelasAuxiliares.ts`

- `seedTabelasAuxiliares()` - Popula todas as 11 tabelas auxiliares com dados iniciais
- Usa `writeBatch` para escrita atomica
- Verifica se a colecao ja tem dados antes de inserir

---

## 9. Hooks

### `useResponsive.ts`

- Breakpoints: tablet >= 768px, desktop >= 1024px
- Constantes de largura maxima: conteudo (900px), auth (480px), modal (560px)
- Retorna: `{ width, isTablet, isDesktop, maxWidthContent, maxWidthAuth, maxWidthModal }`

---

## 10. Fluxos de Negocio

### 10.1 Fluxo Diario Completo

```
1. LEITURA DE COCHO (manha)
   - Operador avalia cada cocho: nota 1 a 5
   - Sistema ajusta o CMS de cada lote

2. MAPA DE TRATO (preparacao)
   - Selecionar vagao
   - Sistema calcula automaticamente:
     * Quantidades de cada insumo por trato
     * Quantidade de agua
     * Previsao de descarga por piquete

3. CARGA (carregamento do vagao)
   - Registrar quantidades reais carregadas de cada insumo
   - Registrar quantidade de agua adicionada
   - Sistema gera saidas de estoque dos insumos
   - Sistema calcula % MS final real

4. DESCARGA (distribuicao nos piquetes)
   - Registrar quantidades reais descarregadas por piquete
   - Sistema calcula por lote:
     * CMS realizado (% do peso vivo)
     * GMD real (modelo NRC)
     * Custo proporcional

5. HISTORICO
   - Tudo e salvo em historicoMapaTrato
   - Dashboard (home) consolida os dados
```

### 10.2 Fluxo de Cadastro

```
1. Configuracoes -> Seed de tabelas auxiliares
2. Produtores -> Cadastrar produtores
3. Insumos -> Cadastrar insumos + registrar compras
4. Dietas -> Montar dietas com composicao de insumos
5. Lotes -> Criar lotes + registrar entrada de animais
6. Roteiros -> Montar roteiros vinculando dieta e piquetes
7. Operacao diaria -> Leitura + Mapa de Trato
```

### 10.3 Ciclo de Vida de um Lote

```
CRIACAO -> ENTRADA DE ANIMAIS -> OPERACAO DIARIA -> SAIDA (Venda/Morte/Transferencia)
                                      |
                                      v
                              Se qtdAnimais == 0:
                                - Lote inativado automaticamente
                                - Piquete liberado
                                - Piquete removido dos roteiros
```

---

## Glossario

| Sigla/Termo | Significado                                     |
| ----------- | ----------------------------------------------- |
| CMS         | Consumo de Materia Seca (% do peso vivo)        |
| MS          | Materia Seca                                    |
| MO          | Materia Original (materia natural, com umidade) |
| NDT         | Nutrientes Digestiveis Totais                   |
| GMD         | Ganho Medio Diario (kg/dia)                     |
| NRC         | National Research Council (modelo nutricional)  |
| DE          | Energia Digestivel (Mcal/kg)                    |
| ME          | Energia Metabolizavel (Mcal/kg)                 |
| NEm         | Energia Liquida de Manutencao (Mcal/kg)         |
| NEg         | Energia Liquida de Ganho (Mcal/kg)              |
| SBW         | Shrunk Body Weight (peso em jejum)              |
| EQSBW       | Equivalent Shrunk Body Weight                   |
| RE          | Energia Retida (Mcal/dia)                       |
| GEC         | Grupo de Equivalencia Corporal                  |
| MPM         | Media Ponderada Movel (metodo de custeio)       |
| Piquete     | Curral/divisao onde os animais ficam            |
| Roteiro     | Rota de alimentacao (sequencia de piquetes)     |
| Trato       | Uma viagem/passagem de alimentacao              |
| Vagao       | Veiculo/equipamento de distribuicao de racao    |
| Carga       | Carregamento de insumos no vagao                |
| Descarga    | Distribuicao do alimento nos piquetes           |
