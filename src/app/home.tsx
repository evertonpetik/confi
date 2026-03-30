import { DrawerSceneWrapper } from "@/components/drawe-scene-wrapper";
import { Movimentacao } from "@/components/LoteCard";
import { useResponsive } from "@/hooks/useResponsive";
import {
  fsLimit,
  fsOrderBy,
  getCollection,
  queryCollection,
} from "@/services/firestoreService";
import { Feather } from "@expo/vector-icons";
import { DrawerToggleButton } from "@react-navigation/drawer";
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

// ---- Types ----

type LoteReportRow = {
  piquete: string;
  loteNumero: number;
  dieta: string;
  quantidade: number;
  produtor: string;
  categoria: string;
  dataEntrada: string;
  pesoEntrada: number;
  diasTrato: number;
  raca: string;
  consMOCab: number;
  consMSCab: number;
  cmsPctPV: number;
  leituraCocho: string;
  gmdEstimado: number;
  pesoHojeProjetado: number;
  gmdRealMedio: number;
  pesoReal: number;
  cmsPctPVMedio: number;
};

// ---- Component ----

export default function Home() {
  const { isTablet, isDesktop, maxWidthContent } = useResponsive();
  const [lotesAtivos, setLotesAtivos] = useState(0);
  const [totalAnimais, setTotalAnimais] = useState(0);
  const [totalMortes, setTotalMortes] = useState(0);
  const [totalVendas, setTotalVendas] = useState(0);
  const [totalEntradas, setTotalEntradas] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reportRows, setReportRows] = useState<LoteReportRow[]>([]);
  const [insumosVencidos, setInsumosVencidos] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      fetchDashboard();
    }, [])
  );

  async function fetchDashboard() {
    try {
      setLoading(true);
      const [lotesSnap, histSnap, insumosSnap, parametrosSnap] = await Promise.all([
        getCollection("lotes"),
        getCollection("historicoMapaTrato"),
        getCollection("insumos"),
        getCollection("parametros"),
      ]);

      // Verificar conferências de MS vencidas
      const tempoMSParam = parametrosSnap.docs.find(
        (d) => d.data().descricao === "tempoMS"
      );
      const tempoMSDias = tempoMSParam ? Number(tempoMSParam.data().valor) : 0;

      if (tempoMSDias > 0) {
        const hojeMs = new Date().getTime();
        const vencidos: string[] = [];

        for (const insumoDoc of insumosSnap.docs) {
          const insumoData = insumoDoc.data();
          if (!insumoData.materiaSecaVariavel) continue;

          const confSnap = await getCollection("insumos", insumoDoc.id, "conferencias");
          if (confSnap.empty) {
            vencidos.push(insumoData.nome ?? "Sem nome");
            continue;
          }

          // Encontrar data mais recente
          let maisRecente = "";
          for (const cDoc of confSnap.docs) {
            const cData = cDoc.data().data as string;
            if (cData > maisRecente) maisRecente = cData;
          }

          if (maisRecente) {
            const dataConf = new Date(maisRecente + "T00:00:00").getTime();
            const diffDias = Math.floor((hojeMs - dataConf) / 86400000);
            if (diffDias >= tempoMSDias) {
              vencidos.push(insumoData.nome ?? "Sem nome");
            }
          }
        }

        setInsumosVencidos(vencidos);
      } else {
        setInsumosVencidos([]);
      }

      // Build historico lookups: loteId -> { gmdReal[], msPorLote (today) }
      const hoje = (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      })();
      const gmdRealByLote = new Map<string, number[]>();
      const cmsByLote = new Map<string, number[]>();
      const todayMOByLote = new Map<string, number>();
      const todayMSByLote = new Map<string, number>();

      for (const hDoc of histSnap.docs) {
        const h = hDoc.data();
        const msPorLote = h.msPorLote as { loteId: string; totalMO?: number; totalMS?: number; gmdReal?: number; cmsRealizado?: number }[] | undefined;
        if (!msPorLote) continue;
        for (const ml of msPorLote) {
          if (ml.gmdReal != null && ml.gmdReal > 0) {
            const prev = gmdRealByLote.get(ml.loteId) ?? [];
            prev.push(ml.gmdReal);
            gmdRealByLote.set(ml.loteId, prev);
          }
          if (ml.cmsRealizado != null && ml.cmsRealizado > 0) {
            const prev = cmsByLote.get(ml.loteId) ?? [];
            prev.push(ml.cmsRealizado);
            cmsByLote.set(ml.loteId, prev);
          }
          if (h.data === hoje) {
            if (ml.totalMO != null && ml.totalMO > 0) {
              todayMOByLote.set(ml.loteId, (todayMOByLote.get(ml.loteId) ?? 0) + ml.totalMO);
            }
            if (ml.totalMS != null && ml.totalMS > 0) {
              todayMSByLote.set(ml.loteId, (todayMSByLote.get(ml.loteId) ?? 0) + ml.totalMS);
            }
          }
        }
      }

      let ativos = 0;
      let animais = 0;
      let mortes = 0;
      let vendas = 0;
      let entradas = 0;
      const rows: LoteReportRow[] = [];

      for (const loteDoc of lotesSnap.docs) {
        const ld = loteDoc.data();
        if (ld.ativo !== true) continue;
        ativos++;

        const movSnap = await getCollection("lotes", loteDoc.id, "movimentacoes");
        const movs: Movimentacao[] = movSnap.docs.map((m) => ({
          id: m.id,
          ...(m.data() as Omit<Movimentacao, "id">),
        }));

        // Dashboard totals
        let qtdAtual = 0;
        for (const m of movs) {
          if (m.evento === "Entrada") {
            qtdAtual += m.quantidade;
            entradas += m.quantidade;
          } else {
            qtdAtual -= m.quantidade;
            if (m.movimentacao === "Morte") mortes += m.quantidade;
            if (m.movimentacao === "Venda") vendas += m.quantidade;
          }
        }
        animais += qtdAtual;

        // First entry date and peso
        const entradasMov = movs
          .filter((m) => m.evento === "Entrada")
          .sort((a, b) => a.data.localeCompare(b.data));
        const primeiraEntrada = entradasMov[0];
        const dataEntrada = primeiraEntrada?.data ?? "";
        const totalAnimaisEntrada = entradasMov.reduce((a, m) => a + m.quantidade, 0);
        const pesoEntrada = totalAnimaisEntrada > 0
          ? entradasMov.reduce((a, m) => a + m.quantidade * m.pesoMedio, 0) / totalAnimaisEntrada
          : 0;

        // Dias de trato
        const hojeDate = new Date();
        const dataEntradaDate = dataEntrada ? new Date(dataEntrada + "T00:00:00") : hojeDate;
        const diasTrato = Math.max(0, Math.floor((hojeDate.getTime() - dataEntradaDate.getTime()) / 86400000));

        // Peso hoje projetado (peso medio initial + gmdEstimado * dias)
        const gmdEst = ld.gmdEstimado ?? 0;
        const pesoHojeProjetado = pesoEntrada + gmdEst * diasTrato;

        // Last leitura de cocho
        let leituraCocho = "-";
        let cmsAtual = 0;
        try {
          const leitSnap = await queryCollection(
            ["lotes", loteDoc.id, "leituras"],
            [fsOrderBy("data", "desc"), fsLimit(1)]
          );
          if (!leitSnap.empty) {
            const l = leitSnap.docs[0].data();
            leituraCocho = l.nota ?? "-";
            cmsAtual = l.cmsNovo ?? 0;
          }
        } catch { /* no index */ }

        // Consumo do dia (MO e MS por cabeca)
        const totalMOHoje = todayMOByLote.get(loteDoc.id) ?? 0;
        const totalMSHoje = todayMSByLote.get(loteDoc.id) ?? 0;
        const consMOCab = qtdAtual > 0 ? totalMOHoje / qtdAtual : 0;
        const consMSCab = qtdAtual > 0 ? totalMSHoje / qtdAtual : 0;

        // CMS % PV (hoje)
        const cmsPctPV = pesoHojeProjetado > 0 ? (consMSCab / pesoHojeProjetado) * 100 : cmsAtual;

        // GMD real medio
        const gmds = gmdRealByLote.get(loteDoc.id) ?? [];
        const gmdRealMedio = gmds.length > 0 ? gmds.reduce((a, g) => a + g, 0) / gmds.length : 0;

        // Peso real
        const pesoReal = gmds.length > 0 ? pesoEntrada + gmds.reduce((a, g) => a + g, 0) : 0;

        // CMS %PV medio
        const cmsArr = cmsByLote.get(loteDoc.id) ?? [];
        const cmsPctPVMedio = cmsArr.length > 0 ? cmsArr.reduce((a, c) => a + c, 0) / cmsArr.length : 0;

        rows.push({
          piquete: ld.piqueteNome ?? "-",
          loteNumero: ld.numero ?? 0,
          dieta: ld.dietaNome ?? "-",
          quantidade: qtdAtual,
          produtor: ld.produtor ?? "-",
          categoria: ld.categoria ?? "-",
          dataEntrada: dataEntrada ? new Date(dataEntrada + "T00:00:00").toLocaleDateString("pt-BR") : "-",
          pesoEntrada,
          diasTrato,
          raca: ld.raca ?? "-",
          consMOCab,
          consMSCab,
          cmsPctPV,
          leituraCocho,
          gmdEstimado: gmdEst,
          pesoHojeProjetado,
          gmdRealMedio,
          pesoReal,
          cmsPctPVMedio,
        });
      }

      rows.sort((a, b) => a.loteNumero - b.loteNumero);
      setReportRows(rows);
      setLotesAtivos(ativos);
      setTotalAnimais(animais);
      setTotalMortes(mortes);
      setTotalVendas(vendas);
      setTotalEntradas(entradas);
    } catch (error) {
      console.error("Erro ao buscar dashboard:", error);
    } finally {
      setLoading(false);
    }
  }

  const cardBasis = isDesktop ? ("30%" as const) : ("47%" as const);

  // Table column definitions
  const columns: { key: keyof LoteReportRow; label: string; width: number; format?: (v: LoteReportRow) => string }[] = [
    { key: "piquete", label: "Piquete", width: 100 },
    { key: "loteNumero", label: "Lote", width: 60, format: (r) => `${r.loteNumero}` },
    { key: "dieta", label: "Dieta", width: 100 },
    { key: "quantidade", label: "Qtde", width: 60, format: (r) => `${r.quantidade}` },
    { key: "produtor", label: "Produtor", width: 110 },
    { key: "categoria", label: "Categoria", width: 100 },
    { key: "dataEntrada", label: "Dt Entrada", width: 90 },
    { key: "pesoEntrada", label: "Peso Ent.", width: 80, format: (r) => r.pesoEntrada > 0 ? r.pesoEntrada.toFixed(1) : "-" },
    { key: "diasTrato", label: "Dias", width: 55, format: (r) => `${r.diasTrato}` },
    { key: "raca", label: "Raca", width: 110 },
    { key: "consMOCab", label: "MO/cab", width: 75, format: (r) => r.consMOCab > 0 ? r.consMOCab.toFixed(1) : "-" },
    { key: "consMSCab", label: "MS/cab", width: 75, format: (r) => r.consMSCab > 0 ? r.consMSCab.toFixed(2) : "-" },
    { key: "cmsPctPV", label: "CMS %PV", width: 75, format: (r) => r.cmsPctPV > 0 ? r.cmsPctPV.toFixed(2) : "-" },
    { key: "leituraCocho", label: "Leit. Cocho", width: 80 },
    { key: "gmdEstimado", label: "GMD Est.", width: 75, format: (r) => r.gmdEstimado > 0 ? r.gmdEstimado.toFixed(3) : "-" },
    { key: "pesoHojeProjetado", label: "Peso Proj.", width: 80, format: (r) => r.pesoHojeProjetado > 0 ? r.pesoHojeProjetado.toFixed(1) : "-" },
    { key: "gmdRealMedio", label: "GMD Real", width: 75, format: (r) => r.gmdRealMedio > 0 ? r.gmdRealMedio.toFixed(3) : "-" },
    { key: "pesoReal", label: "Peso Real", width: 80, format: (r) => r.pesoReal > 0 ? r.pesoReal.toFixed(1) : "-" },
    { key: "cmsPctPVMedio", label: "CMS %PV Med", width: 90, format: (r) => r.cmsPctPVMedio > 0 ? r.cmsPctPVMedio.toFixed(2) : "-" },
  ];

  function getCellValue(row: LoteReportRow, col: typeof columns[number]): string {
    if (col.format) return col.format(row);
    return String(row[col.key]);
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
          <View style={[styles.container, isTablet && !isDesktop && { maxWidth: maxWidthContent, alignSelf: "center" as const, width: "100%" }]}>

            {insumosVencidos.length > 0 && (
              <View style={styles.alertBanner}>
                <Feather name="alert-circle" size={18} color="#FFF" />
                <Text style={styles.alertBannerText}>
                  Conferencia de MS pendente: {insumosVencidos.join(", ")}
                </Text>
              </View>
            )}

            <View style={styles.header}>
              <Text style={styles.title}>Dashboard</Text>
              {!isDesktop && <DrawerToggleButton tintColor="#000000" />}
            </View>

            <Text style={styles.subtitle}>
              Visao geral do seu confinamento.
            </Text>



            {loading ? (
              <ActivityIndicator
                size="large"
                color="#3366FF"
                style={{ marginTop: 48 }}
              />
            ) : (
              <>
                {/* Report Table */}
                {reportRows.length > 0 && (
                  <View style={styles.tableSection}>
                    <Text style={styles.tableTitle}>Relatorio de Lotes Ativos</Text>
                    <View style={styles.tableContainer}>
                      <ScrollView horizontal showsHorizontalScrollIndicator>
                        <View>
                          {/* Header */}
                          <View style={styles.tableHeaderRow}>
                            {columns.map((col) => (
                              <View key={col.key} style={[styles.tableHeaderCell, { width: col.width }]}>
                                <Text style={styles.tableHeaderText} numberOfLines={2}>{col.label}</Text>
                              </View>
                            ))}
                          </View>
                          {/* Rows */}
                          {reportRows.map((row, i) => (
                            <View
                              key={row.loteNumero}
                              style={[styles.tableDataRow, i % 2 === 1 && styles.tableDataRowAlt]}
                            >
                              {columns.map((col) => (
                                <View key={col.key} style={[styles.tableDataCell, { width: col.width }]}>
                                  <Text style={styles.tableDataText} numberOfLines={1}>
                                    {getCellValue(row, col)}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          ))}
                        </View>
                      </ScrollView>
                    </View>
                  </View>
                )}

                {/* Dashboard Cards */}
                <View style={styles.cardsContainer}>
                  <View style={[styles.card, styles.cardBlue, { flexBasis: cardBasis }]}>
                    <View style={styles.cardIcon}>
                      <Feather name="layers" size={24} color="#3366FF" />
                    </View>
                    <Text style={styles.cardValue}>{lotesAtivos}</Text>
                    <Text style={styles.cardLabel}>Lotes Ativos</Text>
                  </View>

                  <View style={[styles.card, styles.cardGreen, { flexBasis: cardBasis }]}>
                    <View style={styles.cardIcon}>
                      <Feather name="bar-chart-2" size={24} color="#2E7D32" />
                    </View>
                    <Text style={styles.cardValue}>{totalAnimais}</Text>
                    <Text style={styles.cardLabel}>Total de Animais</Text>
                  </View>

                  <View style={[styles.card, styles.cardTeal, { flexBasis: cardBasis }]}>
                    <View style={styles.cardIcon}>
                      <Feather name="log-in" size={24} color="#00796B" />
                    </View>
                    <Text style={styles.cardValue}>{totalEntradas}</Text>
                    <Text style={styles.cardLabel}>Entradas</Text>
                  </View>

                  <View style={[styles.card, styles.cardOrange, { flexBasis: cardBasis }]}>
                    <View style={styles.cardIcon}>
                      <Feather name="dollar-sign" size={24} color="#E65100" />
                    </View>
                    <Text style={styles.cardValue}>{totalVendas}</Text>
                    <Text style={styles.cardLabel}>Vendas</Text>
                  </View>

                  <View style={[styles.card, styles.cardRed, { flexBasis: cardBasis }]}>
                    <View style={styles.cardIcon}>
                      <Feather name="alert-triangle" size={24} color="#C62828" />
                    </View>
                    <Text style={styles.cardValue}>{totalMortes}</Text>
                    <Text style={styles.cardLabel}>Mortes</Text>
                  </View>
                </View>
              </>
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
  // ---- Alert Banner ----
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E65100",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 16,
    gap: 10,
  },
  alertBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: "#FFF",
  },
  // ---- Report Table ----
  tableSection: {
    marginTop: 24,
    marginBottom: 8,
  },
  tableTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 12,
  },
  tableContainer: {
    borderWidth: 1,
    borderColor: "#DCDCDC",
    borderRadius: 8,
    overflow: "hidden",
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#3366FF",
  },
  tableHeaderCell: {
    paddingHorizontal: 6,
    paddingVertical: 10,
    justifyContent: "center",
  },
  tableHeaderText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFF",
  },
  tableDataRow: {
    flexDirection: "row",
    backgroundColor: "#FFF",
  },
  tableDataRowAlt: {
    backgroundColor: "#F5F7FA",
  },
  tableDataCell: {
    paddingHorizontal: 6,
    paddingVertical: 8,
    justifyContent: "center",
  },
  tableDataText: {
    fontSize: 11,
    color: "#1a1a1a",
  },
  // ---- Dashboard Cards ----
  cardsContainer: {
    marginTop: 32,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  card: {
    flexGrow: 1,
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    minWidth: 140,
  },
  cardBlue: {
    backgroundColor: "#EEF2FF",
  },
  cardGreen: {
    backgroundColor: "#E8F5E9",
  },
  cardRed: {
    backgroundColor: "#FFEBEE",
  },
  cardTeal: {
    backgroundColor: "#E0F2F1",
  },
  cardOrange: {
    backgroundColor: "#FFF3E0",
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  cardValue: {
    fontSize: 32,
    fontWeight: "900",
    color: "#1a1a1a",
  },
  cardLabel: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
    textAlign: "center",
  },
});
