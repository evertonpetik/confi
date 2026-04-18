import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import type { Veiculo } from "@/components/VeiculoCard";
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

type VeiculoFormModalProps = {
  visible: boolean;
  veiculo?: Veiculo | null;
  onSave: (data: Omit<Veiculo, "id">) => void;
  onClose: () => void;
};

type VeiculoForm = {
  nome: string;
  placa: string;
  tipo: string;
  tipoCombustivel: string;
  marcadorAtual: string;
  ativo: boolean;
};

const emptyForm: VeiculoForm = {
  nome: "",
  placa: "",
  tipo: "",
  tipoCombustivel: "",
  marcadorAtual: "",
  ativo: true,
};

const TIPO_OPTIONS = [
  { label: "Veiculo (km)", value: "veiculo" },
  { label: "Maquina (horimetro)", value: "maquina" },
  { label: "Equipamento (sem marcador)", value: "equipamento" },
];

const COMBUSTIVEL_OPTIONS = [
  { label: "Diesel", value: "Diesel" },
  { label: "Diesel S10", value: "Diesel S10" },
  { label: "Diesel S500", value: "Diesel S500" },
  { label: "Gasolina", value: "Gasolina" },
  { label: "Etanol", value: "Etanol" },
];

function deriveTipoMarcador(tipo: string): "km" | "horimetro" | "nenhum" {
  if (tipo === "veiculo") return "km";
  if (tipo === "maquina") return "horimetro";
  return "nenhum";
}

export function VeiculoFormModal({
  visible,
  veiculo,
  onSave,
  onClose,
}: VeiculoFormModalProps) {
  const [form, setForm] = useState<VeiculoForm>(emptyForm);
  const isEditing = !!veiculo;

  useEffect(() => {
    if (visible) {
      if (veiculo) {
        setForm({
          nome: veiculo.nome ?? "",
          placa: veiculo.placa ?? "",
          tipo: veiculo.tipo ?? "",
          tipoCombustivel: veiculo.tipoCombustivel ?? "",
          marcadorAtual: veiculo.marcadorAtual?.toString() ?? "0",
          ativo: veiculo.ativo ?? true,
        });
      } else {
        setForm(emptyForm);
      }
    }
  }, [visible, veiculo]);

  const tipoMarcador = deriveTipoMarcador(form.tipo);
  const showMarcador = tipoMarcador !== "nenhum";

  function handleSave() {
    if (!form.nome.trim()) {
      Alert.alert("Atencao", "Preencha o nome do veiculo/equipamento.");
      return;
    }
    if (!form.tipo) {
      Alert.alert("Atencao", "Selecione o tipo.");
      return;
    }
    if (!form.tipoCombustivel) {
      Alert.alert("Atencao", "Selecione o tipo de combustivel.");
      return;
    }

    let marcador = 0;
    if (showMarcador) {
      marcador = parseFloat(form.marcadorAtual.replace(",", "."));
      if (isNaN(marcador) || marcador < 0) {
        Alert.alert("Atencao", "Marcador deve ser um numero valido.");
        return;
      }
    }

    onSave({
      nome: form.nome.trim(),
      placa: form.placa.trim(),
      tipo: form.tipo as Veiculo["tipo"],
      tipoMarcador,
      tipoCombustivel: form.tipoCombustivel,
      marcadorAtual: marcador,
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
                {isEditing ? "Editar Veiculo" : "Novo Veiculo"}
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
                  placeholder="Ex: Trator John Deere"
                  value={form.nome}
                  onChangeText={(v) => setForm((p) => ({ ...p, nome: v }))}
                />

                <Text style={styles.label}>Placa (opcional)</Text>
                <Input
                  placeholder="Ex: ABC-1234"
                  value={form.placa}
                  onChangeText={(v) => setForm((p) => ({ ...p, placa: v }))}
                />

                <Text style={styles.label}>Tipo *</Text>
                <Select
                  placeholder="Selecione o tipo"
                  value={form.tipo}
                  options={TIPO_OPTIONS}
                  onSelect={(v) => setForm((p) => ({ ...p, tipo: v }))}
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

                {showMarcador && (
                  <>
                    <Text style={styles.label}>
                      {tipoMarcador === "km"
                        ? "Hodometro Atual (km)"
                        : "Horimetro Atual (h)"}
                    </Text>
                    <Input
                      placeholder={
                        tipoMarcador === "km" ? "Ex: 50000" : "Ex: 1903"
                      }
                      value={form.marcadorAtual}
                      onChangeText={(v) =>
                        setForm((p) => ({ ...p, marcadorAtual: v }))
                      }
                      keyboardType="decimal-pad"
                    />
                  </>
                )}

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
