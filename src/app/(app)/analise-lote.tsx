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
import { useResponsive } from "@/hooks/useResponsive";
import { getCollection } from "@/services/firestoreService";
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
import { LinearGradient } from "expo-linear-gradient";
import { BarChart, LineChart } from "react-native-gifted-charts";

// ---- Types ----

type DailyData = {
  data: string;
  custoLote: number;
  totalMS: number;
  totalMO: number;
  cmsRealizado: number;
  gmdReal: number;
};

// ---- Component ----

export default function AnaliseLote() {
  const { isTablet, isDesktop, maxWidthContent } = useResponsive();

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

  useFocusEffect(
    useCallback(() => {
      fetchLotes();
    }, [])
  );

  async function fetchLotes() {
    try {
      setLoadingLotes(true);
      const lotesSnap = await getCollection("lotes");
      const lotesData: Lote[] = [];

      for (const doc of lotesSnap.docs) {
        const d = doc.data();
        if (!d.ativo) continue;

        const movSnap = await getCollection("lotes", doc.id, "movimentacoes");
        const movimentacoes: Movimentacao[] = movSnap.docs.map((m) => ({
          id: m.id,
          ...m.data(),
        })) as Movimentacao[];

        const qtd = calcularQuantidadeAtual(movimentacoes);
        if (qtd <= 0) continue;

        lotesData.push({ id: doc.id, ...d, movimentacoes } as Lote);
      }

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

  // Custo diária por animal
  const custoDiarioArray = dailyData
    .filter((d) => d.custoLote > 0)
    .map((d) => d.custoLote / qtdAnimais + custoOperacional);

  const custoDiaMedia =
    custoDiarioArray.length > 0
      ? custoDiarioArray.reduce((a, b) => a + b, 0) / custoDiarioArray.length
      : 0;
  const custoDiaHoje =
    custoDiarioArray.length > 0
      ? custoDiarioArray[custoDiarioArray.length - 1]
      : 0;
  const ultimos5 = custoDiarioArray.slice(-5);
  const custoDia5Dias =
    ultimos5.length > 0
      ? ultimos5.reduce((a, b) => a + b, 0) / ultimos5.length
      : 0;

  // CMS % PV
  const cmsValues = dailyData.filter((d) => d.cmsRealizado > 0);
  const cmsHoje =
    cmsValues.length > 0 ? cmsValues[cmsValues.length - 1].cmsRealizado : 0;
  const cmsMedia =
    cmsValues.length > 0
      ? cmsValues.reduce((a, d) => a + d.cmsRealizado, 0) / cmsValues.length
      : 0;

  // Consumo MO/cab e GMD real mais recente
  const lastDay = dailyData.length > 0 ? dailyData[dailyData.length - 1] : null;
  const consMOCab = lastDay && qtdAnimais > 0 ? lastDay.totalMO / qtdAnimais : 0;
  const gmdRealUltimo = lastDay ? lastDay.gmdReal : 0;

  // ---- Chart data ----

  function formatLabel(data: string) {
    const [, m, d] = data.split("-");
    return `${d}/${m}`;
  }

  const cmsChartData = cmsValues.map((d) => ({
    value: parseFloat(d.cmsRealizado.toFixed(2)),
    label: formatLabel(d.data),
    dataPointText: d.cmsRealizado.toFixed(2) + "%",
  }));

  const msBarData = dailyData
    .filter((d) => d.totalMS > 0)
    .map((d) => ({
      value: parseFloat((qtdAnimais > 0 ? d.totalMS / qtdAnimais : 0).toFixed(2)),
      label: formatLabel(d.data),
      frontColor: "#D4A843",
    }));

  const custoLineData = dailyData
    .filter((d) => d.custoLote > 0)
    .map((d) => ({
      value: parseFloat(
        (qtdAnimais > 0 ? d.custoLote / qtdAnimais : 0).toFixed(2)
      ),
    }));

  // Leitura cocho color
  function leituraColor(nota: string): string {
    switch (nota) {
      case "1": return "#4CAF50";
      case "2": return "#3366FF";
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
            <Text style={styles.kpiMainValue}>
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
            <Text style={styles.kpiMainValue}>
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
            <Text style={[styles.kpiMainValue, { color: "#3366FF" }]}>
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
    const chartWidth = isDesktop ? 700 : undefined;

    return (
      <>
        {/* Chart 1: CMS % PV */}
        <View style={styles.chartCard}>
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
          {cmsChartData.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <LineChart
                data={cmsChartData}
                width={chartWidth}
                height={180}
                color="#3366FF"
                thickness={2}
                dataPointsColor="#3366FF"
                dataPointsRadius={4}
                xAxisLabelTextStyle={styles.chartXLabel}
                yAxisTextStyle={styles.chartYLabel}
                noOfSections={4}
                spacing={60}
                initialSpacing={20}
                endSpacing={20}
                hideRules
                yAxisOffset={0}
                isAnimated
                LinearGradient={LinearGradient}
              />
            </ScrollView>
          ) : (
            <Text style={styles.emptyChart}>Sem dados de CMS</Text>
          )}
        </View>

        {/* Chart 2: Consumo MS x Preço */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>
            Consumo Materia Seca x Preco Kg MS
          </Text>
          {msBarData.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <BarChart
                data={msBarData}
                width={chartWidth}
                height={200}
                barWidth={28}
                spacing={32}
                initialSpacing={20}
                endSpacing={20}
                xAxisLabelTextStyle={styles.chartXLabel}
                yAxisTextStyle={styles.chartYLabel}
                noOfSections={5}
                showLine
                lineData={custoLineData}
                lineConfig={{
                  color: "#3366FF",
                  thickness: 2,
                  dataPointsColor: "#3366FF",
                  dataPointsRadius: 3,
                }}
                hideRules
                isAnimated
                LinearGradient={LinearGradient}
              />
            </ScrollView>
          ) : (
            <Text style={styles.emptyChart}>Sem dados de consumo</Text>
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
                style={[styles.legendDot, { backgroundColor: "#3366FF" }]}
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
          <Text style={styles.indicatorValue}>
            {consMOCab > 0 ? consMOCab.toFixed(2) : "-"}
          </Text>
        </View>

        {/* GMD Previsto Calculado Consumo */}
        <View style={styles.indicatorCard}>
          <Text style={styles.indicatorLabel}>
            GMD Previsto Calc. Consumo
          </Text>
          <Text style={styles.indicatorValue}>
            {gmdRealUltimo > 0 ? gmdRealUltimo.toFixed(2) : "-"}
          </Text>
        </View>

        {/* Animais */}
        <View style={styles.indicatorCard}>
          <Text style={styles.indicatorLabel}>Animais</Text>
          <Text style={[styles.indicatorValue, { fontSize: 36 }]}>
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
            <Text style={styles.indicatorValue}>-</Text>
          )}
        </View>

        {/* Roteiro */}
        <View style={styles.indicatorCard}>
          <Text style={styles.indicatorLabel}>Roteiro</Text>
          <Text style={styles.indicatorValue}>
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
              isTablet &&
              !isDesktop && {
                maxWidth: maxWidthContent,
                alignSelf: "center" as const,
                width: "100%",
              },
            ]}
          >
            <View style={styles.header}>
              <Text style={styles.title}>Analise por Lote</Text>
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
                  label: `Lote ${l.numero} - ${l.raca || "Sem raca"} (${l.piqueteNome || "Sem piquete"})`,
                  value: l.id,
                }))}
                onSelect={handleSelectLote}
                loading={loadingLotes}
              />
            </View>

            {loadingData && (
              <ActivityIndicator
                size="large"
                color="#3366FF"
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
