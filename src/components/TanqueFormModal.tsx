import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import type { Tanque } from "@/components/TanqueCard";
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

type TanqueFormModalProps = {
  visible: boolean;
  tanque?: Tanque | null;
  onSave: (data: Omit<Tanque, "id">) => void;
  onClose: () => void;
};

type TanqueForm = {
  nome: string;
  tipoCombustivel: string;
  capacidadeLitros: string;
  localizacao: "fixo" | "movel";
  nivelAtual: string;
  alertaNivelMinimo: string;
  ativo: boolean;
};

const emptyForm: TanqueForm = {
  nome: "",
  tipoCombustivel: "",
  capacidadeLitros: "",
  localizacao: "fixo",
  nivelAtual: "",
  alertaNivelMinimo: "",
  ativo: true,
};

const COMBUSTIVEL_OPTIONS = [
  { label: "Diesel", value: "Diesel" },
  { label: "Diesel S10", value: "Diesel S10" },
  { label: "Diesel S500", value: "Diesel S500" },
  { label: "Gasolina", value: "Gasolina" },
  { label: "Etanol", value: "Etanol" },
];

export function TanqueFormModal({
  visible,
  tanque,
  onSave,
  onClose,
}: TanqueFormModalProps) {
  const [form, setForm] = useState<TanqueForm>(emptyForm);
  const isEditing = !!tanque;

  useEffect(() => {
    if (visible) {
      if (tanque) {
        setForm({
          nome: tanque.nome ?? "",
          tipoCombustivel: tanque.tipoCombustivel ?? "",
          capacidadeLitros: tanque.capacidadeLitros?.toString() ?? "",
          localizacao: tanque.localizacao ?? "fixo",
          nivelAtual: tanque.nivelAtual?.toString() ?? "",
          alertaNivelMinimo: tanque.alertaNivelMinimo?.toString() ?? "",
          ativo: tanque.ativo ?? true,
        });
      } else {
        setForm(emptyForm);
      }
    }
  }, [visible, tanque]);

  function handleSave() {
    if (!form.nome.trim()) {
      Alert.alert("Atencao", "Preencha o nome do tanque.");
      return;
    }
    if (!form.tipoCombustivel) {
      Alert.alert("Atencao", "Selecione o tipo de combustivel.");
      return;
    }
    const capacidade = parseFloat(form.capacidadeLitros.replace(",", "."));
    if (isNaN(capacidade) || capacidade <= 0) {
      Alert.alert("Atencao", "Capacidade deve ser um numero positivo.");
      return;
    }
    const nivel = parseFloat(form.nivelAtual.replace(",", "."));
    if (isNaN(nivel) || nivel < 0) {
      Alert.alert("Atencao", "Nivel atual deve ser um numero valido.");
      return;
    }
    if (nivel > capacidade) {
      Alert.alert("Atencao", "Nivel atual nao pode ser maior que a capacidade.");
      return;
    }
    const alerta = parseFloat(form.alertaNivelMinimo.replace(",", "."));
    if (isNaN(alerta) || alerta < 0) {
      Alert.alert("Atencao", "Alerta de nivel minimo deve ser um numero valido.");
      return;
    }

    onSave({
      nome: form.nome.trim(),
      tipoCombustivel: form.tipoCombustivel,
      capacidadeLitros: capacidade,
      localizacao: form.localizacao,
      nivelAtual: nivel,
      alertaNivelMinimo: alerta,
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
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.keyboardView}>
          <View style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.title}>
                {isEditing ? "Editar Tanque" : "Novo Tanque"}
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
                  placeholder="Ex: Tanque Principal"
                  value={form.nome}
                  onChangeText={(v) => setForm((p) => ({ ...p, nome: v }))}
                />

                <Text style={styles.label}>Tipo de Combustivel *</Text>
                <Select
                  placeholder="Selecione o combustivel"
                  value={form.tipoCombustivel}
                  options={COMBUSTIVEL_OPTIONS}
                  onSelect={(v) =>
                    setForm((p) => ({ ...p, tipoCombustivel: v }))
                  }
                />

                <Text style={styles.label}>Capacidade (litros) *</Text>
                <Input
                  placeholder="Ex: 10000"
                  value={form.capacidadeLitros}
                  onChangeText={(v) =>
                    setForm((p) => ({ ...p, capacidadeLitros: v }))
                  }
                  keyboardType="decimal-pad"
                />

                <Text style={styles.label}>Nivel Atual (litros) *</Text>
                <Input
                  placeholder="Ex: 5000"
                  value={form.nivelAtual}
                  onChangeText={(v) =>
                    setForm((p) => ({ ...p, nivelAtual: v }))
                  }
                  keyboardType="decimal-pad"
                />

                <Text style={styles.label}>Alerta Nivel Minimo (litros) *</Text>
                <Input
                  placeholder="Ex: 1000"
                  value={form.alertaNivelMinimo}
                  onChangeText={(v) =>
                    setForm((p) => ({ ...p, alertaNivelMinimo: v }))
                  }
                  keyboardType="decimal-pad"
                />

                <Text style={styles.label}>Localizacao</Text>
                <View style={styles.toggleRow}>
                  <TouchableOpacity
                    style={[
                      styles.toggleButton,
                      form.localizacao === "fixo" && styles.toggleActive,
                    ]}
                    activeOpacity={0.8}
                    onPress={() =>
                      setForm((p) => ({ ...p, localizacao: "fixo" }))
                    }
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        form.localizacao === "fixo" && styles.toggleTextActive,
                      ]}
                    >
                      Fixo
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.toggleButton,
                      form.localizacao === "movel" && styles.toggleActive,
                    ]}
                    activeOpacity={0.8}
                    onPress={() =>
                      setForm((p) => ({ ...p, localizacao: "movel" }))
                    }
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        form.localizacao === "movel" && styles.toggleTextActive,
                      ]}
                    >
                      Movel
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.label}>Ativo</Text>
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
                      Sim
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.toggleButton,
                      !form.ativo && styles.toggleActive,
                    ]}
                    activeOpacity={0.8}
                    onPress={() => setForm((p) => ({ ...p, ativo: false }))}
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        !form.ativo && styles.toggleTextActive,
                      ]}
                    >
                      Nao
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
