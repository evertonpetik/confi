import { Button } from "@/components/Button";
import { MultiSelect } from "@/components/MultiSelect";
import { Roteiro } from "@/components/RoteiroCard";
import { Select, SelectOption } from "@/components/Select";
import { Feather } from "@expo/vector-icons";
import { useEffect, useState } from "react";
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

type PiqueteOption = {
  label: string;
  value: string;
};

type RoteiroFormModalProps = {
  visible: boolean;
  roteiro?: Roteiro | null;
  nextNumero: number;
  dietaOptions: SelectOption[];
  getPiquetesForDieta: (dietaId: string) => PiqueteOption[];
  onSave: (data: Omit<Roteiro, "id">) => void;
  onClose: () => void;
};

type RoteiroForm = {
  dietaId: string;
  dietaNome: string;
  piqueteIds: string[];
  ativo: boolean;
};

const emptyForm: RoteiroForm = {
  dietaId: "",
  dietaNome: "",
  piqueteIds: [],
  ativo: true,
};

export function RoteiroFormModal({
  visible,
  roteiro,
  nextNumero,
  dietaOptions,
  getPiquetesForDieta,
  onSave,
  onClose,
}: RoteiroFormModalProps) {
  const [form, setForm] = useState<RoteiroForm>(emptyForm);
  const isEditing = !!roteiro;

  useEffect(() => {
    if (visible) {
      if (roteiro) {
        setForm({
          dietaId: roteiro.dietaId ?? "",
          dietaNome: roteiro.dietaNome ?? "",
          piqueteIds: roteiro.piquetes.map((p) => p.piqueteId),
          ativo: roteiro.ativo ?? true,
        });
      } else {
        setForm(emptyForm);
      }
    }
  }, [visible, roteiro]);

  const availablePiquetes = form.dietaId
    ? getPiquetesForDieta(form.dietaId)
    : [];

  function handleDietaSelect(value: string) {
    const selected = dietaOptions.find((d) => d.value === value);
    setForm((prev) => ({
      ...prev,
      dietaId: value,
      dietaNome: selected?.label ?? "",
      piqueteIds: [],
    }));
  }

  function handleSave() {
    if (!form.dietaId) {
      Alert.alert("Atenção", "Selecione uma dieta.");
      return;
    }
    if (form.piqueteIds.length === 0) {
      Alert.alert("Atenção", "Selecione pelo menos um piquete.");
      return;
    }

    const piquetes = form.piqueteIds.map((id) => {
      const opt = availablePiquetes.find((p) => p.value === id);
      return { piqueteId: id, piqueteNome: opt?.label ?? "" };
    });

    onSave({
      numero: roteiro?.numero ?? nextNumero,
      dietaId: form.dietaId,
      dietaNome: form.dietaNome,
      piquetes,
      ativo: form.ativo,
    });
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
                {isEditing
                  ? `Editar Roteiro ${roteiro.numero}`
                  : "Novo Roteiro"}
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
              <View style={styles.form}>
                {/* Numero do Roteiro */}
                <Text style={styles.label}>Nome</Text>
                <View style={styles.readonlyField}>
                  <Text style={styles.readonlyText}>
                    Roteiro {roteiro?.numero ?? nextNumero}
                  </Text>
                </View>

                {/* Dieta */}
                <Text style={styles.label}>Dieta *</Text>
                <Select
                  placeholder="Selecione a dieta"
                  value={form.dietaId}
                  options={dietaOptions}
                  onSelect={handleDietaSelect}
                />

                {/* Piquetes */}
                <Text style={styles.label}>Piquetes *</Text>
                <MultiSelect
                  placeholder="Selecione os piquetes"
                  values={form.piqueteIds}
                  options={availablePiquetes}
                  onSelect={(ids) =>
                    setForm((p) => ({ ...p, piqueteIds: ids }))
                  }
                  disabled={!form.dietaId}
                />
                {form.dietaId && availablePiquetes.length === 0 && (
                  <Text style={styles.hintText}>
                    Nenhum piquete com lote vinculado a esta dieta.
                  </Text>
                )}

                {/* Toggle Ativo */}
                <Text style={styles.label}>Status</Text>
                <View style={styles.toggleRow}>
                  <TouchableOpacity
                    style={[
                      styles.toggleButton,
                      form.ativo && styles.toggleActive,
                    ]}
                    activeOpacity={0.8}
                    onPress={() => setForm((p) => ({ ...p, ativo: true }))}
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        form.ativo && styles.toggleTextActive,
                      ]}
                    >
                      Ativo
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.toggleButton,
                      !form.ativo && styles.toggleInactive,
                    ]}
                    activeOpacity={0.8}
                    onPress={() => setForm((p) => ({ ...p, ativo: false }))}
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        !form.ativo && styles.toggleTextInactive,
                      ]}
                    >
                      Inativo
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.buttonWrapper}>
                  <Button
                    label={isEditing ? "Salvar Roteiro" : "Cadastrar Roteiro"}
                    onPress={handleSave}
                  />
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
  },
  scrollContent: {
    flexGrow: 0,
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
  readonlyField: {
    width: "100%",
    height: 48,
    borderWidth: 1,
    borderColor: "#DCDCDC",
    borderRadius: 8,
    paddingHorizontal: 12,
    justifyContent: "center",
    backgroundColor: "#F0F0F0",
  },
  readonlyText: {
    fontSize: 16,
    color: "#666",
  },
  hintText: {
    fontSize: 12,
    color: "#E53935",
    marginTop: 2,
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
});
