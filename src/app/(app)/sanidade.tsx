import { DrawerSceneWrapper } from "@/components/drawe-scene-wrapper";
import { DrawerToggleButton } from "@/components/DrawerToggleButton";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useResponsive } from "@/hooks/useResponsive";
import { Feather } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface VacinaVermifugo {
  id: string;
  tipo: "vacina" | "vermifugo" | "medicamento";
  nome: string;
  dataAplicacao: string;
  dataProxima?: string;
  chipId?: string;
  nomeAnimal?: string;
  lote?: string;
  dose?: string;
  responsavel: string;
  observacoes?: string;
  farmedaId: string;
}

const TIPOS_VACINA = [
  "Febre Aftosa",
  "Brucelose",
  "Raiva",
  "Clostridiose",
  "IBR/BVD",
  "Leptospirose",
  "Carbúnculo Sintomático",
  "Botulismo",
  "Outro",
];

const TIPOS_VERMIFUGO = [
  "Ivermectina",
  "Doramectina",
  "Albendazol",
  "Levamisol",
  "Moxidectina",
  "Outro",
];

export default function Sanidade() {
  const { primaryColor } = useTheme();
  const { selectedFazendaId } = useAuth();
  const {
    isDesktop,
    containerPadding,
    titleFontSize,
    headerPaddingTop,
  } = useResponsive();

  const [registros, setRegistros] = useState<VacinaVermifugo[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [tabAtiva, setTabAtiva] = useState<"historico" | "agenda">("historico");

  // Form
  const [formTipoRegistro, setFormTipoRegistro] = useState<VacinaVermifugo["tipo"]>("vacina");
  const [formNome, setFormNome] = useState("");
  const [formNomeOutro, setFormNomeOutro] = useState("");
  const [formData, setFormData] = useState("");
  const [formProxima, setFormProxima] = useState("");
  const [formAnimal, setFormAnimal] = useState("");
  const [formLote, setFormLote] = useState("");
  const [formDose, setFormDose] = useState("");
  const [formResponsavel, setFormResponsavel] = useState("");
  const [formObs, setFormObs] = useState("");

  const fazendaId = selectedFazendaId ?? "";

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      // Placeholder: carregar do Firestore
      setRegistros([]);
    } finally {
      setCarregando(false);
    }
  }, [fazendaId]);

  useEffect(() => { carregar(); }, [carregar]);

  function abrirModal() {
    setFormTipoRegistro("vacina");
    setFormNome(TIPOS_VACINA[0]);
    setFormNomeOutro("");
    setFormData(new Date().toISOString().split("T")[0]);
    setFormProxima("");
    setFormAnimal("");
    setFormLote("");
    setFormDose("");
    setFormResponsavel("");
    setFormObs("");
    setModalVisible(true);
  }

  async function salvar() {
    const nomeEfetivo = formNome === "Outro" ? formNomeOutro : formNome;
    if (!nomeEfetivo || !formData || !formResponsavel) {
      Alert.alert("Atenção", "Preencha nome, data e responsável.");
      return;
    }
    setSalvando(true);
    try {
      const novo: VacinaVermifugo = {
        id: `san_${Date.now()}`,
        tipo: formTipoRegistro,
        nome: nomeEfetivo,
        dataAplicacao: new Date(formData).toISOString(),
        dataProxima: formProxima ? new Date(formProxima).toISOString() : undefined,
        chipId: formAnimal || undefined,
        nomeAnimal: formAnimal || undefined,
        lote: formLote || undefined,
        dose: formDose || undefined,
        responsavel: formResponsavel,
        observacoes: formObs || undefined,
        farmedaId: fazendaId,
      };
      setRegistros((prev) => [novo, ...prev]);
      setModalVisible(false);
    } finally {
      setSalvando(false);
    }
  }

  const hoje = new Date().toISOString().split("T")[0];
  const agenda = registros
    .filter((r) => r.dataProxima && r.dataProxima >= hoje)
    .sort((a, b) => (a.dataProxima! > b.dataProxima! ? 1 : -1));

  const historico = [...registros].sort((a, b) =>
    a.dataAplicacao > b.dataAplicacao ? -1 : 1
  );

  function iconeRegistro(tipo: VacinaVermifugo["tipo"]) {
    if (tipo === "vacina") return "shield";
    if (tipo === "vermifugo") return "zap";
    return "plus-circle";
  }

  function corRegistro(tipo: VacinaVermifugo["tipo"]) {
    if (tipo === "vacina") return "#4CAF50";
    if (tipo === "vermifugo") return "#FF9800";
    return "#2196F3";
  }

  function formatarData(iso: string) {
    try {
      return new Date(iso).toLocaleDateString("pt-BR");
    } catch {
      return iso;
    }
  }

  function diasParaProxima(iso: string) {
    const diff = new Date(iso).getTime() - Date.now();
    const dias = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (dias < 0) return `${Math.abs(dias)} dias atrasado`;
    if (dias === 0) return "Hoje!";
    return `em ${dias} dias`;
  }

  function renderItem({ item }: { item: VacinaVermifugo }) {
    const cor = corRegistro(item.tipo);
    const atrasado = item.dataProxima && item.dataProxima < hoje;
    return (
      <View style={styles.card}>
        <View style={[styles.cardIcone, { backgroundColor: cor + "18" }]}>
          <Feather name={iconeRegistro(item.tipo) as any} size={22} color={cor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardNome}>{item.nome}</Text>
          <Text style={styles.cardInfo}>
            {item.tipo.charAt(0).toUpperCase() + item.tipo.slice(1)} ·{" "}
            {formatarData(item.dataAplicacao)}
          </Text>
          {item.nomeAnimal ? (
            <Text style={styles.cardSubInfo}>Animal: {item.nomeAnimal}</Text>
          ) : item.lote ? (
            <Text style={styles.cardSubInfo}>Lote: {item.lote}</Text>
          ) : null}
          {item.dose && <Text style={styles.cardSubInfo}>Dose: {item.dose}</Text>}
        </View>
        {item.dataProxima && (
          <View style={[styles.proxTag, atrasado ? styles.proxTagAtrasado : {}]}>
            <Text style={[styles.proxText, atrasado ? { color: "#E53935" } : { color: primaryColor }]}>
              {tabAtiva === "agenda" ? diasParaProxima(item.dataProxima) : `Próx: ${formatarData(item.dataProxima)}`}
            </Text>
          </View>
        )}
      </View>
    );
  }

  const opcoes = formTipoRegistro === "vacina"
    ? TIPOS_VACINA
    : formTipoRegistro === "vermifugo"
    ? TIPOS_VERMIFUGO
    : ["Antibiótico", "Anti-inflamatório", "Suplemento", "Outro"];

  return (
    <DrawerSceneWrapper>
      <View style={{ flex: 1, backgroundColor: "#FDFDFD" }}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: headerPaddingTop, paddingHorizontal: containerPadding }]}>
          <Text style={[styles.titulo, { fontSize: titleFontSize, flex: 1 }]} numberOfLines={1}>
            Sanidade
          </Text>
          <TouchableOpacity
            style={[styles.btnNovo, { backgroundColor: primaryColor }]}
            onPress={abrirModal}
            activeOpacity={0.8}
          >
            <Feather name="plus" size={18} color="#fff" />
            <Text style={styles.btnNovoText}>Registrar</Text>
          </TouchableOpacity>
          {!isDesktop && <DrawerToggleButton tintColor="#000" />}
        </View>

        {/* Resumo */}
        <View style={[styles.resumoRow, { paddingHorizontal: containerPadding }]}>
          <View style={[styles.resumoCard, { borderLeftColor: "#4CAF50" }]}>
            <Text style={styles.resumoNum}>{registros.filter((r) => r.tipo === "vacina").length}</Text>
            <Text style={styles.resumoLabel}>Vacinações</Text>
          </View>
          <View style={[styles.resumoCard, { borderLeftColor: "#FF9800" }]}>
            <Text style={styles.resumoNum}>{registros.filter((r) => r.tipo === "vermifugo").length}</Text>
            <Text style={styles.resumoLabel}>Vermifugações</Text>
          </View>
          <View style={[styles.resumoCard, { borderLeftColor: "#E53935" }]}>
            <Text style={styles.resumoNum}>{agenda.length}</Text>
            <Text style={styles.resumoLabel}>Na agenda</Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={[styles.tabs, { marginHorizontal: containerPadding }]}>
          {(["historico", "agenda"] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.tab, tabAtiva === t && { borderBottomColor: primaryColor }]}
              onPress={() => setTabAtiva(t)}
            >
              <Text style={[styles.tabText, tabAtiva === t && { color: primaryColor }]}>
                {t === "historico" ? "Histórico" : `Agenda (${agenda.length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Lista */}
        {carregando ? (
          <View style={styles.centro}>
            <ActivityIndicator size="large" color={primaryColor} />
          </View>
        ) : (
          <FlatList
            data={tabAtiva === "historico" ? historico : agenda}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingHorizontal: containerPadding, paddingBottom: 32, paddingTop: 8 }}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.centro}>
                <Feather name="shield" size={48} color="#ddd" />
                <Text style={styles.emptyText}>
                  {tabAtiva === "historico"
                    ? "Nenhum registro de sanidade."
                    : "Nenhum evento agendado."}
                </Text>
                <TouchableOpacity
                  style={[styles.btnNovo, { backgroundColor: primaryColor, marginTop: 12 }]}
                  onPress={abrirModal}
                >
                  <Feather name="plus" size={16} color="#fff" />
                  <Text style={styles.btnNovoText}>Registrar agora</Text>
                </TouchableOpacity>
              </View>
            }
          />
        )}

        {/* Modal */}
        <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
          <ScrollView contentContainerStyle={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitulo}>Novo Registro</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Feather name="x" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Tipo de registro *</Text>
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
              {(["vacina", "vermifugo", "medicamento"] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.tipoBtn,
                    formTipoRegistro === t && { backgroundColor: primaryColor, borderColor: primaryColor },
                  ]}
                  onPress={() => {
                    setFormTipoRegistro(t);
                    const lista = t === "vacina" ? TIPOS_VACINA : t === "vermifugo" ? TIPOS_VERMIFUGO : ["Antibiótico"];
                    setFormNome(lista[0]);
                  }}
                >
                  <Feather
                    name={iconeRegistro(t) as any}
                    size={16}
                    color={formTipoRegistro === t ? "#fff" : "#555"}
                  />
                  <Text style={[styles.tipoBtnText, formTipoRegistro === t && { color: "#fff" }]}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Produto *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {opcoes.map((o) => (
                  <TouchableOpacity
                    key={o}
                    style={[
                      styles.categoriaChip,
                      formNome === o && { backgroundColor: primaryColor, borderColor: primaryColor },
                    ]}
                    onPress={() => setFormNome(o)}
                  >
                    <Text style={[styles.categoriaChipText, formNome === o && { color: "#fff" }]}>{o}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {formNome === "Outro" && (
              <>
                <Text style={styles.label}>Nome do produto *</Text>
                <TextInput
                  style={styles.input}
                  value={formNomeOutro}
                  onChangeText={setFormNomeOutro}
                  placeholder="Informe o produto"
                />
              </>
            )}

            <Text style={styles.label}>Data de aplicação *</Text>
            <TextInput
              style={styles.input}
              value={formData}
              onChangeText={setFormData}
              placeholder="AAAA-MM-DD"
            />

            <Text style={styles.label}>Próxima aplicação</Text>
            <TextInput
              style={styles.input}
              value={formProxima}
              onChangeText={setFormProxima}
              placeholder="AAAA-MM-DD (opcional)"
            />

            <Text style={styles.label}>Animal / SISBOV (deixe vazio para lote inteiro)</Text>
            <TextInput
              style={styles.input}
              value={formAnimal}
              onChangeText={setFormAnimal}
              placeholder="Ex: 000000000000001 ou #1234"
            />

            <Text style={styles.label}>Lote / Piquete</Text>
            <TextInput
              style={styles.input}
              value={formLote}
              onChangeText={setFormLote}
              placeholder="Ex: Lote A, Pasto 3..."
            />

            <Text style={styles.label}>Dose / Quantidade</Text>
            <TextInput
              style={styles.input}
              value={formDose}
              onChangeText={setFormDose}
              placeholder="Ex: 5ml, 1 comp."
            />

            <Text style={styles.label}>Responsável *</Text>
            <TextInput
              style={styles.input}
              value={formResponsavel}
              onChangeText={setFormResponsavel}
              placeholder="Nome do responsável"
            />

            <Text style={styles.label}>Observações</Text>
            <TextInput
              style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]}
              value={formObs}
              onChangeText={setFormObs}
              placeholder="Observações opcionais..."
              multiline
            />

            <TouchableOpacity
              style={[styles.btnSalvar, { backgroundColor: primaryColor }]}
              onPress={salvar}
              disabled={salvando}
            >
              {salvando ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnSalvarText}>Salvar Registro</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </Modal>
      </View>
    </DrawerSceneWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 8,
  },
  titulo: {
    fontWeight: "900",
    color: "#1a1a1a",
  },
  btnNovo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  btnNovoText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  resumoRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  resumoCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  resumoNum: {
    fontSize: 24,
    fontWeight: "900",
    color: "#1a1a1a",
  },
  resumoLabel: {
    fontSize: 11,
    color: "#888",
    marginTop: 2,
  },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    marginBottom: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#999",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  cardIcone: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  cardNome: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  cardInfo: {
    fontSize: 12,
    color: "#888",
    marginTop: 2,
  },
  cardSubInfo: {
    fontSize: 12,
    color: "#aaa",
    marginTop: 1,
  },
  proxTag: {
    backgroundColor: "#F0F8FF",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: "center",
  },
  proxTagAtrasado: {
    backgroundColor: "#FFF0F0",
  },
  proxText: {
    fontSize: 11,
    fontWeight: "700",
  },
  centro: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 15,
    color: "#aaa",
    textAlign: "center",
  },
  modal: {
    padding: 24,
    paddingBottom: 48,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  modalTitulo: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1a1a1a",
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#555",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: "#1a1a1a",
    marginBottom: 16,
    backgroundColor: "#FAFAFA",
  },
  tipoBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  tipoBtnText: {
    fontWeight: "600",
    fontSize: 13,
    color: "#555",
  },
  categoriaChip: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: "#fff",
  },
  categoriaChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#555",
  },
  btnSalvar: {
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  btnSalvarText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
});
