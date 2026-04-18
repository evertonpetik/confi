import { Button } from "@/components/Button";
import { useTheme } from "@/contexts/ThemeContext";
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

type InsumoPrevistoItem = {
  insumoId: string;
  insumoNome: string;
  previsto: number;
  percentualMS: number;
};

export type CargaTrato = {
  tratoNumero: number;
  insumos: { insumoId: string; insumoNome: string; previsto: number; realizado: number; percentualMS: number }[];
  aguaPrevista: number;
  aguaRealizada: number;
};

type CargaModalProps = {
  visible: boolean;
  roteiroNumero: number;
  numTratos: number;
  insumosPrevistos: InsumoPrevistoItem[];
  aguaPrevista: number;
  cargas: CargaTrato[];
  onSave: (cargas: CargaTrato[]) => void;
  onClose: () => void;
};

export function CargaModal({
  visible,
  roteiroNumero,
  numTratos,
  insumosPrevistos,
  aguaPrevista,
  cargas,
  onSave,
  onClose,
}: CargaModalProps) {
  const [tratoAtual, setTratoAtual] = useState(1);
  const [localCargas, setLocalCargas] = useState<CargaTrato[]>([]);
  const { primaryColor } = useTheme();

  useEffect(() => {
    if (visible) {
      setTratoAtual(1);
      if (cargas.length > 0) {
        setLocalCargas(cargas.map((c) => ({
          ...c,
          insumos: c.insumos.map((ins) => {
            const ip = insumosPrevistos.find((p) => p.insumoId === ins.insumoId);
            return { ...ins, insumoNome: ip?.insumoNome ?? ins.insumoNome, previsto: ip?.previsto ?? ins.previsto, percentualMS: ip?.percentualMS ?? ins.percentualMS ?? 100 };
          }),
        })));
      } else {
        const empty: CargaTrato[] = [];
        for (let i = 1; i <= numTratos; i++) {
          empty.push({
            tratoNumero: i,
            insumos: insumosPrevistos.map((ins) => ({
              insumoId: ins.insumoId,
              insumoNome: ins.insumoNome,
              previsto: ins.previsto,
              realizado: 0,
              percentualMS: ins.percentualMS,
            })),
            aguaPrevista,
            aguaRealizada: 0,
          });
        }
        setLocalCargas(empty);
      }
    }
  }, [visible]);

  const cargaAtual = localCargas.find((c) => c.tratoNumero === tratoAtual);

  // Calculate % MS final across ALL tratos
  const msTotal = localCargas.reduce((acc, c) => {
    return acc + c.insumos.reduce((sum, ins) => sum + ins.realizado * (ins.percentualMS / 100), 0);
  }, 0);
  const moTotal = localCargas.reduce((acc, c) => {
    return acc + c.insumos.reduce((sum, ins) => sum + ins.realizado, 0) + c.aguaRealizada;
  }, 0);
  const percentualMSFinal = moTotal > 0 ? (msTotal / moTotal) * 100 : 0;

  function updateInsumoRealizado(insumoId: string, value: string) {
    setLocalCargas((prev) =>
      prev.map((c) =>
        c.tratoNumero === tratoAtual
          ? {
            ...c,
            insumos: c.insumos.map((ins) =>
              ins.insumoId === insumoId
                ? { ...ins, realizado: parseFloat(value) || 0 }
                : ins
            ),
          }
          : c
      )
    );
  }

  function updateAguaRealizada(value: string) {
    setLocalCargas((prev) =>
      prev.map((c) =>
        c.tratoNumero === tratoAtual
          ? { ...c, aguaRealizada: parseFloat(value) || 0 }
          : c
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
                Carga - Roteiro {roteiroNumero}
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
                        tratoAtual === num && [styles.tabActive, { backgroundColor: primaryColor, borderColor: primaryColor }],
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
                  Insumo
                </Text>
                <Text style={[styles.tableHeaderText, { flex: 1 }]}>
                  Previsto
                </Text>
                <Text style={[styles.tableHeaderText, { flex: 1 }]}>
                  Realizado
                </Text>
              </View>

              {cargaAtual?.insumos.map((ins) => (
                <View key={ins.insumoId} style={styles.tableRow}>
                  <Text style={[styles.cellText, { flex: 2 }]} numberOfLines={2}>
                    {ins.insumoNome}
                  </Text>
                  <Text style={[styles.cellPrevisto, { flex: 1, color: primaryColor }]}>
                    {Math.round(ins.previsto)} kg
                  </Text>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      style={styles.cellInput}
                      value={ins.realizado > 0 ? ins.realizado.toString() : ""}
                      onChangeText={(v) => updateInsumoRealizado(ins.insumoId, v)}
                      keyboardType="numeric"
                      placeholder="0"
                    />
                  </View>
                </View>
              ))}

              {/* Linha de água */}
              <View style={[styles.tableRow, styles.aguaRow]}>
                <Text style={[styles.cellText, styles.aguaText, { flex: 2 }]}>
                  Água
                </Text>
                <Text style={[styles.cellPrevisto, { flex: 1, color: primaryColor }]}>
                  {Math.round(cargaAtual?.aguaPrevista ?? 0)} kg
                </Text>
                <View style={{ flex: 1 }}>
                  <TextInput
                    style={styles.cellInput}
                    value={
                      (cargaAtual?.aguaRealizada ?? 0) > 0
                        ? cargaAtual?.aguaRealizada.toString()
                        : ""
                    }
                    onChangeText={updateAguaRealizada}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                </View>
              </View>

              <View style={styles.buttonWrapper}>
                <Button
                  label="Salvar Carga"
                  onPress={() => onSave(localCargas)}
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
  },
  cellPrevisto: {
    fontSize: 14,
    fontWeight: "600",
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
  aguaRow: {
    backgroundColor: "#E3F2FD",
    borderRadius: 8,
    paddingHorizontal: 8,
    marginTop: 4,
  },
  aguaText: {
    fontWeight: "700",
    color: "#1565C0",
  },
  buttonWrapper: {
    marginTop: 16,
    paddingBottom: 8,
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
});
