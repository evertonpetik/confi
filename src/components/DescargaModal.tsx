import { Button } from "@/components/Button";
import { Feather } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
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

export type DescargaItem = {
  piqueteId: string;
  piqueteNome: string;
  loteNumero: number;
  previsto: number;
  realizado: number;
};

export type DescargaTrato = {
  tratoNumero: number;
  itens: DescargaItem[];
};

type DescargaPrevistoItem = {
  piqueteId: string;
  piqueteNome: string;
  loteNumero: number;
  previsto: number;
};

type DescargaModalProps = {
  visible: boolean;
  roteiroNumero: number;
  numTratos: number;
  descargaPrevistos: DescargaPrevistoItem[];
  descargas: DescargaTrato[];
  percentualMSFinal: number;
  onSave: (descargas: DescargaTrato[]) => void;
  onClose: () => void;
};

export function DescargaModal({
  visible,
  roteiroNumero,
  numTratos,
  descargaPrevistos,
  descargas,
  percentualMSFinal,
  onSave,
  onClose,
}: DescargaModalProps) {
  const [tratoAtual, setTratoAtual] = useState(1);
  const [localDescargas, setLocalDescargas] = useState<DescargaTrato[]>([]);

  useEffect(() => {
    if (visible) {
      setTratoAtual(1);
      if (descargas.length > 0) {
        setLocalDescargas(descargas);
      } else {
        const empty: DescargaTrato[] = [];
        for (let i = 1; i <= numTratos; i++) {
          empty.push({
            tratoNumero: i,
            itens: descargaPrevistos.map((d) => ({
              piqueteId: d.piqueteId,
              piqueteNome: d.piqueteNome,
              loteNumero: d.loteNumero,
              previsto: d.previsto,
              realizado: 0,
            })),
          });
        }
        setLocalDescargas(empty);
      }
    }
  }, [visible]);

  const descargaAtual = localDescargas.find(
    (d) => d.tratoNumero === tratoAtual
  );

  function updateRealizado(piqueteId: string, value: string) {
    setLocalDescargas((prev) =>
      prev.map((d) =>
        d.tratoNumero === tratoAtual
          ? {
            ...d,
            itens: d.itens.map((it) =>
              it.piqueteId === piqueteId
                ? { ...it, realizado: parseFloat(value) || 0 }
                : it
            ),
          }
          : d
      )
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.select({ ios: "padding", android: undefined })}
        >
          <View style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.title}>
                Descarga - Roteiro {roteiroNumero}
              </Text>
              <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
                <Feather name="x" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Tabs de tratos */}
            {numTratos > 1 && (
              <View style={styles.tabsRow}>
                {Array.from({ length: numTratos }, (_, i) => i + 1).map(
                  (num) => (
                    <TouchableOpacity
                      key={num}
                      style={[
                        styles.tab,
                        tratoAtual === num && styles.tabActive,
                      ]}
                      activeOpacity={0.8}
                      onPress={() => setTratoAtual(num)}
                    >
                      <Text
                        style={[
                          styles.tabText,
                          tratoAtual === num && styles.tabTextActive,
                        ]}
                      >
                        Trato {num}
                      </Text>
                    </TouchableOpacity>
                  )
                )}
              </View>
            )}

            <ScrollView
              style={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Cabeçalho tabela */}
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderText, { flex: 2 }]}>
                  Piquete / Lote
                </Text>
                <Text style={[styles.tableHeaderText, { flex: 1 }]}>
                  Previsto
                </Text>
                <Text style={[styles.tableHeaderText, { flex: 1 }]}>
                  Realizado
                </Text>
                {percentualMSFinal > 0 && (
                  <Text style={[styles.tableHeaderText, { flex: 1 }]}>
                    MS (kg)
                  </Text>
                )}
              </View>

              {descargaAtual?.itens.map((item) => (
                <View key={item.piqueteId} style={styles.tableRow}>
                  <View style={{ flex: 2 }}>
                    <Text style={styles.cellText}>{item.piqueteNome}</Text>
                    <Text style={styles.cellSubText}>
                      Lote {item.loteNumero}
                    </Text>
                  </View>
                  <Text style={[styles.cellPrevisto, { flex: 1 }]}>
                    {Math.round(item.previsto)} kg
                  </Text>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      style={styles.cellInput}
                      value={
                        item.realizado > 0 ? item.realizado.toString() : ""
                      }
                      onChangeText={(v) => updateRealizado(item.piqueteId, v)}
                      keyboardType="numeric"
                      placeholder="0"
                    />
                  </View>
                  {percentualMSFinal > 0 && (
                    <Text style={[styles.cellMS, { flex: 1 }]}>
                      {item.realizado > 0 ? (item.realizado * (percentualMSFinal / 100)).toFixed(1) : "-"}
                    </Text>
                  )}
                </View>
              ))}

              {/* MS Info */}
              {percentualMSFinal > 0 && (
                <View style={styles.msRow}>
                  <Text style={styles.msLabel}>% MS do Trato</Text>
                  <Text style={styles.msValue}>{percentualMSFinal.toFixed(2)}%</Text>
                </View>
              )}

              <View style={styles.buttonWrapper}>
                <Button
                  label="Salvar Descarga"
                  onPress={() => onSave(localDescargas)}
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
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
  keyboardView: {
    maxHeight: "90%",
    width: "100%",
    maxWidth: 560,
  },
  card: {
    backgroundColor: "#FDFDFD",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 24,
    maxHeight: "100%",
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
  tabsRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#DCDCDC",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF",
  },
  tabActive: {
    backgroundColor: "#3366FF",
    borderColor: "#3366FF",
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
  },
  tabTextActive: {
    color: "#FFF",
  },
  scrollContent: {
    flexGrow: 0,
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
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ECECEC",
  },
  cellText: {
    fontSize: 14,
    color: "#1a1a1a",
    fontWeight: "600",
  },
  cellSubText: {
    fontSize: 12,
    color: "#888",
  },
  cellPrevisto: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3366FF",
  },
  cellInput: {
    height: 38,
    borderWidth: 1,
    borderColor: "#DCDCDC",
    borderRadius: 6,
    paddingHorizontal: 8,
    fontSize: 14,
    backgroundColor: "#FFF",
  },
  cellMS: {
    fontSize: 13,
    fontWeight: "600",
    color: "#2E7D32",
    textAlign: "center",
  },
  msRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
  },
  msLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2E7D32",
  },
  msValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1B5E20",
  },
  buttonWrapper: {
    marginTop: 16,
    paddingBottom: 8,
  },
});
