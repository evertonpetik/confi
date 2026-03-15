import { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Produtor } from "@/components/ProdutorCard";
import { Select, SelectOption } from "@/components/Select";
import {
  formatCNPJ,
  formatCPF,
  onlyDigits,
  validateCNPJ,
  validateCPF,
} from "@/utils/validators";
import { Feather } from "@expo/vector-icons";

type ProdutorFormModalProps = {
  visible: boolean;
  produtor?: Produtor | null;
  onSave: (data: Omit<Produtor, "id">) => void;
  onClose: () => void;
};

const emptyForm: Omit<Produtor, "id"> = {
  nome: "",
  abreviacao: "",
  fazenda: "",
  cidade: "",
  uf: "",
  inscricaoEstadual: "",
  telefone: "",
  email: "",
  cpfCnpj: "",
};

type TipoPessoa = "PF" | "PJ";

const IBGE_BASE = "https://servicodados.ibge.gov.br/api/v1/localidades";

export function ProdutorFormModal({
  visible,
  produtor,
  onSave,
  onClose,
}: ProdutorFormModalProps) {
  const [form, setForm] = useState(emptyForm);
  const [tipoPessoa, setTipoPessoa] = useState<TipoPessoa>("PF");
  const [docError, setDocError] = useState("");
  const isEditing = !!produtor;

  const [estados, setEstados] = useState<SelectOption[]>([]);
  const [municipios, setMunicipios] = useState<SelectOption[]>([]);
  const [loadingEstados, setLoadingEstados] = useState(false);
  const [loadingMunicipios, setLoadingMunicipios] = useState(false);

  // Fetch estados ao abrir modal
  useEffect(() => {
    if (visible && estados.length === 0) {
      fetchEstados();
    }
  }, [visible]);

  // Fetch municipios quando UF muda
  useEffect(() => {
    if (form.uf) {
      fetchMunicipios(form.uf);
    } else {
      setMunicipios([]);
    }
  }, [form.uf]);

  // Preencher form ao editar
  useEffect(() => {
    if (visible) {
      if (produtor) {
        setForm({
          nome: produtor.nome ?? "",
          abreviacao: produtor.abreviacao ?? "",
          fazenda: produtor.fazenda ?? "",
          cidade: produtor.cidade ?? "",
          uf: produtor.uf ?? "",
          inscricaoEstadual: produtor.inscricaoEstadual ?? "",
          telefone: produtor.telefone ?? "",
          email: produtor.email ?? "",
          cpfCnpj: produtor.cpfCnpj ?? "",
        });
        const digits = onlyDigits(produtor.cpfCnpj ?? "");
        setTipoPessoa(digits.length > 11 ? "PJ" : "PF");
      } else {
        setForm(emptyForm);
        setTipoPessoa("PF");
      }
      setDocError("");
    }
  }, [visible, produtor]);

  async function fetchEstados() {
    try {
      setLoadingEstados(true);
      const res = await fetch(`${IBGE_BASE}/estados?orderBy=nome`);
      const data: { sigla: string; nome: string }[] = await res.json();
      setEstados(
        data.map((e) => ({ label: `${e.sigla} - ${e.nome}`, value: e.sigla }))
      );
    } catch {
      console.error("Erro ao buscar estados");
    } finally {
      setLoadingEstados(false);
    }
  }

  async function fetchMunicipios(uf: string) {
    try {
      setLoadingMunicipios(true);
      const res = await fetch(
        `${IBGE_BASE}/estados/${uf}/municipios?orderBy=nome`
      );
      const data: { nome: string }[] = await res.json();
      setMunicipios(data.map((m) => ({ label: m.nome, value: m.nome })));
    } catch {
      console.error("Erro ao buscar municipios");
    } finally {
      setLoadingMunicipios(false);
    }
  }

  function handleChange(field: keyof typeof emptyForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleUfChange(uf: string) {
    setForm((prev) => ({ ...prev, uf, cidade: "" }));
  }

  const handleDocChange = useCallback(
    (value: string) => {
      const formatted =
        tipoPessoa === "PF" ? formatCPF(value) : formatCNPJ(value);
      setForm((prev) => ({ ...prev, cpfCnpj: formatted }));
      setDocError("");
    },
    [tipoPessoa]
  );

  function handleTipoPessoaChange(tipo: TipoPessoa) {
    setTipoPessoa(tipo);
    setForm((prev) => ({ ...prev, cpfCnpj: "" }));
    setDocError("");
  }

  function handleSave() {
    // Validar documento
    const digits = onlyDigits(form.cpfCnpj);
    if (digits.length > 0) {
      if (tipoPessoa === "PF" && !validateCPF(digits)) {
        setDocError("CPF invalido.");
        return;
      }
      if (tipoPessoa === "PJ" && !validateCNPJ(digits)) {
        setDocError("CNPJ invalido.");
        return;
      }
    }
    onSave(form);
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
                {isEditing ? "Editar Produtor" : "Novo Produtor"}
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
                  placeholder="Nome do produtor"
                  value={form.nome}
                  onChangeText={(v) => handleChange("nome", v)}
                />

                <Text style={styles.label}>Abreviacao</Text>
                <Input
                  placeholder="Abreviacao"
                  value={form.abreviacao}
                  onChangeText={(v) => handleChange("abreviacao", v)}
                />

                {/* Toggle PF / PJ */}
                <Text style={styles.label}>Tipo de Pessoa</Text>
                <View style={styles.toggleRow}>
                  <TouchableOpacity
                    style={[
                      styles.toggleButton,
                      tipoPessoa === "PF" && styles.toggleActive,
                    ]}
                    activeOpacity={0.8}
                    onPress={() => handleTipoPessoaChange("PF")}
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        tipoPessoa === "PF" && styles.toggleTextActive,
                      ]}
                    >
                      Pessoa Fisica
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.toggleButton,
                      tipoPessoa === "PJ" && styles.toggleActive,
                    ]}
                    activeOpacity={0.8}
                    onPress={() => handleTipoPessoaChange("PJ")}
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        tipoPessoa === "PJ" && styles.toggleTextActive,
                      ]}
                    >
                      Pessoa Juridica
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.label}>
                  {tipoPessoa === "PF" ? "CPF" : "CNPJ"}
                </Text>
                <Input
                  placeholder={
                    tipoPessoa === "PF"
                      ? "000.000.000-00"
                      : "00.000.000/0000-00"
                  }
                  value={form.cpfCnpj}
                  onChangeText={handleDocChange}
                  keyboardType="numeric"
                  maxLength={tipoPessoa === "PF" ? 14 : 18}
                />
                {!!docError && <Text style={styles.errorText}>{docError}</Text>}

                <Text style={styles.label}>Inscricao Estadual</Text>
                <Input
                  placeholder="Inscricao Estadual"
                  value={form.inscricaoEstadual}
                  onChangeText={(v) => handleChange("inscricaoEstadual", v)}
                />

                <Text style={styles.label}>Fazenda</Text>
                <Input
                  placeholder="Nome da fazenda"
                  value={form.fazenda}
                  onChangeText={(v) => handleChange("fazenda", v)}
                />

                <Text style={styles.label}>UF</Text>
                <Select
                  placeholder="Selecione o estado"
                  value={form.uf}
                  options={estados}
                  onSelect={handleUfChange}
                  loading={loadingEstados}
                />

                <Text style={styles.label}>Municipio</Text>
                <Select
                  placeholder="Selecione o municipio"
                  value={form.cidade}
                  options={municipios}
                  onSelect={(v) => handleChange("cidade", v)}
                  disabled={!form.uf}
                  loading={loadingMunicipios}
                />

                <Text style={styles.label}>Telefone</Text>
                <Input
                  placeholder="(00) 00000-0000"
                  value={form.telefone}
                  onChangeText={(v) => handleChange("telefone", v)}
                  keyboardType="phone-pad"
                />

                <Text style={styles.label}>E-mail</Text>
                <Input
                  placeholder="email@exemplo.com"
                  value={form.email}
                  onChangeText={(v) => handleChange("email", v)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

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
  errorText: {
    fontSize: 13,
    color: "#E53935",
    marginTop: 2,
  },
  buttonWrapper: {
    marginTop: 16,
  },
});
