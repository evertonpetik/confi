# 02 — Cálculos do Sistema

[← Voltar ao índice](./README.md)

Todas as fórmulas abaixo foram extraídas do código. Convenções: pesos em **kg** (exceto conferência de MS, em gramas), percentuais de **0 a 100**, datas civis no formato `yyyy-mm-dd`, dias = `floor((hoje − data) / 86 400 000 ms)`.

Os módulos puros (sem React Native) estão em `src/utils/loteCalcCore.ts`, `materiaSecaCalc.ts`, `insumoAutonomia.ts`, `piqueteOrdenacao.ts` e em `src/services/sisbov.ts`, `faixasProcesso.ts`, `eventoUtils.ts`, `protocoloUtils.ts`, `embarque.ts`, `gtaParser.ts` — por isso podem ser verificados pelos scripts `npm run verificar:*`.

---

## 1. Lote: quantidade, peso e dias

### 1.1 Quantidade atual e quantidade em uma data
`utils/mapaTratoCalc.ts::calcQtdAtual` · `utils/loteCalcCore.ts::calcQtdAtual` / `calcQtdNaData` · `components/LoteCard.tsx::calcularQuantidadeAtual`

```
qtdAtual        = Σ quantidade (evento = "Entrada") − Σ quantidade (evento = "Saida")
qtdNaData(d)    = idem, só movimentações com data ≤ d   (saída no dia já desconta)
```
Toda média por cabeça ao longo do tempo (análise de lote, relatório histórico, consumo de ontem no dashboard) usa `qtdNaData`, nunca `qtdAtual`.

### 1.2 Peso médio projetado (hoje)
`calcPesoMedio(movs, gmdEstimado)` (mesmos três arquivos)

Cada movimentação é projetada individualmente com o GMD estimado do lote desde a sua data:

```
para cada movimentação m:
    dias          = max(0, floor((hoje − m.data) / 1 dia))
    pesoAjustado  = m.pesoMedio + gmdEstimado × dias
    Entrada: pesoTotal += m.quantidade × pesoAjustado
    Saída:   pesoTotal −= m.quantidade × pesoAjustado

pesoMedio = pesoTotal / qtdAtual        (0 se qtdAtual ≤ 0)
```

### 1.3 Peso médio de entrada
`LoteCard.tsx::calcularPesoMedioInicial`

```
pesoEntrada = Σ(quantidade × pesoMedio) das Entradas / Σ quantidade das Entradas
```

### 1.4 Dias de trato / confinamento
`home.tsx`, `analise-lote.tsx`

```
diasTrato = max(0, floor((hoje − dataPrimeiraEntrada) / 1 dia))
```

### 1.5 Peso projetado hoje (dashboard)
```
pesoHojeProjetado = pesoEntrada + gmdEstimado × diasTrato
```

### 1.6 GMD real médio e peso real (dashboard `home.tsx`)
A partir de `historicoMapaTrato[].msPorLote[].gmdReal` (só valores > 0 são somados):

```
somaGmd       = Σ gmdReal (todos os dias com descarga, gmdReal > 0)
gmdRealMedio  = somaGmd / diasTrato            (0 se diasTrato = 0)
pesoReal      = pesoEntrada + somaGmd          (0 se somaGmd = 0)
```

> Observação: a média divide pelos dias de confinamento, não pelo número de dias com registro — dias sem descarga puxam a média para baixo por construção.

### 1.7 Peso por consumo e evolução de peso
- `analise-lote.tsx`: `pesoConsumo = pesoEntrada + Σ gmdReal` dos dias com dados.
- `services/relatorioHistoricoLotes.ts`: `evolucaoPeso` acumula `gmdReal > 0` dia a dia a partir de `pesoEntrada`; `quantidade` na data = entradas − saídas com `data ≤ dia`.

### 1.8 Leitura mais recente do dia
`loteCalcCore.ts::escolherLeituraMaisRecente` — entre várias leituras, vence a de maior `data`; em empate, maior `criadoEm` (docs antigos sem `criadoEm` contam como 0).

### 1.9 Ordenação de piquetes
`utils/piqueteOrdenacao.ts::compararPiquetes` — extrai prefixo alfabético e número do nome (`/^([A-Za-zÀ-ÿ]+)\s*(\d+)/`). Ordem de prefixos: `piquete` (0) < `rinc` (1) < `rn` (2) < demais (99, alfabético); depois pelo número.

---

## 2. Modelo NRC — GMD a partir do consumo

`utils/mapaTratoCalc.ts::calcGmdNRC(cmsAnimalKgMS, pesoVivo, ndt, fatores)` · réplica inline em `components/DescargaModal.tsx::getGmdReal`

Entradas: consumo de MS por animal (kg/dia), peso vivo (kg), NDT da dieta (%), fatores `{fatorRaca, fatorGec, fatorImplante, fatorCompensatorio, fatorAditivo}`. Retorna 0 se `cms ≤ 0`, `pesoVivo ≤ 0` ou `ndt ≤ 0`.

**1. Energia da dieta (Mcal/kg MS)**
```
DE  = NDT × 0,04409
ME  = 0,82 × DE
NEm = 1,37·ME − 0,138·ME² + 0,0105·ME³ − 1,12
NEg = 1,42·ME − 0,174·ME² + 0,0122·ME³ − 1,65
→ se NEm ≤ 0 ou NEg ≤ 0: GMD = 0
```

**2. Peso corporal equivalente**
```
SBW   = pesoVivo × 0,96
EQSBW = SBW × fatorGec
```

**3. Manutenção**
```
NEmReq    = 0,077 × EQSBW^0,75          (Mcal/dia)
NEmIntake = cms × NEm
→ se NEmIntake ≤ NEmReq: GMD = 0
```

**4. Energia retida**
```
feedMaint = NEmReq / NEm                 (kg MS p/ manutenção)
feedGain  = cms − feedMaint
RE        = feedGain × NEg               (Mcal/dia)   → se RE ≤ 0: GMD = 0
```

**5. GMD base e ajustes**
```
gmdBase = ( RE / (0,0557 × EQSBW^0,75) ) ^ (1 / 1,097)
GMD     = gmdBase × fatorRaca × fatorImplante × fatorCompensatorio × fatorAditivo
```

**Origem dos fatores** (tabelas auxiliares, `fetchMapaTratoData`):

| Fator | Tabela | Chave | Padrão |
| --- | --- | --- | --- |
| `fatorRaca` | `raca` | `descricao = lote.raca` | 1 |
| `fatorGec` | `gec` | `"{tamanhoCorporal}_{categoria}"` onde `tamanhoCorporal` = `fator` da tabela `tamanhoCorporal` (padrão 5) | 1 |
| `fatorImplante` | `implante` | `lote.implante` | 1 |
| `fatorCompensatorio` | `compensatorio` | `lote.compensatorio` | 1 |
| `fatorAditivo` | `aditivos` | `dieta.aditivoNome` | 1 |

Valores do seed (`utils/seedTabelasAuxiliares.ts`):

| Tabela | Valores |
| --- | --- |
| Raça | Nelore 0,89 · Outros Zebuínos 0,89 · F1 Britânico 0,94 · F1 Continentais 0,96 · F1 Holandês 1,1 · Sintéticas 0,96 · Britânicas 1 · Continentais 1,05 · Cont. dupla apt. 1,1 · Holandês 1,2 |
| Implante | Nenhum 0,95 · Simples 1 · Combinação Simples 1,02 · Combinação Agressiva 1,084 |
| Compensatório | Intenso 1,2 · Moderado 1,1 · Ausente 1 |
| Aditivos | Nenhum 1 · Monensina 1,1 · Salinomicina 1,1 · Lasolicida 1,1 |
| Tamanho corporal | 3 (Gir pequeno) … 9 (Holandês, Chianina, Charolês) — o `fator` é o próprio número |
| GEC | 36 combinações TC 1–9 × categoria: ex. TC5: Macho castr. 0,83 · Macho inteiro 1,00 · Novilhas 1,25 · Vacas 1,25; TC9: 0,69 · 0,83 · 1,04 · 1,04 |
| Categoria | Macho castr. 1,2 · Macho inteiro 1,1 · Novilhas 1 · Vacas 1 (informativo; não entra na fórmula) |

Onde é usado: **GMD real** diário na descarga (`cmsAnimal = totalMS realizado do lote / qtdAnimais`, `pesoVivo = pesoMedio projetado`), exibido no `DescargaModal`, gravado em `msPorLote[].gmdReal` (4 casas) e consumido pelo dashboard, análise de lote, relatório histórico e copiloto.

---

## 3. Leitura de cocho — ajuste do CMS

`src/app/(app)/leitura.tsx` · `agentTools.ts::registrar_leitura_cocho`

Constantes: `CMS_INICIAL = 1,3 %` (lotes sem histórico), `CMS_BASE = 2,6 %`.

### 3.1 Base do dia
Para cada lote, o CMS de partida (`cmsBase`) é, em ordem de prioridade:
1. CMS de **ontem** em `historicoMapaTrato.msPorLote` — `cmsRealizado` (padrão) ou `cmsPrevisto`, conforme `config/app.baseCmsLeitura`;
2. `cmsNovo` da última leitura anterior a hoje;
3. `CMS_INICIAL`.

O CMS exibido (`cmsAtual`) é o `cmsNovo` da leitura de hoje, se existir; senão `cmsBase`.

### 3.2 Nota (1–5)
```
cmsNovo = round4( cmsBase + CMS_BASE × (fator − 1) )
```
Remarcar a nota sempre parte de `cmsBase` (não acumula). Fatores do seed: 1 → 1,10 · 2 → 1,03 · 3 → 1,00 · 4 → 0,97 · 5 → 0,90.

Exemplos com base 1,3 %: nota 1 → 1,56 %; nota 3 → 1,30 %; nota 5 → 1,04 %.

### 3.3 Ajuste fino
```
cmsNovo = round4(cmsAtual ± 0,01)     (rejeitado se ≤ 0; gravado com fator 0)
```

### 3.4 Repetir previsto
```
cmsNovo = cmsPrevisto de ontem        (gravado com nota "Repetir Previsto", fator 1)
```

### 3.5 Alertas
```
limiteMax = cmsPrevistoOntem × max(fatores das notas)   (padrão 1,10)
limiteMin = cmsPrevistoOntem × min(fatores das notas)   (padrão 0,90)
cmsRealizadoOntem > limiteMax → alerta "acima"
cmsRealizadoOntem < limiteMin → alerta "abaixo"
```

### 3.6 Prioridade do CMS no mapa de trato (`fetchMapaTratoData`)
1. Leitura de **hoje** (`cmsNovo > 0`);
2. CMS de ontem do histórico (realizado ou previsto, conforme configuração);
3. `cmsNovo` da última leitura anterior;
4. `CMS_INICIAL`.

---

## 4. Mapa de trato — previsão

`utils/mapaTratoCalc.ts::buildCalcData(roteiros, dietas, insumos, lotesByPiquete, capacidadeVagao, fatores)`

Para cada roteiro ativo (ordenado por `numero`), com sua dieta:

### 4.1 Por lote (piquete do roteiro)
```
qtdAnimais = calcQtdAtual(movs)
pesoMedio  = calcPesoMedio(movs, gmdEstimado)
msLote     = qtdAnimais × pesoMedio × (cmsAtual / 100)              kg MS/dia
moLote     = msLote / (percentualMS_dieta / 100)                     kg MO/dia   (0 se %MS ≤ 0)
```

### 4.2 Totais e tratos
```
totalMS    = Σ msLote
totalMO    = totalMS / (percentualMS_dieta / 100)
numTratos  = totalMO > 0 ? max(minTratos, ceil(totalMO / capacidadeVagao)) : 0
moPerTrato = totalMO / numTratos
msPerTrato = totalMS / numTratos
```

### 4.3 Insumos por trato
```
para cada insumo da dieta (percentual na base MS):
    msInsumo = msPerTrato × (percentual / 100)
    moInsumo = msInsumo / (percentualMS_insumo / 100)     (percentualMS padrão 100)
aguaPrevista = max(0, moPerTrato − Σ moInsumo)
```

### 4.4 Descarga prevista por piquete
```
previsto_piquete = moLote / numTratos
```

### 4.5 Embarques agendados para hoje (`fetchMapaTratoData`)
```
agendadoHoje = Σ quantidade (status = "agendado", data = hoje)
agendadoHoje ≥ qtdAtual (> 0)  → lote sai do cálculo do dia (embarque total)
0 < agendadoHoje < qtdAtual    → movimentação sintética "Saida" em memória
                                 (quantidade = agendadoHoje, pesoMedio = calcPesoMedio atual)
```
Lotes inativos ou sem piquete são ignorados. Dieta inexistente → roteiro com zeros.

---

## 5. Carga e descarga — realizado

### 5.1 %MS final da carga
`mapa-trato.tsx`, `tratador.tsx`, `CargaModal.tsx`
```
totalMSRealizada = Σ (realizado_insumo × percentualMS_insumo / 100)      (todos os tratos)
totalMORealizada = Σ realizado_insumo + Σ aguaRealizada
percentualMSFinal = totalMORealizada > 0 ? totalMSRealizada / totalMORealizada × 100 : 0
```

### 5.2 Custo da carga
```
custoTotal = Σ_insumo (Σ realizado nos tratos × precoMedio_insumo)
```
`precoMedio` é o MPM do insumo no momento (§7.2). A saída de estoque é gravada em `insumos/{id}/saidas` com `precoKg = precoMedio`, `origem: "mapa-trato"`, um documento por insumo/roteiro/dia (`setDocument`, idempotente).

### 5.3 Custo por lote
```
após a carga:    custo_lote = custoTotal × (moLote / totalMO)
após a descarga: custo_lote = custoTotal × (realizadoDescarga_lote / Σ realizadoDescarga)
                 (só recalculado se Σ realizadoDescarga > 0 e custoTotal > 0)
```

### 5.4 MS por lote na descarga (`msPorLote`)
Só calculado quando `percentualMSFinal > 0`.
```
totalMO_lote  = Σ realizado das descargas cujo piqueteId = lote.piqueteId   (todos os tratos)
totalMS_lote  = totalMO_lote × (percentualMSFinal / 100)
cmsPrevisto   = lote.cmsAtual
cmsRealizado  = (qtd > 0 e pesoMedio > 0 e totalMO_lote > 0)
                ? totalMS_lote / (qtdAnimais × pesoMedio) × 100 : 0
cmsAnimal     = totalMS_lote / qtdAnimais
gmdReal       = round4( calcGmdNRC(cmsAnimal, pesoMedio, ndt_dieta, fatores) )
```
Campos gravados: `loteId, loteNumero, piqueteNome, totalMO, previsto (= moLote), totalMS, cmsPrevisto, cmsRealizado, gmdEstimado, gmdReal`.

---

## 6. Dashboard (`home.tsx`) — consumo por cabeça

Com `totalMO_ontem` e `totalMS_ontem` do `msPorLote` de ontem e `qtdOntem = calcQtdNaData(movs, ontem)`:
```
consMOCab = totalMO_ontem / qtdOntem
consMSCab = totalMS_ontem / qtdOntem
cmsPctPV  = pesoHojeProjetado > 0 ? consMSCab / pesoHojeProjetado × 100 : cmsAtual
```
Previsto para hoje (com `cmsPrevPct` = CMS vigente e `%MS` da dieta do roteiro do lote):
```
consMSCabPrev = pesoMedioAtual × (cmsPrevPct / 100)
consMOCabPrev = consMSCabPrev / (percMSDieta / 100)
cmsPctPVPrev  = consMSCabPrev > 0 ? cmsPrevPct : 0
cmsPctPVMedio = média de cmsRealizado (> 0) de todos os dias do lote
```
KPIs: `lotesAtivos = count(ativo)`, `totalAnimais = Σ qtdAtual`, `entradas = Σ Entradas`, `vendas = Σ Saídas "Venda"`, `mortes = Σ Saídas "Morte"`.

---

## 7. Insumos: estoque, custo, autonomia, MS

### 7.1 Estoque
`InsumoCard.tsx::calcularEstoque`
```
estoque = Σ compras.quantidade − Σ saidas.quantidade
```

### 7.2 Preço médio ponderado móvel (MPM)
`InsumoCard.tsx::calcularPrecoMedio` · `mapaTratoCalc.ts::fetchMapaTratoData`
```
eventos = compras (E) ∪ saídas (S), ordenados por data
E: estoque += qtd;  valorTotal += qtd × precoKg
S: se estoque ≤ 0 → ignora
   avg = valorTotal / estoque
   valorTotal −= qtd × avg;  estoque −= qtd
   se estoque < 0 → estoque = 0, valorTotal = 0
precoMedio = estoque > 0 ? valorTotal / estoque : 0
```

### 7.3 Autonomia de estoque
`utils/insumoAutonomia.ts`
```
consumoUltimoDia = Σ quantidade das saídas na data mais recente
autonomiaDias    = consumoUltimoDia > 0 ? estoque / consumoUltimoDia : null
estoqueBaixo     = autonomiaDias ≠ null e autonomiaMinimaDias > 0 e autonomiaDias ≤ autonomiaMinimaDias
```

### 7.4 Conferência de MS vencida (dashboard)
```
tempoMS (parâmetro, dias) > 0:
   insumo com materiaSecaVariavel e sem conferência finalizada → vencido
   floor((hoje − dataUltimaConferenciaFinalizada) / 1 dia) ≥ tempoMS → vencido
```

### 7.5 Conferência de MS por secagem
`utils/materiaSecaCalc.ts` — verificado por `scripts/verificar-conferencia-ms.ts`
```
pesoLiquido(p)      = pesoBruto − tara                               (gramas)
pesoInicialLiquido  = pesoInicialBruto − tara    (≤ 0 → %MS = null)
%MS etapa           = round1( pesoLiquido(etapa) / pesoInicialLiquido × 100 )
tempo sugerido      = 60 min na 1ª pesagem, 10 min nas seguintes
tempoAcumulado      = Σ tempoMin até a etapa
estabilizou         = pesoBruto(última) = pesoBruto(penúltima)
%MS final           = %MS da última pesagem
```
Exemplo real: tara 1 306 g, inicial 1 605 g (líquido 299 g), pesagens 1 510 → 1 490 → 1 480 → 1 480 g ⇒ 174 g líquido ⇒ **58,2 %**.

**MS vigente do insumo** (`msVigente`): `percentualMS` da conferência **finalizada** (`finalizada !== false`) de data mais recente; em empate, a última gravada. Sem conferência finalizada mantém o valor atual.

### 7.6 Custo da dieta (R$/kg MS)
`dietas.tsx::calcularCustoKgMS`
```
para cada insumo da dieta (ignora %MS ≤ 0 ou sem compras):
    precoMedioMO = Σ(qtd × precoKg) / Σ qtd          (média ponderada das compras)
    precoKgMS    = precoMedioMO / (percentualMS_insumo / 100)
    custo       += (percentual_na_dieta / 100) × precoKgMS
```

### 7.7 %MS automática da dieta
`utils/dietaCalc.ts::calcMSDietaBaseMS` (usado por `DietaFormModal.tsx`, toggle *Manter MS*)

As dietas são formuladas no RLM com inclusões em **base de matéria seca**, então a MS da mistura é a média harmônica, não a média ponderada:
```
msDieta = Σ p_i / Σ (p_i / percentualMS_i)        (itens com p_i > 0 e MS_i > 0; 2 casas)
```
Exemplo: silagem 40 % (36,5 % MS), milho 22,5 % (87 %), DDG 34,4 % (90 %), núcleo 2,95 % (100 %), ureia 0,15 % (99 %) → **56,57 %** (a média ponderada daria 68,23 %, que seria o valor correto apenas se a inclusão fosse em matéria natural).

A água adicionada no vagão não entra nesse cálculo: no app ela não é insumo, e a diferença entre o `percentualMS` gravado na dieta e a MS dos insumos é o que o mapa de trato prevê como água (§4.3). Dietas com água na formulação (ex.: planilha SOL, R4-TERM 60,6 % com água × 79,9 % sem) devem ter o valor ajustado manualmente.

Validações: soma dos percentuais = 100 (± 0,01); NDT entre 0 e 100.

---

## 8. Análise de lote (`analise-lote.tsx`)

Com `dailyData` = dias de `historicoMapaTrato` em que o lote tem `custoPorLote` ou `msPorLote`, `cabecas_d` = animais do lote no dia (`loteCalcCore.ts::calcQtdNaData`, movimentações com data ≤ dia) e `custoOperacional` = parâmetro `custo_operacional` (R$/cab/dia). Todas as médias por cabeça são **ponderadas por animais-dia** — o lote muda de tamanho ao longo do período, e dividir pela quantidade atual distorceria o passado (ex.: lote que entrou com 120 e hoje tem 42).
```
dias válidos      = custoLote_d > 0 e cabecas_d > 0
custoDiaMedia     = Σ custoLote_d / Σ cabecas_d + custoOperacional
custoDia5Dias     = idem, últimos 5 dias válidos
custoDiaHoje      = custoLote_último / cabecas_último + custoOperacional
cmsHoje           = último cmsRealizado > 0
cmsMedia          = Σ (cmsRealizado_d × cabecas_d) / Σ cabecas_d        (dias com cmsRealizado > 0)
consMOCab         = totalMO do último dia / cabecas desse dia
gmdRealUltimo     = gmdReal do último dia
pesoConsumo       = pesoEntrada + Σ gmdReal_d
gráficos          : consumoMS_d = totalMS_d / cabecas_d ; custoMSAnimalDia_d = custoLote_d / cabecas_d
layout            : espaçamento = (larguraPlot − 2×12) / (n − 1); rótulo do eixo X a cada ceil(38 px / espaçamento) pontos;
                    se n × 3 px > larguraPlot, agrupa k = ceil(3n / larguraPlot) dias consecutivos e plota a média do bloco
```

---

## 9. Faturamento do lote (`lotes.tsx::fetchFinanceiro` + `FaturamentoModal`)

Por dia com `custoPorLote` do lote:
```
kgMS = msPorLote[lote].totalMS se existir
       senão totalMS_dia × (custo_lote / custoTotal_dia)     (fallback proporcional; 1/numLotes se custoTotal = 0)
custoAcumulado = Σ custo_lote
```

---

## 10. Relatório histórico (`services/relatorioHistoricoLotes.ts`)

Por (lote, dia):
```
quantidade          = entradas − saídas com data ≤ dia
consumoMS           = totalMS / quantidade
consumoPrevistoMO   = previsto / quantidade
consumoRealizadoMO  = totalMO / quantidade
faturamento         = custo do dia
evolucaoPeso        = pesoEntrada + Σ gmdReal (> 0) até o dia
```

---

## 11. SISBOV — numeração e conferências

`src/services/sisbov.ts` — verificado por `scripts/verificar-sisbov.ts`

### 11.1 Dígito verificador
```
base14 = 14 primeiros dígitos
soma   = Σ dígito_i × peso_i, pesos 2,3,…,9,2,3,… da direita para a esquerda
dv     = 11 − (soma mod 11);  se dv ≥ 10 → 0
válido ⇔ 15 dígitos e dv(base14) = dígito 15
```

### 11.2 Manejo e sequência
```
manejo(sisbov)            = sisbov[8..13]   (6 dígitos, posições 9–14)
sisbovByIndex(inicial, i) = (BigInt(base14_inicial) + i) com 14 dígitos + dv recalculado
totalSisbov(ini, fim)     = base14_fim − base14_ini + 1
```
Pedido de brinco: `utilizados = proximoIndice`, `disponiveis = brincosTotal − proximoIndice`, `proximoBrinco = sisbovByIndex(sisbovInicial, proximoIndice)`. Anular consome um índice e registra em `anulados[]`.

### 11.3 Conferência do chip
```
chipConfere ⇔ chipRfid[-4:] = manejo[-4:]
```

### 11.4 Faixa etária da GTA → data de nascimento
```
parseFaixaEtaria: "13 A 24 MESES" → [13,24]; "ACIMA DE 36 MESES" → [36,36] aberta;
                  "ATÉ 12 MESES" → [0,12]; "24 MESES" → [24,24]
meses = aberta ? minMeses : (minMeses + maxMeses) / 2
dataNascimento = dataEmissaoGTA − floor(meses) meses (preservando o dia, limitado ao último dia do mês)
                 − round(fração × 30,4375) dias
```

### 11.5 Faixas do processo (`services/faixasProcesso.ts`)
```
previsto_faixa  = Σ quantidade dos grupos da GTA com a mesma faixa (todas as GTAs do processo)
dataNascimento  = calculada com a GTA de emissão mais recente
sexo            = "ambos" se divergir entre GTAs
manejados_faixa = count(eventos tipo "cadastro" com faixaEtaria = label)
restam          = max(0, previsto − manejados);  completa ⇔ manejados ≥ previsto
pendências      = faltas ("faltam N de P"), excessos ("N a mais que o declarado"),
                  faixas manejadas que não existem nas GTAs
ok ⇔ sem pendências
```

### 11.6 Fechamento (`services/fechamentoProcesso.ts`)
```
pronto   ⇔ conferência ok e animais.length > 0
previsto = Σ previsto das faixas (ou totalAnimaisPrevisto do processo)
avisos   = terceiros por dono, mistura próprio/terceiro, sem peso, sem chip RFID,
           sem destino (metadados.localId), processo sem GTA
```

### 11.7 Embarque (`services/embarque.ts`)
```
liberado ⇔ nenhum animal com proprietario.tipo = "terceiro"
porProprietario agrupado por cpfCnpj ?? nome, ordenado por quantidade desc
```

### 11.8 Conferência de lote de GTAs (`gtaParser.ts::conferirLoteDeGtas`)
Avisos quando há mais de um `procCodigoMapa`, mais de um `destCodigoMapa` ou `serie+numero` repetidos.

---

## 12. Eventos e sanidade

### 12.1 GMD do animal (`services/eventoUtils.ts::gmdDosEventos`)
```
pesagens = eventos tipo "pesagem" com peso, do mais recente ao mais antigo
< 2 pesagens → null
dias  = max(1, round((última.dataHora − primeira.dataHora) / 1 dia))
gmdKg = (última.peso − primeira.peso) / dias
```
Classificação (`animal-detalhe.tsx`): ≥ 1,5 **ótimo** · ≥ 1,0 **bom** · ≥ 0,5 **regular** · abaixo **ruim**.

### 12.2 Linha do tempo
- `semEstornados`: remove eventos `estorno` e os eventos por eles apontados (`eventoEstornadoId`).
- `maisRecentePrimeiro`: ordena por `dataHora` desc, desempate por `criadoEm` desc.
- `agruparPorMomento`: agrupa por `dataHora|processoId`.

### 12.3 Protocolos (`services/protocoloUtils.ts`)
```
carenciaAte = dataAplicacao + carenciaDias     (ISO)
proximaEm   = dataAplicacao + repetirEmDias
carenciaAtiva(eventosSanitarios, hoje) = maior `reentrada` futura, ou null
```

### 12.4 Validação de pesagem (`pesagemFirestoreService.ts::validarPesagem`)
`animalId` obrigatório; SISBOV válido (DV); `peso > 0`, `≥ 50 kg`, `≤ 1 500 kg`; `dataHora`, `leituraChip.timestamp` e `leituraPeso.timestamp` presentes. Pesagem sem chip lido grava `leituraChip.valido = false` e `dispositivoId = "manual"`.

### 12.5 Relatório de pesagens
```
mediasPeso.geral = Σ peso / nº eventos "pesagem" com peso > 0 no período
erros            = eventos sem peso válido
```

### 12.6 Contador do processo (`BrincoService`)
```
incrementar: animaisManejados += 1; status = manejados ≥ totalPrevisto ? "concluido" (+dataConclusao) : "em_andamento"
decrementar: animaisManejados = max(0, manejados − 1); mesma regra de status
```

---

## 13. Dispositivos de pesagem (parsing)

`services/bluetoothService.ts`
- **Balança** (BPB 085 / ACR HD Easy via Nordic UART): linha ASCII `+0000.0;Z;1;\r\n`. Regex `^\+(-?\d+(?:\.\d+)?);([A-Za-z])` → `peso`, status `I`/`U` = instável, demais (`E`/`Z`) = estável. Polling do comando de peso a cada 700 ms (a balança não envia espontaneamente).
- **Leitor RFID XRS2i**: EID decimal de 15 dígitos terminado em `\r\n`; `valido ⇔ /^\d{15}$/`; sinal = RSSI do dispositivo BLE.
- Web Serial (`serialService.web.ts`): comando `;peso\r\n`, polling 700 ms.

---

## 14. Combustível

`src/app/(app)/abastecimento.tsx`, `TanqueCard.tsx`
```
consumo        = (tipoMarcador ≠ "nenhum" e marcadorAtual > marcadorAnterior)
                 ? litros / (marcadorAtual − marcadorAnterior) : null     (L/km ou L/h)
novoNivelTanque = max(0, nivelAtual − litros)
percentualTanque = capacidade > 0 ? nivelAtual / capacidade × 100 : 0
alertaBaixo     ⇔ nivelAtual ≤ alertaNivelMinimo
validação       : marcadorAtual ≥ marcadorAnterior
totalLitros (histórico) = Σ litros do filtro
```

### 14.1 OCR (`services/ocrService.ts`, ML Kit)
- **Bomba**: procura `(\d+[\.,]?\d*)\s*(LITROS|LTS|LT|L)` ou o inverso (confiança *high*, valor entre 0 e 100 000); fallback: menor número < 10 000 (*low*).
- **Painel**: `(\d+[\.,]\d+)\s*(km|h|hrs)` ou `(\d{3,7}[\.,]\d{0,1})` (*high*); fallback: maior número de 3–7 dígitos (*low*).

---

## 15. Estimativa de peso por imagem

- **IA visual** (`services/aiWeightEstimation.ts`): modelo `claude-sonnet-4-20250514`, `max_tokens` 1024, prompt pede JSON `{pesoEstimado, confiancaMin, confiancaMax, escoreCondicaoCorporal (1–9), observacao}`; contexto opcional do lote (raça, categoria, tamanho corporal, peso projetado, GMD). Na web passa pelo proxy `/api/anthropic`.
- **Modelo local** (`services/localWeightEstimation.ts`): imagem redimensionada para 224×224, normalizada em [0,1]; saída única = peso.
  ```
  pesoEstimado = round1(saída)
  confiancaMin = round1(peso × 0,92);  confiancaMax = round1(peso × 1,08)      (±8 %)
  ```
  O decodificador JPEG atual é um placeholder (copia bytes brutos) — a inferência real depende de um decoder nativo.

---

## 16. Copiloto WhatsApp — regras embutidas

- `registrar_leitura_cocho` reproduz exatamente §3 (base do dia conforme `config/app`, `CMS_BASE`).
- System prompt orienta alertar GMD < 1,2–1,5 kg/dia, CMS fora de 1,8–3,2 % e insumo com < 15 dias de consumo.
- **Cron de alertas** (`api/cron/alertas.ts`): usa a última leitura de cada lote ativo com limites fixos `cmsAnterior × 0,9` e `× 1,1` — mais simples que os alertas da tela de leitura (que usam os fatores da tabela e o realizado × previsto de ontem).

---

## 17. Validadores (`utils/validators.ts`)

- **CPF**: 11 dígitos, rejeita sequências repetidas; DV1 = pesos 10…2 mod 11; DV2 = pesos 11…2 mod 11.
- **CNPJ**: 14 dígitos, rejeita repetidos; pesos `[5,4,3,2,9,8,7,6,5,4,3,2]` e `[6,5,4,3,2,9,8,7,6,5,4,3,2]`.
