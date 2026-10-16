import { DatePickerInput } from "@/components/DatePickerInput";
import { Input } from "@/components/Input";
import { Select, SelectOption } from "@/components/Select";
import { useTheme } from "@/contexts/ThemeContext";
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

export type TransferenciaLoteOrigem = {
  id: string;
  numero: number;
  qtdAtual: number;
  pesoPrevisto: number;
};

export type TransferenciaLoteDestino = {
  id: string;
  numero: number;
  piqueteNome: string;
  produtor: string;
};

export type TransferenciaFormData = {
  destinoId: string;
  quantidade: number;
  pesoMedio: number;
  data: string; // yyyy-mm-dd
  observacao: string;
};

type TransferenciaLoteModalProps = {
  visible: boolean;
  origem: TransferenciaLoteOrigem | null;
  lotesDisponiveis: TransferenciaLoteDestino[];
  onConfirm: (data: TransferenciaFormData) => void;
  onClose: () => void;
};

function dateToISO(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function loteDestinoLabel(l: TransferenciaLoteDestino): string {
  return `Lote ${l.numero} — ${l.piqueteNome || "Sem piquete"} — ${l.produtor || "-"}`;
}

export function TransferenciaLoteModal({
  visible,
  origem,
  lotesDisponiveis,
  onConfirm,
  onClose,
}: TransferenciaLoteModalProps) {
  const { primaryColor } = useTheme();

  const [destinoId, setDestinoId] = useState("");
  const [data, setData] = useState(new Date());
  const [quantidade, setQuantidade] = useState("");
  const [pesoMedio, setPesoMedio] = useState("");
  const [observacao, setObservacao] = useState("");

  // Reinicia o formulário quando muda o lote de origem (peso previsto hoje preenchido)
  useEffect(() => {
    if (!origem) return;
    setDestinoId("");
    setData(new Date());
    setQuantidade(origem.qtdAtual > 0 ? String(origem.qtdAtual) : "");
    setPesoMedio(origem.pesoPrevisto > 0 ? origem.pesoPrevisto.toFixed(1) : "");
    setObservacao("");
  }, [origem?.id]);

  if (!origem) return null;

  const destinoOptions: SelectOption[] = lotesDisponiveis
    .filter((l) => l.id !== origem.id)
    .map((l) => ({ label: loteDestinoLabel(l), value: l.id }));

  const qtdNum = parseInt(quantidade, 10);
  const transfereTudo = !isNaN(qtdNum) && qtdNum >= origem.qtdAtual;

  function handleConfirm() {
    if (!destinoId) {
      Alert.alert("Atenção", "Selecione o lote de destino.");
      return;
    }
    const qtd = parseInt(quantidade, 10);
    const peso = parseFloat(pesoMedio.replace(",", "."));
    if (isNaN(qtd) || qtd <= 0) {
      Alert.alert("Atenção", "Quantidade deve ser um número inteiro positivo.");
      return;
    }
    if (qtd > origem!.qtdAtual) {
      Alert.alert(
        "Atenção",
        `Quantidade maior que o saldo do lote (${origem!.qtdAtual} animais).`
      );
      return;
    }
    if (isNaN(peso) || peso <= 0) {
      Alert.alert("Atenção", "Peso médio deve ser um número positivo.");
      return;
    }
    onConfirm({
      destinoId,
      quantidade: qtd,
      pesoMedio: peso,
      data: dateToISO(data),
      observacao,
    });
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.keyboardView}>
          <View style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.title} numberOfLines={1}>
                Transferência — Lote {origem.numero}
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
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Saldo Atual</Text>
                  <Text style={styles.statValue}>{origem.qtdAtual}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>KG Previsto Hoje</Text>
                  <Text style={styles.statValue}>
                    {origem.pesoPrevisto > 0 ? `${origem.pesoPrevisto.toFixed(1)} kg` : "-"}
                  </Text>
                </View>
              </View>

              <View style={styles.form}>
                <Text style={styles.label}>Lote de Destino</Text>
                <Select
                  placeholder="Selecione o lote de destino"
                  value={destinoId}
                  options={destinoOptions}
                  onSelect={setDestinoId}
                />

                <Text style={styles.label}>Data</Text>
                <DatePickerInput
                  value={data}
                  onChange={(date) => setData(date || new Date())}
                />

                <Text style={styles.label}>Quantidade de Animais</Text>
                <Input
                  placeholder="Ex: 50"
                  value={quantidade}
                  onChangeText={setQuantidade}
                  keyboardType="numeric"
                />

                <Text style={styles.label}>Peso Médio (kg)</Text>
                <Input
                  placeholder="Ex: 350"
                  value={pesoMedio}
                  onChangeText={setPesoMedio}
                  keyboardType="decimal-pad"
                />

                <Text style={styles.label}>Observação</Text>
                <Input
                  placeholder="Observação (opcional)"
                  value={observacao}
                  onChangeText={setObservacao}
                />

                {transfereTudo && (
                  <View style={styles.warningBox}>
                    <Feather name="alert-triangle" size={16} color="#E65100" />
                    <Text style={styles.warningText}>
                      Ao transferir todo o saldo, este lote será inativado e
                      removido do roteiro.
                    </Text>
                  </View>
                )}

                <View style={styles.buttonWrapper}>
                  <TouchableOpacity
                    style={[styles.confirmButton, { backgroundColor: primaryColor }]}
                    activeOpacity={0.8}
                    onPress={handleConfirm}
                  >
                    <Feather name="corner-up-right" size={18} color="#FFF" />
                    <Text style={styles.confirmButtonLabel}>Transferir</Text>
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
  warningBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFF3E0",
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: "#E65100",
    fontWeight: "600",
  },
  buttonWrapper: {
    marginTop: 16,
  },
  confirmButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    height: 48,
    gap: 8,
  },
  confirmButtonLabel: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
