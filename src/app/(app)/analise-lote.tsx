import { DrawerSceneWrapper } from "@/components/drawe-scene-wrapper";
import { DrawerToggleButton } from "@/components/DrawerToggleButton";
import {
  calcularPesoMedio,
  calcularPesoMedioInicial,
  calcularQuantidadeAtual,
  type Lote,
  type Movimentacao,
} from "@/components/LoteCard";
import { Select } from "@/components/Select";
import { useTheme } from "@/contexts/ThemeContext";
import { useResponsive } from "@/hooks/useResponsive";
import { getCollection } from "@/services/firestoreService";
import { calcQtdNaData } from "@/utils/loteCalcCore";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BarChart, LineChart } from "react-native-gifted-charts";

// ---- Types ----

type DailyData = {
  data: string;
  custoLote: number;
  totalMS: number;
  totalMO: number;
  cmsRealizado: number;
  gmdReal: number;
  /** Animais no lote naquele dia (movimentações até a data). */
  cabecas: number;
};

// ---- Component ----

export default function AnaliseLote() {
  const { primaryColor } = useTheme();
  const { isTablet, isDesktop, maxWidthContent, containerPadding, titleFontSize, headerPaddingTop, cardValueFontSize } = useResponsive();

  const [lotes, setLotes] = useState<Lote[]>([]);
  const [loadingLotes, setLoadingLotes] = useState(true);
  const [selectedLoteId, setSelectedLoteId] = useState("");
  const [selectedLote, setSelectedLote] = useState<Lote | null>(null);
  const [loadingData, setLoadingData] = useState(false);

  // Computed data
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [custoOperacional, setCustoOperacional] = useState(0);
  const [ultimaLeitura, setUltimaLeitura] = useState<{ nota: string; data: string } | null>(null);
  const [roteiroInfo, setRoteiroInfo] = useState<string | null>(null);
  // Largura útil do card de gráfico (medida em runtime) — os gráficos se
  // redimensionam para caber todos os dias sem scroll, como um painel de BI.
  const [chartAreaWidth, setChartAreaWidth] = useState(0);

  useFocusEffect(
    useCallback(() => {
      fetchLotes();
    }, [])
  );

  async function fetchLotes() {
    try {
      setLoadingLotes(true);
      const lotesSnap = await getCollection("lotes");
      const lotesAtivosDocs = lotesSnap.docs.filter((doc) => doc.data().ativo);

      const movSnaps = await Promise.all(
        lotesAtivosDocs.map((doc) => getCollection("lotes", doc.id, "movimentacoes"))
      );

      const lotesData: Lote[] = [];

      lotesAtivosDocs.forEach((doc, idx) => {
        const d = doc.data();
        const movSnap = movSnaps[idx];
        const movimentacoes: Movimentacao[] = movSnap.docs.map((m) => ({
          id: m.id,
          ...m.data(),
        })) as Movimentacao[];

        const qtd = calcularQuantidadeAtual(movimentacoes);
        if (qtd <= 0) return;

        lotesData.push({ id: doc.id, ...d, movimentacoes } as Lote);
      });

      lotesData.sort((a, b) => a.numero - b.numero);
      setLotes(lotesData);
    } catch (err) {
      console.error("Erro ao buscar lotes:", err);
    } finally {
      setLoadingLotes(false);
    }
  }

  async function handleSelectLote(loteId: string) {
    setSelectedLoteId(loteId);
    const lote = lotes.find((l) => l.id === loteId) ?? null;
    setSelectedLote(lote);
    if (lote) {
      await fetchLoteData(lote);
    }
  }

  async function fetchLoteData(lote: Lote) {
    try {
      setLoadingData(true);

      const [historicoSnap, leiturasSnap, parametrosSnap, roteirosSnap] =
        await Promise.all([
          getCollection("historicoMapaTrato"),
          getCollection("lotes", lote.id, "leituras"),
          getCollection("parametros"),
          getCollection("roteiros"),
        ]);

      // Custo operacional
      const custoOpDoc = parametrosSnap.docs.find(
        (d) => d.data().descricao === "custo_operacional"
      );
      const custoOp = custoOpDoc ? Number(custoOpDoc.data().valor) : 0;
      setCustoOperacional(custoOp);

      // Historico filtrado pelo lote
      const daily: DailyData[] = [];
      for (const doc of historicoSnap.docs) {
        const h = doc.data();
        const custoPorLote = (h.custoPorLote ?? []) as any[];
        const msPorLote = (h.msPorLote ?? []) as any[];

        const custoEntry = custoPorLote.find((c: any) => c.loteId === lote.id);
        const msEntry = msPorLote.find((m: any) => m.loteId === lote.id);

        if (custoEntry || msEntry) {
          daily.push({
            data: h.data,
            custoLote: custoEntry?.custo ?? 0,
            totalMS: msEntry?.totalMS ?? 0,
            totalMO: msEntry?.totalMO ?? 0,
            cmsRealizado: msEntry?.cmsRealizado ?? 0,
            gmdReal: msEntry?.gmdReal ?? 0,
            cabecas: calcQtdNaData(lote.movimentacoes, h.data),
          });
        }
      }
      daily.sort((a, b) => a.data.localeCompare(b.data));
      setDailyData(daily);

      // Ultima leitura de cocho
      let lastLeitura: { nota: string; data: string } | null = null;
      for (const doc of leiturasSnap.docs) {
        const l = doc.data();
        if (!lastLeitura || l.data > lastLeitura.data) {
          lastLeitura = { nota: l.nota, data: l.data };
        }
      }
      setUltimaLeitura(lastLeitura);

      // Roteiro que atende o piquete do lote
      let roteiroDesc: string | null = null;
      for (const doc of roteirosSnap.docs) {
        const r = doc.data();
        const piquetes = (r.piquetes ?? []) as any[];
        if (piquetes.some((p: any) => p.piqueteId === lote.piqueteId)) {
          roteiroDesc = `R${r.numero}`;
          break;
        }
      }
      setRoteiroInfo(roteiroDesc);
    } catch (err) {
      console.error("Erro ao buscar dados do lote:", err);
    } finally {
      setLoadingData(false);
    }
  }

  // ---- Calculations ----

  const qtdAnimais = selectedLote
    ? calcularQuantidadeAtual(selectedLote.movimentacoes)
    : 0;
  const pesoProjetado = selectedLote
    ? calcularPesoMedio(selectedLote.movimentacoes, selectedLote.gmdEstimado)
    : 0;
  const pesoEntrada = selectedLote
    ? calcularPesoMedioInicial(selectedLote.movimentacoes)
    : 0;

  // Peso real pelo consumo
  const pesoConsumo =
    dailyData.length > 0
      ? pesoEntrada + dailyData.reduce((acc, d) => acc + d.gmdReal, 0)
      : 0;

  // Dias de confinamento
  const entradas = selectedLote
    ? selectedLote.movimentacoes
      .filter((m) => m.evento === "Entrada")
      .sort((a, b) => a.data.localeCompare(b.data))
    : [];
  const primeiraEntrada = entradas.length > 0 ? entradas[0] : null;
  const diasConfinamento = primeiraEntrada
    ? Math.floor(
      (new Date().getTime() -
        new Date(primeiraEntrada.data + "T00:00:00").getTime()) /
      (1000 * 60 * 60 * 24)
    )
    : 0;

  // Custo diária por animal — ponderado por animais-dia: o lote muda de tamanho
  // ao longo do período, então dividir pela quantidade atual distorce o passado.
  const diasComCusto = dailyData.filter((d) => d.custoLote > 0 && d.cabecas > 0);
  function custoDiaPonderado(dias: DailyData[]): number {
    const cabDias = dias.reduce((a, d) => a + d.cabecas, 0);
    if (cabDias <= 0) return 0;
    return dias.reduce((a, d) => a + d.custoLote, 0) / cabDias + custoOperacional;
  }

  const custoDiaMedia = custoDiaPonderado(diasComCusto);
  const custoDiaHoje = custoDiaPonderado(diasComCusto.slice(-1));
  const custoDia5Dias = custoDiaPonderado(diasComCusto.slice(-5));

  // CMS % PV — média ponderada por animais-dia
  const cmsValues = dailyData.filter((d) => d.cmsRealizado > 0);
  const cmsHoje =
    cmsValues.length > 0 ? cmsValues[cmsValues.length - 1].cmsRealizado : 0;
  const cmsCabDias = cmsValues.reduce((a, d) => a + d.cabecas, 0);
  const cmsMedia =
    cmsCabDias > 0
      ? cmsValues.reduce((a, d) => a + d.cmsRealizado * d.cabecas, 0) / cmsCabDias
      : cmsValues.length > 0
        ? cmsValues.reduce((a, d) => a + d.cmsRealizado, 0) / cmsValues.length
        : 0;

  // Consumo MO/cab e GMD real mais recente (com os animais daquele dia)
  const lastDay = dailyData.length > 0 ? dailyData[dailyData.length - 1] : null;
  const consMOCab = lastDay && lastDay.cabecas > 0 ? lastDay.totalMO / lastDay.cabecas : 0;
  const gmdRealUltimo = lastDay ? lastDay.gmdReal : 0;

  // ---- Chart data ----

  function formatLabel(data: string) {
    const [, m, d] = data.split("-");
    return `${d}/${m}`;
  }

  // ---- Layout responsivo dos gráficos ----
  // Tudo cabe na largura disponível: o espaçamento entre pontos/barras é
  // derivado da quantidade de dias, e os rótulos do eixo X são afinados para
  // não se sobreporem (um rótulo a cada `passoRotulo` dias).
  const Y_AXIS_WIDTH = 40;
  const EDGE_SPACING = 12;
  const LABEL_MIN_PX = 38;
  const plotWidth = Math.max(0, chartAreaWidth - Y_AXIS_WIDTH);

  function layoutLinha(n: number) {
    const spacing = n > 1 ? Math.max(1, (plotWidth - 2 * EDGE_SPACING) / (n - 1)) : plotWidth / 2;
    const passoRotulo = Math.max(1, Math.ceil(LABEL_MIN_PX / spacing));
    return { spacing, passoRotulo, mostrarPontos: spacing >= 14 };
  }

  function layoutBarras(n: number) {
    // barra + vão, com o vão em 40 % da barra; barra entre 2 e 28 px
    const bruto = n > 0 ? (plotWidth - 2 * EDGE_SPACING) / (n + 0.4 * Math.max(0, n - 1)) : 28;
    const barWidth = Math.min(28, Math.max(2, bruto));
    const spacing = n > 1 ? Math.max(0.5, (plotWidth - 2 * EDGE_SPACING - n * barWidth) / (n - 1)) : 0;
    const passoRotulo = Math.max(1, Math.ceil(LABEL_MIN_PX / (barWidth + spacing)));
    return { barWidth, spacing, passoRotulo };
  }

  function rotulo(data: string, i: number, n: number, passo: number) {
    // Mostra o primeiro, o último e um a cada `passo`; evita colar o penúltimo no último
    if (i === n - 1) return formatLabel(data);
    if (i % passo === 0 && n - 1 - i >= Math.ceil(passo / 2)) return formatLabel(data);
    return "";
  }

  // Quando há mais dias do que pixels razoáveis (3 px por ponto), agrupa dias
  // consecutivos e plota a média do bloco — como um painel de BI faz ao
  // reduzir a granularidade. Abaixo disso, um ponto/barra por dia.
  const MIN_PX_POR_PONTO = 3;
  function fatorAgregacao(n: number) {
    const disponivel = Math.max(1, plotWidth - 2 * EDGE_SPACING);
    return Math.max(1, Math.ceil((n * MIN_PX_POR_PONTO) / disponivel));
  }
  type Ponto = { data: string; valores: number[] };
  function agregar(pontos: Ponto[], k: number): Ponto[] {
    if (k <= 1) return pontos;
    const out: Ponto[] = [];
    for (let i = 0; i < pontos.length; i += k) {
      const bloco = pontos.slice(i, i + k);
      out.push({
        data: bloco[0].data,
        valores: bloco[0].valores.map((_, j) => bloco.reduce((a, p) => a + p.valores[j], 0) / bloco.length),
      });
    }
    return out;
  }

  const kCms = fatorAgregacao(cmsValues.length);
  const cmsPontos = agregar(
    cmsValues.map((d) => ({ data: d.data, valores: [d.cmsRealizado] })),
    kCms
  );
  const linhaLayout = layoutLinha(cmsPontos.length);
  const cmsChartData = cmsPontos.map((p, i) => ({
    value: parseFloat(p.valores[0].toFixed(2)),
    label: rotulo(p.data, i, cmsPontos.length, linhaLayout.passoRotulo),
    dataPointText: linhaLayout.mostrarPontos && linhaLayout.passoRotulo === 1 ? p.valores[0].toFixed(2) + "%" : "",
  }));

  const diasConsumo = dailyData.filter((d) => d.totalMS > 0 && d.cabecas > 0);
  const kConsumo = fatorAgregacao(diasConsumo.length);
  const consumoPontos = agregar(
    diasConsumo.map((d) => ({ data: d.data, valores: [d.totalMS / d.cabecas, d.custoLote / d.cabecas] })),
    kConsumo
  );
  const barrasLayout = layoutBarras(consumoPontos.length);
  const msBarData = consumoPontos.map((p, i) => ({
    value: parseFloat(p.valores[0].toFixed(2)),
    label: rotulo(p.data, i, consumoPontos.length, barrasLayout.passoRotulo),
    frontColor: "#D4A843",
  }));

  // Mesmos blocos do gráfico de barras, para a linha ficar alinhada às barras
  const custoLineData = consumoPontos.map((p) => ({
    value: parseFloat(p.valores[1].toFixed(2)),
  }));

  // Leitura cocho color
  function leituraColor(nota: string): string {
    switch (nota) {
      case "1": return "#4CAF50";
      case "2": return primaryColor;
      case "3": return "#FF9800";
      case "4": return "#FF5722";
      case "5": return "#E53935";
      default: return "#888";
    }
  }

  // ---- Render ----

  function renderKPIs() {
    return (
      <>
        {/* Lote Info Panel */}
        <View style={styles.loteInfoPanel}>
          <View style={styles.loteInfoRow}>
            <Text style={styles.loteInfoLabel}>Piquete</Text>
            <Text style={styles.loteInfoValue}>
              {selectedLote?.piqueteNome || "-"}
            </Text>
          </View>
          <View style={styles.loteInfoRow}>
            <Text style={styles.loteInfoLabel}>Lote</Text>
            <Text style={styles.loteInfoValue}>
              Lote {selectedLote?.numero}
            </Text>
          </View>
          <View style={styles.loteInfoRow}>
            <Text style={styles.loteInfoLabel}>Produtor</Text>
            <Text style={styles.loteInfoValue}>
              {selectedLote?.produtor || "-"}
            </Text>
          </View>
          <View style={styles.loteInfoRow}>
            <Text style={styles.loteInfoLabel}>Categoria</Text>
            <Text style={styles.loteInfoValue}>
              {selectedLote?.categoria || "-"}
            </Text>
          </View>
        </View>

        {/* KPI Row 1 */}
        <View style={[styles.kpiRow, isDesktop && styles.kpiRowDesktop]}>
          {/* Custo Diária */}
          <View style={[styles.kpiCard, { flex: 1 }]}>
            <Text style={styles.kpiTitle}>Custo Diaria</Text>
            <Text style={[styles.kpiMainValue, { fontSize: cardValueFontSize }]} adjustsFontSizeToFit numberOfLines={1}>
              R$ {custoDiaMedia.toFixed(2)}
            </Text>
            <Text style={styles.kpiSubLabel}>R$/dia media</Text>
            <View style={styles.kpiSubRow}>
              <View style={styles.kpiSubItem}>
                <Text style={styles.kpiSubValue}>
                  R$ {custoDia5Dias.toFixed(2)}
                </Text>
                <Text style={styles.kpiSubLabel}>R$/dia ult. 5 dias</Text>
              </View>
              <View style={styles.kpiSubItem}>
                <Text style={styles.kpiSubValue}>
                  R$ {custoDiaHoje.toFixed(2)}
                </Text>
                <Text style={styles.kpiSubLabel}>R$/dia hoje</Text>
              </View>
            </View>
          </View>

          {/* Peso por Animal */}
          <View style={[styles.kpiCard, { flex: 1 }]}>
            <Text style={styles.kpiTitle}>Peso por Animal Kg</Text>
            <Text style={[styles.kpiMainValue, { fontSize: cardValueFontSize }]} adjustsFontSizeToFit numberOfLines={1}>
              {pesoProjetado > 0 ? pesoProjetado.toFixed(2) : "-"}
            </Text>
            <Text style={styles.kpiSubLabel}>Kg Hoje Projetado</Text>
            <View style={styles.kpiSubRow}>
              <View style={styles.kpiSubItem}>
                <Text style={styles.kpiSubValue}>
                  {pesoEntrada > 0 ? pesoEntrada.toFixed(2) : "-"}
                </Text>
                <Text style={styles.kpiSubLabel}>Peso de Entrada</Text>
              </View>
              <View style={styles.kpiSubItem}>
                <Text style={styles.kpiSubValue}>
                  {pesoConsumo > 0 ? pesoConsumo.toFixed(2) : "-"}
                </Text>
                <Text style={styles.kpiSubLabel}>Kg pelo consumo</Text>
              </View>
            </View>
            <View style={styles.kpiSubRow}>
              <View style={styles.kpiSubItem}>
                <Text style={styles.kpiSubValue}>
                  {selectedLote?.pesoAbate ? `${selectedLote.pesoAbate}` : "-"}
                </Text>
                <Text style={styles.kpiSubLabel}>Kg Prev. Abate</Text>
              </View>
            </View>
          </View>

          {/* Dias de Confinamento */}
          <View style={[styles.kpiCard, { flex: 1 }]}>
            <Text style={styles.kpiTitle}>Dias de confinamento</Text>
            <Text style={[styles.kpiMainValue, { fontSize: cardValueFontSize, color: primaryColor }]} adjustsFontSizeToFit numberOfLines={1}>
              {diasConfinamento}
            </Text>
            <Text style={styles.kpiSubLabel}>dias</Text>
            <View style={styles.kpiSubRow}>
              <View style={styles.kpiSubItem}>
                <Text style={styles.kpiSubValue}>
                  {primeiraEntrada
                    ? formatLabel(primeiraEntrada.data)
                    : "-"}
                </Text>
                <Text style={styles.kpiSubLabel}>Data Entrada</Text>
              </View>
            </View>
          </View>
        </View>
      </>
    );
  }

  function renderCharts() {
    const pronto = plotWidth > 0;

    return (
      <>
        {/* Chart 1: CMS % PV */}
        <View
          style={styles.chartCard}
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width - 2 * 16; // padding do card
            if (Math.abs(w - chartAreaWidth) > 1) setChartAreaWidth(w);
          }}
        >
          <View style={styles.chartHeaderRow}>
            <Text style={styles.chartTitle}>
              Consumo Materia Seca % Peso Vivo
            </Text>
            <View style={styles.chartSideValues}>
              <Text style={styles.chartSideMain}>
                {cmsHoje.toFixed(2)}%
              </Text>
              <Text style={styles.chartSideLabel}>CMS % PV - Hoje</Text>
              <Text style={styles.chartSideSecondary}>
                {cmsMedia.toFixed(2)}%
              </Text>
              <Text style={styles.chartSideLabel}>Media CMS % PV</Text>
            </View>
          </View>
          {kCms > 1 && (
            <Text style={styles.chartSideLabel}>
              {cmsValues.length} dias · cada ponto é a média de {kCms} dias
            </Text>
          )}
          {cmsChartData.length === 0 ? (
            <Text style={styles.emptyChart}>Sem dados de CMS</Text>
          ) : !pronto ? (
            <View style={{ height: 180 }} />
          ) : (
            <LineChart
              data={cmsChartData}
              width={plotWidth}
              height={180}
              color={primaryColor}
              thickness={2}
              dataPointsColor={primaryColor}
              dataPointsRadius={linhaLayout.mostrarPontos ? 3 : 0}
              hideDataPoints={!linhaLayout.mostrarPontos}
              xAxisLabelTextStyle={styles.chartXLabel}
              yAxisTextStyle={styles.chartYLabel}
              yAxisLabelWidth={Y_AXIS_WIDTH}
              noOfSections={4}
              spacing={linhaLayout.spacing}
              initialSpacing={EDGE_SPACING}
              endSpacing={EDGE_SPACING}
              hideRules
              yAxisOffset={0}
              disableScroll
              isAnimated
            />
          )}
        </View>

        {/* Chart 2: Consumo MS x Preço */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>
            Consumo Materia Seca x Preco Kg MS
          </Text>
          {kConsumo > 1 && (
            <Text style={styles.chartSideLabel}>
              {diasConsumo.length} dias · cada barra é a média de {kConsumo} dias
            </Text>
          )}
          {msBarData.length === 0 ? (
            <Text style={styles.emptyChart}>Sem dados de consumo</Text>
          ) : !pronto ? (
            <View style={{ height: 200 }} />
          ) : (
            <BarChart
              data={msBarData}
              width={plotWidth}
              height={200}
              barWidth={barrasLayout.barWidth}
              spacing={barrasLayout.spacing}
              initialSpacing={EDGE_SPACING}
              endSpacing={EDGE_SPACING}
              xAxisLabelTextStyle={styles.chartXLabel}
              yAxisTextStyle={styles.chartYLabel}
              yAxisLabelWidth={Y_AXIS_WIDTH}
              noOfSections={5}
              showLine
              lineData={custoLineData}
              lineConfig={{
                color: primaryColor,
                thickness: 2,
                dataPointsColor: primaryColor,
                dataPointsRadius: barrasLayout.barWidth >= 8 ? 3 : 0,
                hideDataPoints: barrasLayout.barWidth < 8,
                initialSpacing: EDGE_SPACING + barrasLayout.barWidth / 2,
                spacing: barrasLayout.barWidth + barrasLayout.spacing,
              }}
              hideRules
              disableScroll
              isAnimated
            />
          )}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: "#D4A843" }]}
              />
              <Text style={styles.legendText}>Consumo MS (kg/cab)</Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: primaryColor }]}
              />
              <Text style={styles.legendText}>Custo MS Animal Dia (R$)</Text>
            </View>
          </View>
        </View>
      </>
    );
  }

  function renderBottomIndicators() {
    return (
      <View style={[styles.indicatorRow, isDesktop && styles.indicatorRowDesktop]}>
        {/* Consumo Dieta MO/Cab */}
        <View style={styles.indicatorCard}>
          <Text style={styles.indicatorLabel}>Consumo Dieta MO/Cab/Kg</Text>
          <Text style={styles.indicatorValue} adjustsFontSizeToFit numberOfLines={1}>
            {consMOCab > 0 ? consMOCab.toFixed(2) : "-"}
          </Text>
        </View>

        {/* GMD Previsto Calculado Consumo */}
        <View style={styles.indicatorCard}>
          <Text style={styles.indicatorLabel}>
            GMD Previsto Calc. Consumo
          </Text>
          <Text style={styles.indicatorValue} adjustsFontSizeToFit numberOfLines={1}>
            {gmdRealUltimo > 0 ? gmdRealUltimo.toFixed(2) : "-"}
          </Text>
        </View>

        {/* Animais */}
        <View style={styles.indicatorCard}>
          <Text style={styles.indicatorLabel}>Animais</Text>
          <Text style={[styles.indicatorValue, { fontSize: 36 }]} adjustsFontSizeToFit numberOfLines={1}>
            {qtdAnimais}
          </Text>
        </View>

        {/* Leitura de Cocho */}
        <View style={styles.indicatorCard}>
          <Text style={styles.indicatorLabel}>Leitura de Cocho</Text>
          {ultimaLeitura ? (
            <View style={styles.leituraRow}>
              <View
                style={[
                  styles.leituraBadge,
                  { backgroundColor: leituraColor(ultimaLeitura.nota) },
                ]}
              >
                <Text style={styles.leituraBadgeText}>
                  {ultimaLeitura.nota}
                </Text>
              </View>
              <Text style={styles.leituraDate}>
                {formatLabel(ultimaLeitura.data)}
              </Text>
            </View>
          ) : (
            <Text style={styles.indicatorValue} adjustsFontSizeToFit numberOfLines={1}>-</Text>
          )}
        </View>

        {/* Roteiro */}
        <View style={styles.indicatorCard}>
          <Text style={styles.indicatorLabel}>Roteiro</Text>
          <Text style={styles.indicatorValue} adjustsFontSizeToFit numberOfLines={1}>
            {roteiroInfo || "-"}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <DrawerSceneWrapper>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.select({ ios: "padding", android: "height" })}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.container,
              { padding: containerPadding },
              isTablet &&
              !isDesktop && {
                maxWidth: maxWidthContent,
                alignSelf: "center" as const,
                width: "100%",
              },
            ]}
          >
            <View style={[styles.header, { paddingTop: headerPaddingTop }]}>
              <Text style={[styles.title, { fontSize: titleFontSize, flex: 1 }]} numberOfLines={1}>Analise por Lote</Text>
              {!isDesktop && <DrawerToggleButton tintColor="#000000" />}
            </View>
            <Text style={styles.subtitle}>
              Dashboard de acompanhamento detalhado por lote.
            </Text>

            {/* Select Lote */}
            <View style={{ marginTop: 20 }}>
              <Text style={styles.label}>Selecione o Lote</Text>
              <Select
                placeholder="Selecione um lote"
                value={selectedLoteId}
                options={lotes.map((l) => ({
                  label: `Lote ${l.numero} - ${l.raca || "Sem raca"} - ${l.produtor || "Sem produtor"} (${l.piqueteNome || "Sem piquete"})`,
                  value: l.id,
                }))}
                onSelect={handleSelectLote}
                loading={loadingLotes}
              />
            </View>

            {loadingData && (
              <ActivityIndicator
                size="large"
                color={primaryColor}
                style={{ marginTop: 32 }}
              />
            )}

            {selectedLote && !loadingData && (
              <View style={{ marginTop: 20, gap: 16 }}>
                {renderKPIs()}
                {renderCharts()}
                {renderBottomIndicators()}
              </View>
            )}

            {selectedLote && !loadingData && dailyData.length === 0 && (
              <View style={styles.emptyState}>
                <Feather name="alert-circle" size={48} color="#DCDCDC" />
                <Text style={styles.emptyStateText}>
                  Sem dados de historico para este lote.
                </Text>
                <Text style={styles.emptyStateSubtext}>
                  Execute o mapa de trato para gerar dados de consumo e custos.
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </DrawerSceneWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FDFDFD",
    padding: 32,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 40,
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginTop: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#444",
    marginBottom: 6,
  },

  // Lote Info Panel
  loteInfoPanel: {
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  loteInfoRow: {
    minWidth: 120,
  },
  loteInfoLabel: {
    fontSize: 12,
    color: "#999",
  },
  loteInfoValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a1a",
  },

  // KPI Cards
  kpiRow: {
    gap: 12,
  },
  kpiRowDesktop: {
    flexDirection: "row",
  },
  kpiCard: {
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    padding: 16,
  },
  kpiTitle: {
    fontSize: 13,
    color: "#888",
    fontWeight: "600",
    marginBottom: 4,
  },
  kpiMainValue: {
    fontSize: 32,
    fontWeight: "900",
    color: "#1a1a1a",
  },
  kpiSubRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 8,
  },
  kpiSubItem: {},
  kpiSubValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  kpiSubLabel: {
    fontSize: 11,
    color: "#999",
  },

  // Charts
  chartCard: {
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    padding: 16,
  },
  chartHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1a1a1a",
    flex: 1,
  },
  chartSideValues: {
    alignItems: "flex-end",
    marginLeft: 12,
  },
  chartSideMain: {
    fontSize: 24,
    fontWeight: "900",
    color: "#1a1a1a",
  },
  chartSideLabel: {
    fontSize: 11,
    color: "#999",
  },
  chartSideSecondary: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
    marginTop: 4,
  },
  chartXLabel: {
    fontSize: 9,
    color: "#999",
  },
  chartYLabel: {
    fontSize: 10,
    color: "#999",
  },
  emptyChart: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    paddingVertical: 32,
  },
  legendRow: {
    flexDirection: "row",
    gap: 20,
    marginTop: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 12,
    color: "#666",
  },

  // Bottom Indicators
  indicatorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  indicatorRowDesktop: {
    flexWrap: "nowrap",
  },
  indicatorCard: {
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    padding: 16,
    minWidth: 140,
    flex: 1,
    alignItems: "center",
  },
  indicatorLabel: {
    fontSize: 12,
    color: "#888",
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 8,
  },
  indicatorValue: {
    fontSize: 28,
    fontWeight: "900",
    color: "#1a1a1a",
  },

  // Leitura de Cocho
  leituraRow: {
    alignItems: "center",
    gap: 6,
  },
  leituraBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  leituraBadgeText: {
    fontSize: 22,
    fontWeight: "900",
    color: "#FFF",
  },
  leituraDate: {
    fontSize: 11,
    color: "#999",
  },

  // Empty state
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 12,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#888",
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
  },
});
