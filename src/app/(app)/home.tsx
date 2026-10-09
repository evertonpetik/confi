import { DrawerSceneWrapper } from "@/components/drawe-scene-wrapper";
import { DrawerToggleButton } from "@/components/DrawerToggleButton";
import { Movimentacao } from "@/components/LoteCard";
import { useTheme } from "@/contexts/ThemeContext";
import { useResponsive } from "@/hooks/useResponsive";
import {
  fsLimit,
  fsOrderBy,
  getCollection,
  queryCollection,
} from "@/services/firestoreService";
import { compararPiquetes } from "@/utils/piqueteOrdenacao";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
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

// ---- Column filter modal ----

type ColumnFilterModalProps = {
  columnLabel: string;
  values: string[];
  selectedValues: Set<string>;
  onToggleValue: (value: string) => void;
  onClose: () => void;
};

function ColumnFilterModal({ columnLabel, values, selectedValues, onToggleValue, onClose }: ColumnFilterModalProps) {
  const { primaryColor } = useTheme();
  const [search, setSearch] = useState("");

  const filteredValues = values.filter((v) => v.toLowerCase().includes(search.toLowerCase()));

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.filterModalOverlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.filterModalSheet}>
          <View style={styles.filterModalHeader}>
            <Text style={styles.filterModalHeaderTitle}>Filtrar: {columnLabel}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={22} color="#333" />
            </TouchableOpacity>
          </View>

          <View style={styles.filterModalSearchWrapper}>
            <Feather name="search" size={16} color="#999" style={styles.filterModalSearchIcon} />
            <TextInput
              style={styles.filterModalSearchInput}
              placeholder="Buscar valor..."
              value={search}
              onChangeText={setSearch}
            />
          </View>

          <FlatList
            data={filteredValues}
            keyExtractor={(item) => item}
            renderItem={({ item }) => {
              const isSelected = selectedValues.has(item);
              return (
                <TouchableOpacity
                  style={styles.filterModalOption}
                  onPress={() => onToggleValue(item)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.filterModalCheckbox,
                      isSelected && { backgroundColor: primaryColor, borderColor: primaryColor },
                    ]}
                  >
                    {isSelected && <Feather name="check" size={12} color="#FFF" />}
                  </View>
                  <Text style={styles.filterModalOptionText} numberOfLines={1}>{item}</Text>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={<Text style={styles.filterModalEmptyText}>Nenhum valor encontrado</Text>}
            style={{ maxHeight: 320 }}
          />

          <TouchableOpacity
            style={[styles.filterModalConfirmButton, { backgroundColor: primaryColor }]}
            onPress={onClose}
          >
            <Text style={styles.filterModalConfirmButtonText}>Confirmar ({selectedValues.size})</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---- Component ----

export default function Home() {
  const { primaryColor } = useTheme();
  const { isTablet, isDesktop, maxWidthContent, containerPadding, titleFontSize, headerPaddingTop, cardValueFontSize } = useResponsive();
  const [lotesAtivos, setLotesAtivos] = useState(0);
  const [totalAnimais, setTotalAnimais] = useState(0);
  const [totalMortes, setTotalMortes] = useState(0);
  const [totalVendas, setTotalVendas] = useState(0);
  const [totalEntradas, setTotalEntradas] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reportRows, setReportRows] = useState<LoteReportRow[]>([]);
  const [insumosVencidos, setInsumosVencidos] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<keyof LoteReportRow | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [columnFilters, setColumnFilters] = useState<Partial<Record<keyof LoteReportRow, Set<string>>>>({});
  const [filterModalColumn, setFilterModalColumn] = useState<keyof LoteReportRow | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchDashboard();
    }, [])
  );

  async function fetchDashboard() {
    try {
      setLoading(true);
      const [lotesSnap, histSnap, insumosSnap, parametrosSnap, roteirosSnap] = await Promise.all([
        getCollection("lotes"),
        getCollection("historicoMapaTrato"),
        getCollection("insumos"),
        getCollection("parametros"),
        getCollection("roteiros"),
      ]);

      // Build piqueteId -> dietaNome map from roteiros
      const piqueteDietaMap = new Map<string, string>();
      for (const rDoc of roteirosSnap.docs) {
        const rData = rDoc.data();
        const dietaNome = (rData.dietaNome as string) ?? "";
        const piquetes = (rData.piquetes ?? []) as { piqueteId: string; piqueteNome: string }[];
        for (const p of piquetes) {
          if (p.piqueteId && dietaNome) {
            piqueteDietaMap.set(p.piqueteId, dietaNome);
          }
        }
      }

      // Verificar conferências de MS vencidas
      const tempoMSParam = parametrosSnap.docs.find(
        (d) => d.data().descricao === "tempoMS"
      );
      const tempoMSDias = tempoMSParam ? Number(tempoMSParam.data().valor) : 0;

      if (tempoMSDias > 0) {
        const hojeMs = new Date().getTime();
        const vencidos: string[] = [];

        const insumosComMS = insumosSnap.docs.filter((d) => d.data().materiaSecaVariavel);
        const confSnaps = await Promise.all(
          insumosComMS.map((insumoDoc) => getCollection("insumos", insumoDoc.id, "conferencias"))
        );

        insumosComMS.forEach((insumoDoc, idx) => {
          const insumoData = insumoDoc.data();
          const confSnap = confSnaps[idx];

          if (confSnap.empty) {
            vencidos.push(insumoData.nome ?? "Sem nome");
            return;
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
        });

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

      const lotesAtivosDocs = lotesSnap.docs.filter((d) => d.data().ativo === true);

      const [movSnaps, leitSnaps] = await Promise.all([
        Promise.all(lotesAtivosDocs.map((loteDoc) => getCollection("lotes", loteDoc.id, "movimentacoes"))),
        Promise.all(
          lotesAtivosDocs.map((loteDoc) =>
            queryCollection(
              ["lotes", loteDoc.id, "leituras"],
              [fsOrderBy("data", "desc"), fsLimit(1)]
            ).catch(() => null)
          )
        ),
      ]);

      let ativos = 0;
      let animais = 0;
      let mortes = 0;
      let vendas = 0;
      let entradas = 0;
      const rows: LoteReportRow[] = [];

      lotesAtivosDocs.forEach((loteDoc, idx) => {
        const ld = loteDoc.data();
        ativos++;

        const movSnap = movSnaps[idx];
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
        const leitSnap = leitSnaps[idx];
        if (leitSnap && !leitSnap.empty) {
          const l = leitSnap.docs[0].data();
          leituraCocho = l.nota ?? "-";
          cmsAtual = l.cmsNovo ?? 0;
        }

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
          dieta: (ld.piqueteId ? piqueteDietaMap.get(ld.piqueteId) : undefined) ?? "-",
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
      });

      rows.sort((a, b) => compararPiquetes(a.piquete, b.piquete));
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

  function getUniqueColumnValues(col: typeof columns[number]): string[] {
    const values = new Set(reportRows.map((row) => getCellValue(row, col)));
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }

  function getFilteredRows(rows: LoteReportRow[]): LoteReportRow[] {
    const activeFilters = Object.entries(columnFilters) as [keyof LoteReportRow, Set<string>][];
    if (activeFilters.length === 0) return rows;
    return rows.filter((row) =>
      activeFilters.every(([key, allowedValues]) => {
        const col = columns.find((c) => c.key === key);
        if (!col) return true;
        return allowedValues.has(getCellValue(row, col));
      })
    );
  }

  function getSortedRows(rows: LoteReportRow[]): LoteReportRow[] {
    const sorted = [...rows];
    if (!sortKey) {
      sorted.sort((a, b) => compararPiquetes(a.piquete, b.piquete));
      return sorted;
    }
    sorted.sort((a, b) => {
      const valueA = a[sortKey];
      const valueB = b[sortKey];
      let comparison = 0;
      if (typeof valueA === "number" && typeof valueB === "number") {
        comparison = valueA - valueB;
      } else {
        comparison = String(valueA).localeCompare(String(valueB));
      }
      return sortDir === "asc" ? comparison : -comparison;
    });
    return sorted;
  }

  function handleSortPress(key: keyof LoteReportRow) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function handleToggleFilterValue(key: keyof LoteReportRow, value: string, allValues: string[]) {
    setColumnFilters((prev) => {
      const current = prev[key] ?? new Set(allValues);
      const next = new Set(current);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      const updated = { ...prev };
      if (next.size === allValues.length) {
        delete updated[key];
      } else {
        updated[key] = next;
      }
      return updated;
    });
  }

  const visibleRows = getSortedRows(getFilteredRows(reportRows));

  const filterModalCol = filterModalColumn ? columns.find((c) => c.key === filterModalColumn) : null;
  const filterModalValues = filterModalCol ? getUniqueColumnValues(filterModalCol) : [];
  const filterModalSelected = filterModalColumn
    ? columnFilters[filterModalColumn] ?? new Set(filterModalValues)
    : new Set<string>();

  return (
    <DrawerSceneWrapper>
      <>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.select({ ios: "padding", android: "height" })}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.container, { padding: containerPadding }, isTablet && !isDesktop && { maxWidth: maxWidthContent, alignSelf: "center" as const, width: "100%" }]}>

            {insumosVencidos.length > 0 && (
              <View style={styles.alertBanner}>
                <Feather name="alert-circle" size={18} color="#FFF" />
                <Text style={styles.alertBannerText}>
                  Conferencia de MS pendente: {insumosVencidos.join(", ")}
                </Text>
              </View>
            )}

            <View style={[styles.header, { paddingTop: headerPaddingTop }]}>
              <Text style={[styles.title, { fontSize: titleFontSize, flex: 1 }]} numberOfLines={1}>Dashboard</Text>
              {!isDesktop && <DrawerToggleButton tintColor="#000000" />}
            </View>

            <Text style={styles.subtitle}>
              Visao geral do seu confinamento.
            </Text>



            {loading ? (
              <ActivityIndicator
                size="large"
                color={primaryColor}
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
                          <View style={[styles.tableHeaderRow, { backgroundColor: primaryColor }]}>
                            {columns.map((col) => {
                              const isSorted = sortKey === col.key;
                              const isFiltered = !!columnFilters[col.key];
                              return (
                                <TouchableOpacity
                                  key={col.key}
                                  style={[styles.tableHeaderCell, styles.tableHeaderCellTouchable, { width: col.width }]}
                                  onPress={() => handleSortPress(col.key)}
                                  activeOpacity={0.7}
                                >
                                  <Text style={styles.tableHeaderText} numberOfLines={2}>{col.label}</Text>
                                  <View style={styles.tableHeaderIcons}>
                                    {isSorted && (
                                      <Feather
                                        name={sortDir === "asc" ? "chevron-up" : "chevron-down"}
                                        size={12}
                                        color="#FFF"
                                      />
                                    )}
                                    <TouchableOpacity
                                      onPress={(e) => {
                                        e.stopPropagation();
                                        setFilterModalColumn(col.key);
                                      }}
                                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                    >
                                      <Feather
                                        name="filter"
                                        size={12}
                                        color={isFiltered ? "#FFD700" : "#FFF"}
                                      />
                                    </TouchableOpacity>
                                  </View>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                          {/* Rows */}
                          {visibleRows.map((row, i) => (
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
                      <Feather name="layers" size={24} color={primaryColor} />
                    </View>
                    <Text style={[styles.cardValue, { fontSize: cardValueFontSize }]} adjustsFontSizeToFit numberOfLines={1}>{lotesAtivos}</Text>
                    <Text style={styles.cardLabel} numberOfLines={2}>Lotes Ativos</Text>
                  </View>

                  <View style={[styles.card, styles.cardGreen, { flexBasis: cardBasis }]}>
                    <View style={styles.cardIcon}>
                      <Feather name="bar-chart-2" size={24} color="#2E7D32" />
                    </View>
                    <Text style={[styles.cardValue, { fontSize: cardValueFontSize }]} adjustsFontSizeToFit numberOfLines={1}>{totalAnimais}</Text>
                    <Text style={styles.cardLabel} numberOfLines={2}>Total de Animais</Text>
                  </View>

                  <View style={[styles.card, styles.cardTeal, { flexBasis: cardBasis }]}>
                    <View style={styles.cardIcon}>
                      <Feather name="log-in" size={24} color="#00796B" />
                    </View>
                    <Text style={[styles.cardValue, { fontSize: cardValueFontSize }]} adjustsFontSizeToFit numberOfLines={1}>{totalEntradas}</Text>
                    <Text style={styles.cardLabel} numberOfLines={2}>Entradas</Text>
                  </View>

                  <View style={[styles.card, styles.cardOrange, { flexBasis: cardBasis }]}>
                    <View style={styles.cardIcon}>
                      <Feather name="dollar-sign" size={24} color="#E65100" />
                    </View>
                    <Text style={[styles.cardValue, { fontSize: cardValueFontSize }]} adjustsFontSizeToFit numberOfLines={1}>{totalVendas}</Text>
                    <Text style={styles.cardLabel} numberOfLines={2}>Vendas</Text>
                  </View>

                  <View style={[styles.card, styles.cardRed, { flexBasis: cardBasis }]}>
                    <View style={styles.cardIcon}>
                      <Feather name="alert-triangle" size={24} color="#C62828" />
                    </View>
                    <Text style={[styles.cardValue, { fontSize: cardValueFontSize }]} adjustsFontSizeToFit numberOfLines={1}>{totalMortes}</Text>
                    <Text style={styles.cardLabel} numberOfLines={2}>Mortes</Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      {filterModalCol && (
        <ColumnFilterModal
          columnLabel={filterModalCol.label}
          values={filterModalValues}
          selectedValues={filterModalSelected}
          onToggleValue={(value) => handleToggleFilterValue(filterModalCol.key, value, filterModalValues)}
          onClose={() => setFilterModalColumn(null)}
        />
      )}
      </>
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
  },
  tableHeaderCell: {
    paddingHorizontal: 6,
    paddingVertical: 10,
    justifyContent: "center",
  },
  tableHeaderCellTouchable: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
  },
  tableHeaderIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
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
  filterModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  filterModalSheet: {
    backgroundColor: "#FDFDFD",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "70%",
    paddingBottom: 24,
    width: "100%",
    maxWidth: 560,
  },
  filterModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 12,
  },
  filterModalHeaderTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  filterModalSearchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 24,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#DCDCDC",
    borderRadius: 8,
    height: 40,
    paddingHorizontal: 10,
  },
  filterModalSearchIcon: {
    marginRight: 8,
  },
  filterModalSearchInput: {
    flex: 1,
    fontSize: 15,
    color: "#1a1a1a",
  },
  filterModalOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ECECEC",
    gap: 12,
  },
  filterModalCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#DCDCDC",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF",
  },
  filterModalOptionText: {
    fontSize: 16,
    color: "#1a1a1a",
  },
  filterModalConfirmButton: {
    marginHorizontal: 24,
    marginTop: 12,
    height: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  filterModalConfirmButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
  filterModalEmptyText: {
    textAlign: "center",
    padding: 24,
    fontSize: 15,
    color: "#999",
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
    minWidth: 120,
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
