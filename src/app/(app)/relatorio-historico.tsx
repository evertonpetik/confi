import { DrawerSceneWrapper } from "@/components/drawe-scene-wrapper";
import { DrawerToggleButton } from "@/components/DrawerToggleButton";
import { Select } from "@/components/Select";
import { useTheme } from "@/contexts/ThemeContext";
import { useResponsive } from "@/hooks/useResponsive";
import {
  buscarRelatorioHistoricoLotes,
  HistoricoLoteRow,
} from "@/services/relatorioHistoricoLotes";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type ColumnKey = keyof HistoricoLoteRow;

type Column = {
  key: ColumnKey;
  label: string;
  width: number;
  format: (row: HistoricoLoteRow) => string;
};

function formatDataBr(data: string): string {
  const [y, m, d] = data.split("-");
  return y && m && d ? `${d}/${m}/${y}` : data;
}

function formatNumber(value: number, decimals: number): string {
  return value > 0 ? value.toFixed(decimals).replace(".", ",") : "-";
}

function formatCurrency(value: number): string {
  return value > 0 ? `R$ ${value.toFixed(2).replace(".", ",")}` : "-";
}

const COLUMNS: Column[] = [
  { key: "loteNumero", label: "Lote", width: 70, format: (r) => `${r.loteNumero}` },
  { key: "data", label: "Data", width: 90, format: (r) => formatDataBr(r.data) },
  { key: "quantidade", label: "Quantidade", width: 85, format: (r) => `${r.quantidade}` },
  { key: "dieta", label: "Dieta", width: 110, format: (r) => r.dieta },
  { key: "cmsPctPV", label: "CMS % PV", width: 80, format: (r) => r.cmsPctPV > 0 ? `${r.cmsPctPV.toFixed(2).replace(".", ",")}%` : "-" },
  { key: "gmdCalculado", label: "GMD Calculado", width: 95, format: (r) => formatNumber(r.gmdCalculado, 3) },
  { key: "consumoMS", label: "Consumo MS", width: 90, format: (r) => formatNumber(r.consumoMS, 2) },
  { key: "consumoPrevistoMO", label: "Consumo Previsto Ração KG MO", width: 150, format: (r) => formatNumber(r.consumoPrevistoMO, 2) },
  { key: "consumoRealizadoMO", label: "Consumo Realizado Ração KG MO", width: 155, format: (r) => formatNumber(r.consumoRealizadoMO, 2) },
  { key: "faturamento", label: "Faturamento", width: 95, format: (r) => formatCurrency(r.faturamento) },
  { key: "evolucaoPeso", label: "Evolução de Peso", width: 110, format: (r) => formatNumber(r.evolucaoPeso, 2) },
];

export default function RelatorioHistorico() {
  const { primaryColor } = useTheme();
  const { isDesktop, containerPadding, titleFontSize, headerPaddingTop } = useResponsive();

  const [rows, setRows] = useState<HistoricoLoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loteFiltro, setLoteFiltro] = useState("");
  const [sortKey, setSortKey] = useState<ColumnKey>("data");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  async function fetchData() {
    try {
      setLoading(true);
      const data = await buscarRelatorioHistoricoLotes();
      setRows(data);
    } catch (error) {
      console.error("Erro ao buscar relatorio historico:", error);
    } finally {
      setLoading(false);
    }
  }

  const loteOptions = useMemo(() => {
    const numeros = Array.from(new Set(rows.map((r) => r.loteNumero))).sort((a, b) => a - b);
    return [
      { label: "Todos os lotes", value: "" },
      ...numeros.map((n) => ({ label: `Lote ${n}`, value: `${n}` })),
    ];
  }, [rows]);

  function handleSortPress(key: ColumnKey) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const visibleRows = useMemo(() => {
    let filtered = rows;
    if (loteFiltro) {
      filtered = filtered.filter((r) => `${r.loteNumero}` === loteFiltro);
    }
    const sorted = [...filtered].sort((a, b) => {
      const valueA = a[sortKey];
      const valueB = b[sortKey];
      let comparison = 0;
      if (typeof valueA === "number" && typeof valueB === "number") {
        comparison = valueA - valueB;
      } else {
        comparison = String(valueA).localeCompare(String(valueB));
      }
      if (comparison === 0) comparison = a.loteNumero - b.loteNumero;
      return sortDir === "asc" ? comparison : -comparison;
    });
    return sorted;
  }, [rows, loteFiltro, sortKey, sortDir]);

  const tableWidth = COLUMNS.reduce((acc, c) => acc + c.width, 0);

  function renderHeader() {
    return (
      <View style={[styles.tableHeaderRow, { backgroundColor: primaryColor, width: tableWidth }]}>
        {COLUMNS.map((col) => {
          const isSorted = sortKey === col.key;
          return (
            <TouchableOpacity
              key={col.key}
              style={[styles.tableHeaderCell, { width: col.width }]}
              onPress={() => handleSortPress(col.key)}
              activeOpacity={0.7}
            >
              <Text style={styles.tableHeaderText} numberOfLines={2}>{col.label}</Text>
              {isSorted && (
                <Feather
                  name={sortDir === "asc" ? "chevron-up" : "chevron-down"}
                  size={12}
                  color="#FFF"
                />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  function renderRow({ item, index }: { item: HistoricoLoteRow; index: number }) {
    return (
      <View
        style={[
          styles.tableDataRow,
          { width: tableWidth },
          index % 2 === 1 && styles.tableDataRowAlt,
        ]}
      >
        {COLUMNS.map((col) => (
          <View key={col.key} style={[styles.tableDataCell, { width: col.width }]}>
            <Text style={styles.tableDataText} numberOfLines={1}>
              {col.format(item)}
            </Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <DrawerSceneWrapper>
      <View style={[styles.container, { padding: containerPadding }]}>
        <View style={[styles.header, { paddingTop: headerPaddingTop }]}>
          <Text style={[styles.title, { fontSize: titleFontSize, flex: 1 }]} numberOfLines={1}>
            Relatório Histórico
          </Text>
          {!isDesktop && <DrawerToggleButton tintColor="#000000" />}
        </View>
        <Text style={styles.subtitle}>
          Consumo, custo e evolução de peso de todos os lotes, dia a dia.
        </Text>

        <View style={{ marginTop: 16, maxWidth: 280 }}>
          <Select
            placeholder="Filtrar por lote"
            value={loteFiltro}
            options={loteOptions}
            onSelect={setLoteFiltro}
          />
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={primaryColor} style={{ marginTop: 32 }} />
        ) : visibleRows.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="alert-circle" size={48} color="#DCDCDC" />
            <Text style={styles.emptyStateText}>Sem dados de histórico.</Text>
            <Text style={styles.emptyStateSubtext}>
              Execute o mapa de trato para gerar dados de consumo e custos.
            </Text>
          </View>
        ) : (
          <View style={[styles.tableContainer, { marginTop: 16 }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View>
                {renderHeader()}
                <FlatList
                  data={visibleRows}
                  keyExtractor={(item, idx) => `${item.loteId}_${item.data}_${idx}`}
                  renderItem={renderRow}
                  style={{ maxHeight: 560 }}
                />
              </View>
            </ScrollView>
          </View>
        )}
      </View>
    </DrawerSceneWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FDFDFD",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
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
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  tableHeaderText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFF",
    flexShrink: 1,
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
