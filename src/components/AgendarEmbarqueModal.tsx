import { DatePickerInput } from "@/components/DatePickerInput";
import { Input } from "@/components/Input";
import { useTheme } from "@/contexts/ThemeContext";
import {
  agendarEmbarque,
  cancelarEmbarqueAgendado,
  EmbarqueAgendadoDoc,
  listarEmbarquesAgendados,
} from "@/services/embarqueAgendado";
import { Feather } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
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

export type AgendarEmbarqueLote = {
  id: string;
  numero: number;
  qtdAtual: number;
};

type AgendarEmbarqueModalProps = {
  visible: boolean;
  lote: AgendarEmbarqueLote | null;
  onClose: () => void;
};

function dateToISO(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDataBr(data: string): string {
  const partes = data.split("-");
  return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : data;
}

export function AgendarEmbarqueModal({ visible, lote, onClose }: AgendarEmbarqueModalProps) {
  const { primaryColor } = useTheme();

  const [data, setData] = useState(new Date());
  const [quantidade, setQuantidade] = useState("");
  const [observacao, setObservacao] = useState("");
  const [agendamentos, setAgendamentos] = useState<EmbarqueAgendadoDoc[]>([]);
  const [loadingLista, setLoadingLista] = useState(false);
  const [saving, setSaving] = useState(false);

  const carregarAgendamentos = useCallback(async (loteId: string) => {
    setLoadingLista(true);
    try {
      const lista = await listarEmbarquesAgendados(loteId);
      setAgendamentos(lista);
    } finally {
      setLoadingLista(false);
    }
  }, []);

  useEffect(() => {
    if (!lote) return;
    setData(new Date());
    setQuantidade(lote.qtdAtual > 0 ? String(lote.qtdAtual) : "");
    setObservacao("");
    carregarAgendamentos(lote.id);
  }, [lote?.id, carregarAgendamentos]);

  if (!lote) return null;

  const qtdNum = parseInt(quantidade, 10);
  const ehTotal = !isNaN(qtdNum) && qtdNum >= lote.qtdAtual;

  async function handleConfirmar() {
    if (!lote) return;
    const qtd = parseInt(quantidade, 10);
    if (isNaN(qtd) || qtd <= 0) {
      Alert.alert("Atenção", "Quantidade deve ser um número inteiro positivo.");
      return;
    }
    if (qtd > lote.qtdAtual) {
      Alert.alert("Atenção", `Quantidade maior que o saldo do lote (${lote.qtdAtual} animais).`);
      return;
    }
    setSaving(true);
    try {
      await agendarEmbarque(lote.id, {
        data: dateToISO(data),
        quantidade: qtd,
        observacao,
      });
      setObservacao("");
      await carregarAgendamentos(lote.id);
    } finally {
      setSaving(false);
    }
  }

  async function handleCancelar(embarqueId: string) {
    if (!lote) return;
    await cancelarEmbarqueAgendado(lote.id, embarqueId);
    await carregarAgendamentos(lote.id);
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
                Agendar Embarque — Lote {lote.numero}
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
                  <Text style={styles.statValue}>{lote.qtdAtual}</Text>
                </View>
              </View>

              {loadingLista ? (
                <ActivityIndicator color={primaryColor} style={{ marginVertical: 8 }} />
              ) : agendamentos.length > 0 ? (
                <View style={styles.agendList}>
                  <Text style={styles.agendListTitle}>Agendamentos pendentes</Text>
                  {agendamentos.map((a) => (
                    <View key={a.id} style={styles.agendItem}>
                      <View style={styles.agendItemContent}>
                        <Text style={styles.agendItemData}>{formatDataBr(a.data)}</Text>
                        <Text style={styles.agendItemDetalhe}>
                          {a.quantidade} animal(is){a.quantidade >= lote.qtdAtual ? " — lote inteiro" : ""}
                        </Text>
                        {!!a.observacao && (
                          <Text style={styles.agendItemObs}>{a.observacao}</Text>
                        )}
                      </View>
                      <TouchableOpacity
                        style={styles.agendDeleteBtn}
                        activeOpacity={0.7}
                        onPress={() => handleCancelar(a.id)}
                      >
                        <Feather name="trash-2" size={16} color="#E53935" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ) : null}

              <Text style={styles.formTitle}>Novo Agendamento</Text>

              <View style={styles.form}>
                <Text style={styles.label}>Data do Embarque</Text>
                <DatePickerInput
                  value={data}
                  onChange={(d) => setData(d || new Date())}
                />

                <Text style={styles.label}>Quantidade de Animais</Text>
                <Input
                  placeholder={`Ex: ${lote.qtdAtual}`}
                  value={quantidade}
                  onChangeText={setQuantidade}
                  keyboardType="numeric"
                />

                <Text style={styles.label}>Observação</Text>
                <Input
                  placeholder="Observação (opcional)"
                  value={observacao}
                  onChangeText={setObservacao}
                />

                {ehTotal && (
                  <View style={styles.warningBox}>
                    <Feather name="alert-triangle" size={16} color="#E65100" />
                    <Text style={styles.warningText}>
                      Este agendamento é de todo o lote — ele sairá do roteiro (mapa de
                      trato) na data marcada.
                    </Text>
                  </View>
                )}

                <View style={styles.buttonWrapper}>
                  <TouchableOpacity
                    style={[styles.confirmButton, { backgroundColor: primaryColor }, saving && styles.confirmButtonDisabled]}
                    activeOpacity={0.8}
                    onPress={handleConfirmar}
                    disabled={saving}
                  >
                    <Feather name="truck" size={18} color="#FFF" />
                    <Text style={styles.confirmButtonLabel}>Agendar</Text>
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
  agendList: {
    gap: 8,
    marginBottom: 16,
  },
  agendListTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  agendItem: {
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  agendItemContent: {
    flex: 1,
  },
  agendItemData: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  agendItemDetalhe: {
    fontSize: 13,
    color: "#888",
  },
  agendItemObs: {
    fontSize: 12,
    color: "#999",
    fontStyle: "italic",
    marginTop: 2,
  },
  agendDeleteBtn: {
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
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonLabel: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
