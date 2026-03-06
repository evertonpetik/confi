import { Feather } from "@expo/vector-icons";
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export type LancamentoFinanceiro = {
  data: string;
  kgMS: number;
  custoTotal: number;
};

type FaturamentoModalProps = {
  visible: boolean;
  loteNumero: number;
  lancamentos: LancamentoFinanceiro[];
  onClose: () => void;
};

export function FaturamentoModal({
  visible,
  loteNumero,
  lancamentos,
  onClose,
}: FaturamentoModalProps) {
  const sorted = [...lancamentos].sort((a, b) => b.data.localeCompare(a.data));

  const totalGeral = sorted.reduce((acc, l) => acc + l.custoTotal, 0);

  function formatDate(iso: string): string {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }

  function formatCurrency(value: number): string {
    return `R$ ${value.toFixed(2).replace(".", ",")}`;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>
              Faturamento - Lote {loteNumero}
            </Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <Feather name="x" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Total */}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Custo Acumulado</Text>
            <Text style={styles.totalValue}>{formatCurrency(totalGeral)}</Text>
          </View>

          {/* Table header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, { flex: 1 }]}>Data</Text>
            <Text style={[styles.tableHeaderText, { flex: 1, textAlign: "right" }]}>
              Kg MS
            </Text>
            <Text style={[styles.tableHeaderText, { flex: 1, textAlign: "right" }]}>
              Custo Dia
            </Text>
          </View>

          <ScrollView
            style={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {sorted.length === 0 ? (
              <Text style={styles.emptyText}>
                Nenhum lancamento encontrado.
              </Text>
            ) : (
              sorted.map((item, idx) => (
                <View key={`${item.data}_${idx}`} style={styles.tableRow}>
                  <Text style={[styles.cellText, { flex: 1 }]}>
                    {formatDate(item.data)}
                  </Text>
                  <Text style={[styles.cellValue, { flex: 1, textAlign: "right" }]}>
                    {Math.round(item.kgMS)} kg
                  </Text>
                  <Text style={[styles.cellCusto, { flex: 1, textAlign: "right" }]}>
                    {formatCurrency(item.custoTotal)}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  card: {
    backgroundColor: "#FDFDFD",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 24,
    maxHeight: "80%",
    width: "100%",
    maxWidth: 560,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFF3E0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#E65100",
  },
  totalValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#E65100",
  },
  tableHeader: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#ECECEC",
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#999",
  },
  scrollContent: {
    flexGrow: 0,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ECECEC",
  },
  cellText: {
    fontSize: 14,
    color: "#1a1a1a",
  },
  cellValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  cellCusto: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FF9800",
  },
  emptyText: {
    textAlign: "center",
    marginTop: 24,
    fontSize: 14,
    color: "#999",
  },
});
