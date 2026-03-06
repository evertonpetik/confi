import { Input } from "@/components/Input";
import {
  calcularEstoque,
  calcularPrecoMedio,
  Compra,
  Insumo,
} from "@/components/InsumoCard";
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

type CompraFormModalProps = {
  visible: boolean;
  insumo: Insumo | null;
  onAddCompra: (insumoId: string, compra: Omit<Compra, "id">) => void;
  onDeleteCompra: (insumoId: string, compraId: string) => void;
  onClose: () => void;
};

type CompraForm = {
  data: string;
  quantidade: string;
  precoKg: string;
};

const emptyForm: CompraForm = {
  data: "",
  quantidade: "",
  precoKg: "",
};

function formatDateInput(text: string): string {
  const digits = text.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function parseDateToISO(dateStr: string): string {
  const parts = dateStr.split("/");
  if (parts.length !== 3) return "";
  const [dd, mm, yyyy] = parts;
  if (!dd || !mm || !yyyy || yyyy.length !== 4) return "";
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

export function CompraFormModal({
  visible,
  insumo,
  onAddCompra,
  onDeleteCompra,
  onClose,
}: CompraFormModalProps) {
  const [form, setForm] = useState<CompraForm>(emptyForm);

  if (!insumo) return null;

  const estoque = calcularEstoque(insumo.compras, insumo.saidas);
  const precoMedio = calcularPrecoMedio(insumo.compras, insumo.saidas);

  function handleAdd() {
    if (!form.data || !form.quantidade || !form.precoKg) {
      Alert.alert("Atenção", "Preencha todos os campos.");
      return;
    }
    const isoDate = parseDateToISO(form.data);
    if (!isoDate) {
      Alert.alert("Atenção", "Data inválida. Use o formato DD/MM/AAAA.");
      return;
    }
    const qtd = parseFloat(form.quantidade.replace(",", "."));
    const preco = parseFloat(form.precoKg.replace(",", "."));
    if (isNaN(qtd) || qtd <= 0) {
      Alert.alert("Atenção", "Quantidade deve ser um número positivo.");
      return;
    }
    if (isNaN(preco) || preco <= 0) {
      Alert.alert("Atenção", "Preço/kg deve ser um número positivo.");
      return;
    }
    onAddCompra(insumo.id, {
      data: isoDate,
      quantidade: qtd,
      precoKg: preco,
    });
    setForm(emptyForm);
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
              <Text style={styles.title}>Compras - {insumo.nome}</Text>
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
                  <Text style={styles.statLabel}>Estoque Atual</Text>
                  <Text style={styles.statValue}>
                    {estoque > 0
                      ? `${estoque.toLocaleString("pt-BR")} kg`
                      : "-"}
                  </Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Preço Médio</Text>
                  <Text style={styles.statValue}>
                    {precoMedio > 0
                      ? `R$ ${precoMedio.toFixed(2).replace(".", ",")}`
                      : "-"}
                  </Text>
                </View>
              </View>

              {/* Lista de compras */}
              {insumo.compras.length > 0 && (
                <View style={styles.compraList}>
                  {insumo.compras.map((c) => {
                    const dataParts = c.data.split("-");
                    const dataFormatada =
                      dataParts.length === 3
                        ? `${dataParts[2]}/${dataParts[1]}/${dataParts[0]}`
                        : c.data;
                    return (
                      <View key={c.id} style={styles.compraItem}>
                        <View style={styles.compraItemContent}>
                          <Text style={styles.compraItemDate}>
                            {dataFormatada}
                          </Text>
                          <Text style={styles.compraItemDetails}>
                            {c.quantidade.toLocaleString("pt-BR")} kg | R${" "}
                            {c.precoKg.toFixed(2).replace(".", ",")}/kg
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.compraDeleteBtn}
                          activeOpacity={0.7}
                          onPress={() => onDeleteCompra(insumo.id, c.id)}
                        >
                          <Feather name="trash-2" size={16} color="#E53935" />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Formulario nova compra */}
              <Text style={styles.formTitle}>Nova Compra</Text>

              <View style={styles.form}>
                <Text style={styles.label}>Data</Text>
                <Input
                  placeholder="DD/MM/AAAA"
                  value={form.data}
                  onChangeText={(v) =>
                    setForm((p) => ({ ...p, data: formatDateInput(v) }))
                  }
                  keyboardType="numeric"
                  maxLength={10}
                />

                <Text style={styles.label}>Quantidade (kg)</Text>
                <Input
                  placeholder="Ex: 5000"
                  value={form.quantidade}
                  onChangeText={(v) =>
                    setForm((p) => ({ ...p, quantidade: v }))
                  }
                  keyboardType="decimal-pad"
                />

                <Text style={styles.label}>Preço/kg (R$)</Text>
                <Input
                  placeholder="Ex: 1.50"
                  value={form.precoKg}
                  onChangeText={(v) =>
                    setForm((p) => ({ ...p, precoKg: v }))
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
                    <Text style={styles.addButtonLabel}>Adicionar Compra</Text>
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
  compraList: {
    gap: 8,
    marginBottom: 16,
  },
  compraItem: {
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  compraItemContent: {
    flex: 1,
  },
  compraItemDate: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  compraItemDetails: {
    fontSize: 13,
    color: "#888",
    marginTop: 2,
  },
  compraDeleteBtn: {
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
