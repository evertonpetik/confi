import { Button } from "@/components/Button";
import { Dieta, DietaInsumo } from "@/components/DietaCard";
import { Input } from "@/components/Input";
import { Insumo } from "@/components/InsumoCard";
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

type DietaFormModalProps = {
  visible: boolean;
  dieta?: Dieta | null;
  insumoOptions: SelectOption[];
  aditivoOptions: SelectOption[];
  insumosMap?: Map<string, Insumo>;
  onSave: (data: Omit<Dieta, "id">) => void;
  onClose: () => void;
  onAddInsumo?: () => void;
};

type InsumoRow = {
  insumoId: string;
  insumoNome: string;
  percentual: string;
};

type DietaForm = {
  nome: string;
  percentualMS: string;
  ndt: string;
  aditivoId: string;
  aditivoNome: string;
  ativo: boolean;
};

const emptyForm: DietaForm = {
  nome: "",
  percentualMS: "",
  ndt: "",
  aditivoId: "",
  aditivoNome: "",
  ativo: true,
};

export function DietaFormModal({
  visible,
  dieta,
  insumoOptions,
  aditivoOptions,
  insumosMap = new Map(),
  onSave,
  onClose,
  onAddInsumo,
}: DietaFormModalProps) {
  const [form, setForm] = useState<DietaForm>(emptyForm);
  const [insumoRows, setInsumoRows] = useState<InsumoRow[]>([]);
  const [manterMS, setManterMS] = useState<boolean>(false);
  const { primaryColor } = useTheme();
  const isEditing = !!dieta;

  useEffect(() => {
    if (visible) {
      if (dieta) {
        setForm({
          nome: dieta.nome ?? "",
          percentualMS: dieta.percentualMS?.toString() ?? "",
          ndt: dieta.ndt?.toString() ?? "",
          aditivoId: dieta.aditivoId ?? "",
          aditivoNome: dieta.aditivoNome ?? "",
          ativo: dieta.ativo ?? true,
        });
        setInsumoRows(
          dieta.insumos.map((i) => ({
            insumoId: i.insumoId,
            insumoNome: i.insumoNome,
            percentual: i.percentual.toString(),
          }))
        );

        // Inferir estado do toggle a partir dos dados salvos
        const savedMS = dieta.percentualMS ?? 0;
        const naturalMS = dieta.insumos.reduce((acc, di) => {
          const insumo = insumosMap.get(di.insumoId);
          const percMS = insumo?.percentualMateriaSeca ?? 0;
          return acc + (di.percentual / 100) * percMS;
        }, 0);

        if (naturalMS > 0 && Math.abs(savedMS - naturalMS) < 0.01) {
          setManterMS(true);
        } else {
          setManterMS(false);
        }
      } else {
        setForm(emptyForm);
        setInsumoRows([]);
        setManterMS(false);
      }
    }
  }, [visible, dieta]);

  // MS da dieta calculada (media ponderada)
  const msDieta = insumoRows.reduce((acc, row) => {
    const perc = parseFloat(row.percentual.replace(",", "."));
    if (isNaN(perc) || perc <= 0 || !row.insumoId) return acc;
    const insumo = insumosMap.get(row.insumoId);
    const percMS = insumo?.percentualMateriaSeca ?? 0;
    return acc + (perc / 100) * percMS;
  }, 0);

  // Sincronizar percentualMS quando "Manter MS" estiver ativo
  useEffect(() => {
    if (manterMS && msDieta > 0) {
      setForm((prev) => ({
        ...prev,
        percentualMS: msDieta.toFixed(2),
      }));
    }
  }, [manterMS, msDieta]);

  function handleAddInsumoRow() {
    setInsumoRows((prev) => [
      ...prev,
      { insumoId: "", insumoNome: "", percentual: "" },
    ]);
  }

  function handleRemoveInsumoRow(index: number) {
    setInsumoRows((prev) => prev.filter((_, i) => i !== index));
  }

  function handleInsumoSelect(index: number, value: string) {
    const selected = insumoOptions.find((o) => o.value === value);
    setInsumoRows((prev) =>
      prev.map((row, i) =>
        i === index
          ? { ...row, insumoId: value, insumoNome: selected?.label ?? "" }
          : row
      )
    );
  }

  function handleInsumoPercentual(index: number, value: string) {
    setInsumoRows((prev) =>
      prev.map((row, i) =>
        i === index ? { ...row, percentual: value } : row
      )
    );
  }

  function handleAditivoSelect(value: string) {
    const selected = aditivoOptions.find((o) => o.value === value);
    setForm((prev) => ({
      ...prev,
      aditivoId: value,
      aditivoNome: selected?.label ?? "",
    }));
  }

  function handleSave() {
    if (!form.nome.trim()) {
      Alert.alert("Atenção", "Preencha o nome da dieta.");
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

    const ndt = parseFloat(form.ndt.replace(",", "."));
    if (isNaN(ndt) || ndt < 0 || ndt > 100) {
      Alert.alert("Atenção", "NDT deve ser um número entre 0 e 100.");
      return;
    }

    if (insumoRows.length === 0) {
      Alert.alert("Atenção", "Adicione ao menos um insumo à dieta.");
      return;
    }

    const parsedInsumos: DietaInsumo[] = [];
    let somaPercentual = 0;

    for (let i = 0; i < insumoRows.length; i++) {
      const row = insumoRows[i];
      if (!row.insumoId) {
        Alert.alert("Atenção", `Selecione o insumo na linha ${i + 1}.`);
        return;
      }
      const perc = parseFloat(row.percentual.replace(",", "."));
      if (isNaN(perc) || perc <= 0 || perc > 100) {
        Alert.alert(
          "Atenção",
          `Percentual do insumo "${row.insumoNome}" deve ser entre 0 e 100.`
        );
        return;
      }
      somaPercentual += perc;
      parsedInsumos.push({
        insumoId: row.insumoId,
        insumoNome: row.insumoNome,
        percentual: perc,
      });
    }

    if (Math.abs(somaPercentual - 100) > 0.01) {
      Alert.alert(
        "Atenção",
        `A soma dos percentuais dos insumos deve ser 100%. Atual: ${somaPercentual.toFixed(2)}%`
      );
      return;
    }

    onSave({
      nome: form.nome.trim(),
      insumos: parsedInsumos,
      percentualMS: pms,
      ndt,
      aditivoId: form.aditivoId,
      aditivoNome: form.aditivoNome,
      ativo: form.ativo,
    });
  }

  const somaAtual = insumoRows.reduce((acc, row) => {
    const val = parseFloat(row.percentual.replace(",", "."));
    return acc + (isNaN(val) ? 0 : val);
  }, 0);

  const msInputDisabled = manterMS;

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
                {isEditing ? "Editar Dieta" : "Nova Dieta"}
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
                {/* Nome */}
                <Text style={styles.label}>Nome da Dieta *</Text>
                <Input
                  placeholder="Nome da dieta"
                  value={form.nome}
                  onChangeText={(v) => setForm((p) => ({ ...p, nome: v }))}
                />

                {/* Insumos Section */}
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Composição da Dieta</Text>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.sectionSubtitle}>
                      Total: {somaAtual.toFixed(2).replace(".", ",")}%
                    </Text>
                    {msDieta > 0 && (
                      <Text style={[styles.sectionSubtitle, { color: primaryColor }]}>
                        MS da Dieta: {msDieta.toFixed(2).replace(".", ",")}%
                      </Text>
                    )}
                  </View>
                </View>

                {insumoRows.map((row, index) => (
                  <View key={index} style={styles.insumoRow}>
                    <View style={styles.insumoRowContent}>
                      <View style={styles.insumoSelectWrapper}>
                        <Select
                          placeholder="Selecione o insumo"
                          value={row.insumoId}
                          options={insumoOptions}
                          onSelect={(v) => handleInsumoSelect(index, v)}
                          onAdd={onAddInsumo}
                        />
                      </View>
                      <View style={styles.insumoPercentWrapper}>
                        <Input
                          placeholder="%"
                          value={row.percentual}
                          onChangeText={(v) =>
                            handleInsumoPercentual(index, v)
                          }
                          keyboardType="decimal-pad"
                        />
                      </View>
                      <TouchableOpacity
                        style={styles.removeButton}
                        activeOpacity={0.7}
                        onPress={() => handleRemoveInsumoRow(index)}
                      >
                        <Feather name="x-circle" size={22} color="#E53935" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}

                <TouchableOpacity
                  style={[styles.addInsumoButton, { borderColor: primaryColor }]}
                  activeOpacity={0.8}
                  onPress={handleAddInsumoRow}
                >
                  <Feather name="plus-circle" size={18} color={primaryColor} />
                  <Text style={[styles.addInsumoLabel, { color: primaryColor }]}>Adicionar Insumo</Text>
                </TouchableOpacity>

                {/* Toggle Manter MS da Dieta */}
                {insumoRows.length > 0 && msDieta > 0 && (
                  <>
                    <Text style={styles.label}>Manter MS da Dieta?</Text>
                    <View style={styles.toggleRow}>
                      <TouchableOpacity
                        style={[
                          styles.toggleButton,
                          manterMS && { backgroundColor: primaryColor, borderColor: primaryColor },
                        ]}
                        activeOpacity={0.8}
                        onPress={() => setManterMS(true)}
                      >
                        <Text
                          style={[
                            styles.toggleText,
                            manterMS && styles.toggleTextActive,
                          ]}
                        >
                          Sim
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.toggleButton,
                          !manterMS && { backgroundColor: primaryColor, borderColor: primaryColor },
                        ]}
                        activeOpacity={0.8}
                        onPress={() => setManterMS(false)}
                      >
                        <Text
                          style={[
                            styles.toggleText,
                            !manterMS && styles.toggleTextActive,
                          ]}
                        >
                          Não
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}

                {/* Percentual MS */}
                <Text style={styles.label}>Percentual de MS Desejada (%) *</Text>
                <View style={msInputDisabled ? { opacity: 0.6 } : undefined}>
                  <Input
                    placeholder="Ex: 55"
                    value={form.percentualMS}
                    onChangeText={(v) =>
                      setForm((p) => ({ ...p, percentualMS: v }))
                    }
                    keyboardType="decimal-pad"
                    editable={!msInputDisabled}
                    style={msInputDisabled ? { backgroundColor: "#F0F0F0" } : undefined}
                  />
                </View>

                {/* NDT */}
                <Text style={styles.label}>NDT (%) *</Text>
                <Input
                  placeholder="Ex: 72"
                  value={form.ndt}
                  onChangeText={(v) => setForm((p) => ({ ...p, ndt: v }))}
                  keyboardType="decimal-pad"
                />

                {/* Aditivo */}
                <Text style={styles.label}>Aditivo</Text>
                <Select
                  placeholder="Selecione o aditivo"
                  value={form.aditivoId}
                  options={aditivoOptions}
                  onSelect={handleAditivoSelect}
                />

                {/* Status */}
                <Text style={styles.label}>Status</Text>
                <View style={styles.toggleRow}>
                  <TouchableOpacity
                    style={[
                      styles.toggleButton,
                      form.ativo && { backgroundColor: primaryColor, borderColor: primaryColor },
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
                      Ativa
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
                      Inativa
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.buttonWrapper}>
                  <Button
                    label={isEditing ? "Salvar Dieta" : "Cadastrar Dieta"}
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
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#888",
  },
  insumoRow: {
    marginBottom: 8,
  },
  insumoRowContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  insumoSelectWrapper: {
    flex: 1,
  },
  insumoPercentWrapper: {
    width: 80,
  },
  removeButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  addInsumoButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: "dashed",
    marginTop: 4,
  },
  addInsumoLabel: {
    fontSize: 14,
    fontWeight: "600",
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
