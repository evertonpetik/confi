import { DatePickerInput } from "@/components/DatePickerInput";
import { Input } from "@/components/Input";
import { ConferenciaMS, Insumo } from "@/components/InsumoCard";
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

type ConferenciaMSModalProps = {
  visible: boolean;
  insumo: Insumo | null;
  onAddConferencia: (
    insumoId: string,
    conferencia: Omit<ConferenciaMS, "id">
  ) => void;
  onDeleteConferencia: (insumoId: string, conferenciaId: string) => void;
  onClose: () => void;
};

type ConferenciaForm = {
  data: Date;
  percentualMS: string;
};

function getEmptyForm(): ConferenciaForm {
  return { data: new Date(), percentualMS: "" };
}

function dateToISO(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function ConferenciaMSModal({
  visible,
  insumo,
  onAddConferencia,
  onDeleteConferencia,
  onClose,
}: ConferenciaMSModalProps) {
  const [form, setForm] = useState<ConferenciaForm>(getEmptyForm);

  if (!insumo) return null;

  const conferenciasOrdenadas = [...insumo.conferencias].sort((a, b) =>
    b.data.localeCompare(a.data)
  );

  function handleAdd() {
    if (!form.percentualMS) {
      Alert.alert("Atenção", "Preencha todos os campos.");
      return;
    }
    const pms = parseFloat(form.percentualMS.replace(",", "."));
    if (isNaN(pms) || pms < 0 || pms > 100) {
      Alert.alert(
        "Atenção",
        "Percentual de MS deve ser um número entre 0 e 100."
      );
      return;
    }
    onAddConferencia(insumo.id, {
      data: dateToISO(form.data),
      percentualMS: pms,
    });
    setForm(getEmptyForm());
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
                Conferências MS - {insumo.nome}
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
                  <Text style={styles.statLabel}>MS Atual</Text>
                  <Text style={styles.statValue}>
                    {insumo.percentualMateriaSeca}%
                  </Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Conferências</Text>
                  <Text style={styles.statValue}>
                    {insumo.conferencias.length}
                  </Text>
                </View>
              </View>

              {/* Lista de conferências */}
              {conferenciasOrdenadas.length > 0 && (
                <View style={styles.confList}>
                  {conferenciasOrdenadas.map((c) => {
                    const dataParts = c.data.split("-");
                    const dataFormatada =
                      dataParts.length === 3
                        ? `${dataParts[2]}/${dataParts[1]}/${dataParts[0]}`
                        : c.data;
                    return (
                      <View key={c.id} style={styles.confItem}>
                        <View style={styles.confItemContent}>
                          <Text style={styles.confItemDate}>
                            {dataFormatada}
                          </Text>
                          <Text style={styles.confItemDetails}>
                            MS: {c.percentualMS}%
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.confDeleteBtn}
                          activeOpacity={0.7}
                          onPress={() =>
                            onDeleteConferencia(insumo.id, c.id)
                          }
                        >
                          <Feather name="trash-2" size={16} color="#E53935" />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Formulário nova conferência */}
              <Text style={styles.formTitle}>Nova Conferência</Text>

              <View style={styles.form}>
                <Text style={styles.label}>Data</Text>
                <DatePickerInput
                  value={form.data}
                  onChange={(date) =>
                    setForm((p) => ({ ...p, data: date || new Date() }))
                  }
                />

                <Text style={styles.label}>Percentual de MS (%)</Text>
                <Input
                  placeholder="Ex: 33.5"
                  value={form.percentualMS}
                  onChangeText={(v) =>
                    setForm((p) => ({ ...p, percentualMS: v }))
                  }
                  keyboardType="decimal-pad"
                />

                <View style={styles.buttonWrapper}>
                  <TouchableOpacity
                    style={styles.addButton}
                    activeOpacity={0.8}
                    onPress={handleAdd}
                  >
                    <Feather name="plus" size={18} color="#FFF" />
                    <Text style={styles.addButtonLabel}>
                      Adicionar Conferência
                    </Text>
                  </TouchableOpacity>
                </View>
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
  confList: {
    gap: 8,
    marginBottom: 16,
  },
  confItem: {
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  confItemContent: {
    flex: 1,
  },
  confItemDate: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  confItemDetails: {
    fontSize: 13,
    color: "#888",
    marginTop: 2,
  },
  confDeleteBtn: {
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
  buttonWrapper: {
    marginTop: 16,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E65100",
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
