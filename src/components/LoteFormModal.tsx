import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Lote } from "@/components/LoteCard";
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

type LoteFormModalProps = {
  visible: boolean;
  lote?: Lote | null;
  nextNumero: number;
  racaOptions: SelectOption[];
  categoriaOptions: SelectOption[];
  compensatorioOptions: SelectOption[];
  implanteOptions: SelectOption[];
  tamanhoCorporalOptions: SelectOption[];
  produtorOptions: SelectOption[];
  dietaOptions: SelectOption[];
  piqueteOptions: SelectOption[];
  onSave: (data: Omit<Lote, "id" | "movimentacoes">) => void;
  onClose: () => void;
  onAddProdutor?: () => void;
  onAddDieta?: () => void;
};

type LoteForm = {
  raca: string;
  categoria: string;
  compensatorio: string;
  implante: string;
  tamanhoCorporal: string;
  produtor: string;
  produtorId: string;
  gmdEstimado: string;
  ativo: boolean;
  dietaId: string;
  dietaNome: string;
  piqueteId: string;
  piqueteNome: string;
};

const emptyForm: LoteForm = {
  raca: "",
  categoria: "",
  compensatorio: "",
  implante: "",
  tamanhoCorporal: "",
  produtor: "",
  produtorId: "",
  gmdEstimado: "",
  ativo: true,
  dietaId: "",
  dietaNome: "",
  piqueteId: "",
  piqueteNome: "",
};

export function LoteFormModal({
  visible,
  lote,
  nextNumero,
  racaOptions,
  categoriaOptions,
  compensatorioOptions,
  implanteOptions,
  tamanhoCorporalOptions,
  produtorOptions,
  dietaOptions,
  piqueteOptions,
  onSave,
  onClose,
  onAddProdutor,
  onAddDieta,
}: LoteFormModalProps) {
  const [form, setForm] = useState<LoteForm>(emptyForm);
  const isEditing = !!lote;

  useEffect(() => {
    if (visible) {
      if (lote) {
        setForm({
          raca: lote.raca ?? "",
          categoria: lote.categoria ?? "",
          compensatorio: lote.compensatorio ?? "",
          implante: lote.implante ?? "",
          tamanhoCorporal: lote.tamanhoCorporal ?? "",
          produtor: lote.produtor ?? "",
          produtorId: lote.produtorId ?? "",
          gmdEstimado: lote.gmdEstimado?.toString() ?? "",
          ativo: lote.ativo ?? true,
          dietaId: lote.dietaId ?? "",
          dietaNome: lote.dietaNome ?? "",
          piqueteId: lote.piqueteId ?? "",
          piqueteNome: lote.piqueteNome ?? "",
        });
      } else {
        setForm(emptyForm);
      }
    }
  }, [visible, lote]);

  function handleProdutorSelect(value: string) {
    const selected = produtorOptions.find((p) => p.value === value);
    setForm((prev) => ({
      ...prev,
      produtorId: value,
      produtor: selected?.label ?? "",
    }));
  }

  function handleDietaSelect(value: string) {
    const selected = dietaOptions.find((d) => d.value === value);
    setForm((prev) => ({
      ...prev,
      dietaId: value,
      dietaNome: selected?.label ?? "",
    }));
  }

  function handlePiqueteSelect(value: string) {
    const selected = piqueteOptions.find((p) => p.value === value);
    setForm((prev) => ({
      ...prev,
      piqueteId: value,
      piqueteNome: selected?.label ?? "",
    }));
  }

  function handleSave() {
    if (!form.raca || !form.categoria || !form.produtorId || !form.gmdEstimado) {
      Alert.alert("Atenção", "Preencha os campos obrigatórios: Raça, Categoria, Produtor e GMD Estimado.");
      return;
    }
    const gmd = parseFloat(form.gmdEstimado.replace(",", "."));
    if (isNaN(gmd)) {
      Alert.alert("Atenção", "GMD Estimado deve ser um número válido.");
      return;
    }
    onSave({
      numero: lote?.numero ?? nextNumero,
      raca: form.raca,
      categoria: form.categoria,
      compensatorio: form.compensatorio,
      implante: form.implante,
      tamanhoCorporal: form.tamanhoCorporal,
      produtor: form.produtor,
      produtorId: form.produtorId,
      gmdEstimado: gmd,
      ativo: form.ativo,
      dietaId: form.dietaId,
      dietaNome: form.dietaNome,
      piqueteId: form.piqueteId,
      piqueteNome: form.piqueteNome,
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
                {isEditing ? `Editar Lote ${lote.numero}` : "Novo Lote"}
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
                {/* Numero do Lote */}
                <Text style={styles.label}>Número do Lote</Text>
                <View style={styles.readonlyField}>
                  <Text style={styles.readonlyText}>
                    {lote?.numero ?? nextNumero}
                  </Text>
                </View>

                {/* Raca */}
                <Text style={styles.label}>Raça *</Text>
                <Select
                  placeholder="Selecione a raça"
                  value={form.raca}
                  options={racaOptions}
                  onSelect={(v) => setForm((p) => ({ ...p, raca: v }))}
                />

                {/* Categoria */}
                <Text style={styles.label}>Categoria *</Text>
                <Select
                  placeholder="Selecione a categoria"
                  value={form.categoria}
                  options={categoriaOptions}
                  onSelect={(v) => setForm((p) => ({ ...p, categoria: v }))}
                />

                {/* Compensatorio */}
                <Text style={styles.label}>Compensatório</Text>
                <Select
                  placeholder="Selecione o compensatório"
                  value={form.compensatorio}
                  options={compensatorioOptions}
                  onSelect={(v) =>
                    setForm((p) => ({ ...p, compensatorio: v }))
                  }
                />

                {/* Implante */}
                <Text style={styles.label}>Implante</Text>
                <Select
                  placeholder="Selecione o implante"
                  value={form.implante}
                  options={implanteOptions}
                  onSelect={(v) => setForm((p) => ({ ...p, implante: v }))}
                />

                {/* Tamanho Corporal */}
                <Text style={styles.label}>Tamanho Corporal</Text>
                <Select
                  placeholder="Selecione o tamanho corporal"
                  value={form.tamanhoCorporal}
                  options={tamanhoCorporalOptions}
                  onSelect={(v) =>
                    setForm((p) => ({ ...p, tamanhoCorporal: v }))
                  }
                />

                {/* Produtor */}
                <Text style={styles.label}>Produtor *</Text>
                <Select
                  placeholder="Selecione o produtor"
                  value={form.produtorId}
                  options={produtorOptions}
                  onSelect={handleProdutorSelect}
                  onAdd={onAddProdutor}
                />

                {/* Dieta */}
                <Text style={styles.label}>Dieta</Text>
                <Select
                  placeholder="Selecione a dieta"
                  value={form.dietaId}
                  options={dietaOptions}
                  onSelect={handleDietaSelect}
                  onAdd={onAddDieta}
                />

                {/* Piquete */}
                <Text style={styles.label}>Piquete</Text>
                <Select
                  placeholder="Selecione o piquete"
                  value={form.piqueteId}
                  options={piqueteOptions}
                  onSelect={handlePiqueteSelect}
                />

                {/* GMD Estimado */}
                <Text style={styles.label}>GMD Estimado (kg) *</Text>
                <Input
                  placeholder="Ex: 0.8"
                  value={form.gmdEstimado}
                  onChangeText={(v) =>
                    setForm((p) => ({ ...p, gmdEstimado: v }))
                  }
                  keyboardType="decimal-pad"
                />

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
                    label={isEditing ? "Salvar Lote" : "Cadastrar Lote"}
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
