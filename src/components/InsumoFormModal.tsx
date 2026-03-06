import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Insumo } from "@/components/InsumoCard";
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

type InsumoFormModalProps = {
  visible: boolean;
  insumo?: Insumo | null;
  onSave: (data: Omit<Insumo, "id" | "compras">) => void;
  onClose: () => void;
};

type InsumoForm = {
  nome: string;
  percentualMateriaSeca: string;
  materiaSecaVariavel: boolean;
};

const emptyForm: InsumoForm = {
  nome: "",
  percentualMateriaSeca: "",
  materiaSecaVariavel: false,
};

export function InsumoFormModal({
  visible,
  insumo,
  onSave,
  onClose,
}: InsumoFormModalProps) {
  const [form, setForm] = useState<InsumoForm>(emptyForm);
  const isEditing = !!insumo;

  useEffect(() => {
    if (visible) {
      if (insumo) {
        setForm({
          nome: insumo.nome ?? "",
          percentualMateriaSeca:
            insumo.percentualMateriaSeca?.toString() ?? "",
          materiaSecaVariavel: insumo.materiaSecaVariavel ?? false,
        });
      } else {
        setForm(emptyForm);
      }
    }
  }, [visible, insumo]);

  function handleSave() {
    if (!form.nome.trim()) {
      Alert.alert("Atenção", "Preencha o nome do insumo.");
      return;
    }
    const pms = parseFloat(form.percentualMateriaSeca.replace(",", "."));
    if (isNaN(pms) || pms < 0 || pms > 100) {
      Alert.alert(
        "Atenção",
        "Percentual de matéria seca deve ser um número entre 0 e 100."
      );
      return;
    }
    onSave({
      nome: form.nome.trim(),
      percentualMateriaSeca: pms,
      materiaSecaVariavel: form.materiaSecaVariavel,
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
                {isEditing ? "Editar Insumo" : "Novo Insumo"}
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
                <Text style={styles.label}>Nome *</Text>
                <Input
                  placeholder="Nome do insumo"
                  value={form.nome}
                  onChangeText={(v) => setForm((p) => ({ ...p, nome: v }))}
                />

                <Text style={styles.label}>Percentual de Matéria Seca (%) *</Text>
                <Input
                  placeholder="Ex: 88.5"
                  value={form.percentualMateriaSeca}
                  onChangeText={(v) =>
                    setForm((p) => ({ ...p, percentualMateriaSeca: v }))
                  }
                  keyboardType="decimal-pad"
                />

                <Text style={styles.label}>Matéria Seca Variável</Text>
                <View style={styles.toggleRow}>
                  <TouchableOpacity
                    style={[
                      styles.toggleButton,
                      !form.materiaSecaVariavel && styles.toggleActive,
                    ]}
                    activeOpacity={0.8}
                    onPress={() =>
                      setForm((p) => ({ ...p, materiaSecaVariavel: false }))
                    }
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        !form.materiaSecaVariavel && styles.toggleTextActive,
                      ]}
                    >
                      Não
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.toggleButton,
                      form.materiaSecaVariavel && styles.toggleActive,
                    ]}
                    activeOpacity={0.8}
                    onPress={() =>
                      setForm((p) => ({ ...p, materiaSecaVariavel: true }))
                    }
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        form.materiaSecaVariavel && styles.toggleTextActive,
                      ]}
                    >
                      Sim
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.buttonWrapper}>
                  <Button
                    label={isEditing ? "Salvar" : "Cadastrar"}
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
  toggleText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  toggleTextActive: {
    color: "#FFF",
  },
  buttonWrapper: {
    marginTop: 16,
  },
});
