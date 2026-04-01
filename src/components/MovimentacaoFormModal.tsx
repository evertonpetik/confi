import { DatePickerInput } from "@/components/DatePickerInput";
import { Input } from "@/components/Input";
import {
  calcularPesoMedio,
  calcularQuantidadeAtual,
  Lote,
  Movimentacao,
} from "@/components/LoteCard";
import { Select, SelectOption } from "@/components/Select";
import { Feather } from "@expo/vector-icons";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type MovimentacaoFormModalProps = {
  visible: boolean;
  lote: Lote | null;
  movimentacaoOptions: { descricao: string; tipo: string }[];
  onAddMovimentacao: (loteId: string, mov: Omit<Movimentacao, "id">) => void;
  onDeleteMovimentacao: (loteId: string, movId: string) => void;
  onClose: () => void;
};

type MovForm = {
  evento: "Entrada" | "Saida";
  movimentacao: string;
  data: Date;
  quantidade: string;
  pesoMedio: string;
  observacao: string;
};

function getEmptyMovForm(): MovForm {
  return {
    evento: "Entrada",
    movimentacao: "",
    data: new Date(),
    quantidade: "",
    pesoMedio: "",
    observacao: "",
  };
}

function dateToISO(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function MovimentacaoFormModal({
  visible,
  lote,
  movimentacaoOptions,
  onAddMovimentacao,
  onDeleteMovimentacao,
  onClose,
}: MovimentacaoFormModalProps) {
  const [movForm, setMovForm] = useState<MovForm>(getEmptyMovForm);

  if (!lote) return null;

  const qtdAtual = calcularQuantidadeAtual(lote.movimentacoes);
  const pesoMedioAtual = calcularPesoMedio(lote.movimentacoes, lote.gmdEstimado);

  const movimentacaoFilteredOptions: SelectOption[] = movimentacaoOptions
    .filter((m) => m.tipo === movForm.evento)
    .map((m) => ({ label: m.descricao, value: m.descricao }));

  function handleAdd() {
    if (
      !movForm.movimentacao ||
      !movForm.quantidade ||
      !movForm.pesoMedio
    ) {
      Alert.alert("Atenção", "Preencha todos os campos da movimentação.");
      return;
    }
    const qtd = parseInt(movForm.quantidade, 10);
    const peso = parseFloat(movForm.pesoMedio.replace(",", "."));
    if (isNaN(qtd) || qtd <= 0) {
      Alert.alert("Atenção", "Quantidade deve ser um número inteiro positivo.");
      return;
    }
    if (isNaN(peso) || peso <= 0) {
      Alert.alert("Atenção", "Peso médio deve ser um número positivo.");
      return;
    }
    onAddMovimentacao(lote.id, {
      evento: movForm.evento,
      movimentacao: movForm.movimentacao,
      data: dateToISO(movForm.data),
      quantidade: qtd,
      pesoMedio: peso,
      observacao: movForm.observacao,
    });
    setMovForm(getEmptyMovForm());
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.keyboardView}>
          <View style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.title}>
                Movimentações - Lote {lote.numero}
              </Text>
              <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
                <Feather name="x" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Resumo */}
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Qtd. Atual</Text>
                  <Text style={styles.statValue}>{qtdAtual}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>KG Previsto Hoje</Text>
                  <Text style={styles.statValue}>
                    {pesoMedioAtual > 0
                      ? `${pesoMedioAtual.toFixed(1)} kg`
                      : "-"}
                  </Text>
                </View>
              </View>

              {/* Lista de movimentacoes */}
              {lote.movimentacoes.length > 0 && (
                <View style={styles.movList}>
                  {lote.movimentacoes.map((m) => {
                    const dataParts = m.data.split("-");
                    const dataFormatada =
                      dataParts.length === 3
                        ? `${dataParts[2]}/${dataParts[1]}/${dataParts[0]}`
                        : m.data;
                    return (
                      <View key={m.id} style={styles.movItem}>
                        <View style={styles.movItemContent}>
                          <View style={styles.movItemHeader}>
                            <View
                              style={[
                                styles.movBadge,
                                m.evento === "Entrada"
                                  ? styles.movBadgeEntrada
                                  : styles.movBadgeSaida,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.movBadgeText,
                                  m.evento === "Entrada"
                                    ? styles.movBadgeTextEntrada
                                    : styles.movBadgeTextSaida,
                                ]}
                              >
                                {m.evento}
                              </Text>
                            </View>
                            <Text style={styles.movItemDesc}>
                              {m.movimentacao}
                            </Text>
                          </View>
                          <Text style={styles.movItemDetails}>
                            {dataFormatada} | {m.quantidade} cab. |{" "}
                            {m.pesoMedio} kg
                          </Text>
                          {!!m.observacao && (
                            <Text style={styles.movItemObs}>
                              {m.observacao}
                            </Text>
                          )}
                        </View>
                        <TouchableOpacity
                          style={styles.movDeleteBtn}
                          activeOpacity={0.7}
                          onPress={() =>
                            onDeleteMovimentacao(lote.id, m.id)
                          }
                        >
                          <Feather
                            name="trash-2"
                            size={16}
                            color="#E53935"
                          />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Formulario nova movimentacao */}
              <Text style={styles.formTitle}>Nova Movimentação</Text>

              <View style={styles.form}>
                <Text style={styles.label}>Evento</Text>
                <View style={styles.toggleRow}>
                  <TouchableOpacity
                    style={[
                      styles.toggleButton,
                      movForm.evento === "Entrada" && styles.toggleActive,
                    ]}
                    activeOpacity={0.8}
                    onPress={() =>
                      setMovForm((p) => ({
                        ...p,
                        evento: "Entrada",
                        movimentacao: "",
                      }))
                    }
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        movForm.evento === "Entrada" &&
                        styles.toggleTextActive,
                      ]}
                    >
                      Entrada
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.toggleButton,
                      movForm.evento === "Saida" && styles.toggleInactive,
                    ]}
                    activeOpacity={0.8}
                    onPress={() =>
                      setMovForm((p) => ({
                        ...p,
                        evento: "Saida",
                        movimentacao: "",
                      }))
                    }
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        movForm.evento === "Saida" &&
                        styles.toggleTextInactive,
                      ]}
                    >
                      Saída
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.label}>Movimentação</Text>
                <Select
                  placeholder="Selecione a movimentação"
                  value={movForm.movimentacao}
                  options={movimentacaoFilteredOptions}
                  onSelect={(v) =>
                    setMovForm((p) => ({ ...p, movimentacao: v }))
                  }
                />

                <Text style={styles.label}>Data</Text>
                <DatePickerInput
                  value={movForm.data}
                  onChange={(date) =>
                    setMovForm((p) => ({ ...p, data: date || new Date() }))
                  }
                />

                <Text style={styles.label}>Quantidade de Animais</Text>
                <Input
                  placeholder="Ex: 50"
                  value={movForm.quantidade}
                  onChangeText={(v) =>
                    setMovForm((p) => ({ ...p, quantidade: v }))
                  }
                  keyboardType="numeric"
                />

                <Text style={styles.label}>Peso Médio (kg)</Text>
                <Input
                  placeholder="Ex: 350"
                  value={movForm.pesoMedio}
                  onChangeText={(v) =>
                    setMovForm((p) => ({ ...p, pesoMedio: v }))
                  }
                  keyboardType="decimal-pad"
                />

                <Text style={styles.label}>Observação</Text>
                <Input
                  placeholder="Observação (opcional)"
                  value={movForm.observacao}
                  onChangeText={(v) =>
                    setMovForm((p) => ({ ...p, observacao: v }))
                  }
                />

                <View style={styles.buttonWrapper}>
                  <TouchableOpacity
                    style={styles.addButton}
                    activeOpacity={0.8}
                    onPress={handleAdd}
                  >
                    <Feather name="plus" size={18} color="#FFF" />
                    <Text style={styles.addButtonLabel}>
                      Adicionar Movimentação
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
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
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1a1a1a",
    flex: 1,
  },
  scrollContent: {
    flexGrow: 0,
  },
  statsRow: {
    flexDirection: "row",
    gap: 24,
    marginBottom: 16,
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    padding: 12,
  },
  stat: {
    alignItems: "center",
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: "#999",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  movList: {
    gap: 8,
    marginBottom: 16,
  },
  movItem: {
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  movItemContent: {
    flex: 1,
  },
  movItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  movBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  movBadgeEntrada: {
    backgroundColor: "#E8F5E9",
  },
  movBadgeSaida: {
    backgroundColor: "#FFEBEE",
  },
  movBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  movBadgeTextEntrada: {
    color: "#2E7D32",
  },
  movBadgeTextSaida: {
    color: "#C62828",
  },
  movItemDesc: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  movItemDetails: {
    fontSize: 13,
    color: "#888",
  },
  movItemObs: {
    fontSize: 12,
    color: "#999",
    fontStyle: "italic",
    marginTop: 2,
  },
  movDeleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
  },
  formTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 8,
  },
  form: {
    gap: 6,
    paddingBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#444",
    marginTop: 6,
  },
  toggleRow: {
    flexDirection: "row",
    gap: 8,
  },
  toggleButton: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#DCDCDC",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF",
  },
  toggleActive: {
    backgroundColor: "#3366FF",
    borderColor: "#3366FF",
  },
  toggleInactive: {
    backgroundColor: "#E53935",
    borderColor: "#E53935",
  },
  toggleText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  toggleTextActive: {
    color: "#FFF",
  },
  toggleTextInactive: {
    color: "#FFF",
  },
  buttonWrapper: {
    marginTop: 16,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2E7D32",
    borderRadius: 8,
    height: 48,
    gap: 8,
  },
  addButtonLabel: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
