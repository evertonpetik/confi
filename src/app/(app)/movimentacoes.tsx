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

type TipoMovimentacao = "entrada" | "saida" | "transferencia";

interface Movimentacao {
  id: string;
  tipo: TipoMovimentacao;
  dataHora: string;
  quantidade: number;
  chipIds?: string[];
  loteOrigem?: string;
  loteDestino?: string;
  municipioOrigem?: string;
  municipioDestino?: string;
  proprietarioOrigem?: string;
  proprietarioDestino?: string;
  gtaNumero?: string;
  gtaEmissao?: string;
  gtaValidade?: string;
  pesoMedio?: number;
  valor?: number;
  finalidade?: string;
  observacoes?: string;
  responsavel: string;
  farmedaId: string;
}

const FINALIDADES = [
  "Engorda",
  "Cria",
  "Recria",
  "Reprodução",
  "Abate",
  "Exposição",
  "Transferência entre propriedades",
  "Retorno",
  "Outro",
];

export default function Movimentacoes() {
  const { primaryColor } = useTheme();
  const { selectedFazendaId } = useAuth();
  const {
    isDesktop,
    containerPadding,
    titleFontSize,
    headerPaddingTop,
  } = useResponsive();

  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<TipoMovimentacao | "todos">("todos");

  // Form
  const [formTipo, setFormTipo] = useState<TipoMovimentacao>("entrada");
  const [formData, setFormData] = useState("");
  const [formQtd, setFormQtd] = useState("");
  const [formLoteOrigem, setFormLoteOrigem] = useState("");
  const [formLoteDestino, setFormLoteDestino] = useState("");
  const [formMunicOrigem, setFormMunicOrigem] = useState("");
  const [formMunicDestino, setFormMunicDestino] = useState("");
  const [formProprOrigem, setFormProprOrigem] = useState("");
  const [formProprDestino, setFormProprDestino] = useState("");
  const [formGta, setFormGta] = useState("");
  const [formGtaEmissao, setFormGtaEmissao] = useState("");
  const [formGtaValidade, setFormGtaValidade] = useState("");
  const [formPesoMedio, setFormPesoMedio] = useState("");
  const [formValor, setFormValor] = useState("");
  const [formFinalidade, setFormFinalidade] = useState(FINALIDADES[0]);
  const [formResponsavel, setFormResponsavel] = useState("");
  const [formObs, setFormObs] = useState("");

  const fazendaId = selectedFazendaId ?? "";

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setMovimentacoes([]);
    } finally {
      setCarregando(false);
    }
  }, [fazendaId]);

  useEffect(() => { carregar(); }, [carregar]);

  function abrirModal(tipo: TipoMovimentacao = "entrada") {
    setFormTipo(tipo);
    setFormData(new Date().toISOString().split("T")[0]);
    setFormQtd("");
    setFormLoteOrigem("");
    setFormLoteDestino("");
    setFormMunicOrigem("");
    setFormMunicDestino("");
    setFormProprOrigem("");
    setFormProprDestino("");
    setFormGta("");
    setFormGtaEmissao("");
    setFormGtaValidade("");
    setFormPesoMedio("");
    setFormValor("");
    setFormFinalidade(FINALIDADES[0]);
    setFormResponsavel("");
    setFormObs("");
    setModalVisible(true);
  }

  async function salvar() {
    if (!formQtd || !formData || !formResponsavel) {
      Alert.alert("Atenção", "Preencha quantidade, data e responsável.");
      return;
    }
    setSalvando(true);
    try {
      const nova: Movimentacao = {
        id: `mov_${Date.now()}`,
        tipo: formTipo,
        dataHora: new Date(formData).toISOString(),
        quantidade: parseInt(formQtd, 10),
        loteOrigem: formLoteOrigem || undefined,
        loteDestino: formLoteDestino || undefined,
        municipioOrigem: formMunicOrigem || undefined,
        municipioDestino: formMunicDestino || undefined,
        proprietarioOrigem: formProprOrigem || undefined,
        proprietarioDestino: formProprDestino || undefined,
        gtaNumero: formGta || undefined,
        gtaEmissao: formGtaEmissao ? new Date(formGtaEmissao).toISOString() : undefined,
        gtaValidade: formGtaValidade ? new Date(formGtaValidade).toISOString() : undefined,
        pesoMedio: formPesoMedio ? parseFloat(formPesoMedio) : undefined,
        valor: formValor ? parseFloat(formValor) : undefined,
        finalidade: formFinalidade,
        responsavel: formResponsavel,
        observacoes: formObs || undefined,
        farmedaId: fazendaId,
      };
      setMovimentacoes((prev) => [nova, ...prev]);
      setModalVisible(false);
    } finally {
      setSalvando(false);
    }
  }

  const filtradas = filtroTipo === "todos"
    ? movimentacoes
    : movimentacoes.filter((m) => m.tipo === filtroTipo);

  function formatarData(iso: string) {
    try {
      return new Date(iso).toLocaleDateString("pt-BR");
    } catch {
      return iso;
    }
  }

  function configTipo(tipo: TipoMovimentacao) {
    if (tipo === "entrada") return { label: "Entrada", cor: "#4CAF50", icon: "arrow-down-circle" as const };
    if (tipo === "saida") return { label: "Saída", cor: "#E53935", icon: "arrow-up-circle" as const };
    return { label: "Transferência", cor: "#2196F3", icon: "shuffle" as const };
  }

  const totalEntrada = movimentacoes.filter((m) => m.tipo === "entrada").reduce((s, m) => s + m.quantidade, 0);
  const totalSaida = movimentacoes.filter((m) => m.tipo === "saida").reduce((s, m) => s + m.quantidade, 0);
  const saldoAtual = totalEntrada - totalSaida;

  function renderItem({ item }: { item: Movimentacao }) {
    const { label, cor, icon } = configTipo(item.tipo);
    return (
      <View style={styles.card}>
        <View style={[styles.cardIcone, { backgroundColor: cor + "18" }]}>
          <Feather name={icon} size={22} color={cor} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={[styles.cardTipo, { color: cor }]}>{label}</Text>
            <Text style={styles.cardData}>{formatarData(item.dataHora)}</Text>
          </View>
          <Text style={styles.cardQtd}>{item.quantidade} animais</Text>
          {item.gtaNumero && (
            <Text style={styles.cardGta}>
              <Feather name="file-text" size={11} color="#888" /> GTA: {item.gtaNumero}
            </Text>
          )}
          {item.finalidade && <Text style={styles.cardSub}>{item.finalidade}</Text>}
          {(item.municipioOrigem || item.municipioDestino) && (
            <Text style={styles.cardSub}>
              {item.municipioOrigem && `De: ${item.municipioOrigem}`}
              {item.municipioOrigem && item.municipioDestino && " → "}
              {item.municipioDestino && item.municipioDestino}
            </Text>
          )}
        </View>
        {item.pesoMedio && (
          <View>
            <Text style={[styles.cardPeso, { color: primaryColor }]}>{item.pesoMedio} kg</Text>
            <Text style={styles.cardPesoLabel}>peso médio</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <DrawerSceneWrapper>
      <View style={{ flex: 1, backgroundColor: "#FDFDFD" }}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: headerPaddingTop, paddingHorizontal: containerPadding }]}>
          <Text style={[styles.titulo, { fontSize: titleFontSize, flex: 1 }]} numberOfLines={1}>
            Movimentações
          </Text>
          <TouchableOpacity
            style={[styles.btnNovo, { backgroundColor: primaryColor }]}
            onPress={() => abrirModal()}
            activeOpacity={0.8}
          >
            <Feather name="plus" size={18} color="#fff" />
            <Text style={styles.btnNovoText}>Nova</Text>
          </TouchableOpacity>
          {!isDesktop && <DrawerToggleButton tintColor="#000" />}
        </View>

        {/* Resumo saldo */}
        <View style={[styles.saldoRow, { marginHorizontal: containerPadding }]}>
          <View style={[styles.saldoCard, { borderLeftColor: "#4CAF50" }]}>
            <Text style={styles.saldoNum}>{totalEntrada}</Text>
            <Text style={styles.saldoLabel}>Entradas</Text>
          </View>
          <View style={[styles.saldoCard, { borderLeftColor: "#E53935" }]}>
            <Text style={styles.saldoNum}>{totalSaida}</Text>
            <Text style={styles.saldoLabel}>Saídas</Text>
          </View>
          <View style={[styles.saldoCard, { borderLeftColor: primaryColor, backgroundColor: "#F0F8F0" }]}>
            <Text style={[styles.saldoNum, { color: primaryColor }]}>{saldoAtual}</Text>
            <Text style={styles.saldoLabel}>Saldo atual</Text>
          </View>
        </View>

        {/* Filtro rápido */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: containerPadding, gap: 8, paddingVertical: 8 }}
        >
          {(["todos", "entrada", "saida", "transferencia"] as const).map((t) => {
            const config = t === "todos"
              ? { label: "Todos", cor: "#888" }
              : configTipo(t);
            return (
              <TouchableOpacity
                key={t}
                style={[
                  styles.filtroChip,
                  filtroTipo === t && { backgroundColor: (config as any).cor ?? primaryColor, borderColor: (config as any).cor ?? primaryColor },
                ]}
                onPress={() => setFiltroTipo(t)}
              >
                <Text style={[styles.filtroChipText, filtroTipo === t && { color: "#fff" }]}>
                  {(config as any).label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Lista */}
        {carregando ? (
          <View style={styles.centro}>
            <ActivityIndicator size="large" color={primaryColor} />
          </View>
        ) : (
          <FlatList
            data={filtradas}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingHorizontal: containerPadding, paddingBottom: 32 }}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.centro}>
                <Feather name="shuffle" size={48} color="#ddd" />
                <Text style={styles.emptyText}>Nenhuma movimentação registrada.</Text>
                <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                  {(["entrada", "saida", "transferencia"] as const).map((t) => {
                    const { label, cor } = configTipo(t);
                    return (
                      <TouchableOpacity
                        key={t}
                        style={[styles.btnNovo, { backgroundColor: cor }]}
                        onPress={() => abrirModal(t)}
                      >
                        <Feather name="plus" size={14} color="#fff" />
                        <Text style={styles.btnNovoText}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            }
          />
        )}

        {/* Modal */}
        <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
          <ScrollView contentContainerStyle={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitulo}>Nova Movimentação</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Feather name="x" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {/* Tipo */}
            <Text style={styles.label}>Tipo *</Text>
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
              {(["entrada", "saida", "transferencia"] as const).map((t) => {
                const { label, cor } = configTipo(t);
                return (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.tipoBtn,
                      formTipo === t && { backgroundColor: cor, borderColor: cor },
                    ]}
                    onPress={() => setFormTipo(t)}
                  >
                    <Text style={[styles.tipoBtnText, formTipo === t && { color: "#fff" }]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>Data *</Text>
            <TextInput style={styles.input} value={formData} onChangeText={setFormData} placeholder="AAAA-MM-DD" />

            <Text style={styles.label}>Quantidade de animais *</Text>
            <TextInput style={styles.input} value={formQtd} onChangeText={setFormQtd} keyboardType="numeric" placeholder="Ex: 50" />

            {/* GTA */}
            <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Guia de Transporte Animal (GTA)</Text>

            <Text style={styles.label}>Número da GTA</Text>
            <TextInput style={styles.input} value={formGta} onChangeText={setFormGta} placeholder="Ex: GTA-SP-12345" />

            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Emissão</Text>
                <TextInput style={styles.input} value={formGtaEmissao} onChangeText={setFormGtaEmissao} placeholder="AAAA-MM-DD" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Validade</Text>
                <TextInput style={styles.input} value={formGtaValidade} onChangeText={setFormGtaValidade} placeholder="AAAA-MM-DD" />
              </View>
            </View>

            {/* Origem e Destino */}
            <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Origem</Text>
            <Text style={styles.label}>Município de Origem</Text>
            <TextInput style={styles.input} value={formMunicOrigem} onChangeText={setFormMunicOrigem} placeholder="Ex: Barretos - SP" />
            <Text style={styles.label}>Proprietário / Fazenda de Origem</Text>
            <TextInput style={styles.input} value={formProprOrigem} onChangeText={setFormProprOrigem} placeholder="Nome do proprietário" />
            <Text style={styles.label}>Lote de Origem</Text>
            <TextInput style={styles.input} value={formLoteOrigem} onChangeText={setFormLoteOrigem} placeholder="Ex: Pasto Norte, Confinamento A" />

            <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Destino</Text>
            <Text style={styles.label}>Município de Destino</Text>
            <TextInput style={styles.input} value={formMunicDestino} onChangeText={setFormMunicDestino} placeholder="Ex: Ribeirão Preto - SP" />
            <Text style={styles.label}>Proprietário / Fazenda de Destino</Text>
            <TextInput style={styles.input} value={formProprDestino} onChangeText={setFormProprDestino} placeholder="Nome do proprietário" />
            <Text style={styles.label}>Lote de Destino</Text>
            <TextInput style={styles.input} value={formLoteDestino} onChangeText={setFormLoteDestino} placeholder="Ex: Pasto Sul, Lote 2" />

            {/* Dados complementares */}
            <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Dados Complementares</Text>

            <Text style={styles.label}>Finalidade</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {FINALIDADES.map((f) => (
                  <TouchableOpacity
                    key={f}
                    style={[
                      styles.filtroChip,
                      formFinalidade === f && { backgroundColor: primaryColor, borderColor: primaryColor },
                    ]}
                    onPress={() => setFormFinalidade(f)}
                  >
                    <Text style={[styles.filtroChipText, formFinalidade === f && { color: "#fff" }]}>{f}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Peso Médio (kg)</Text>
                <TextInput style={styles.input} value={formPesoMedio} onChangeText={setFormPesoMedio} keyboardType="numeric" placeholder="Ex: 320" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Valor Total (R$)</Text>
                <TextInput style={styles.input} value={formValor} onChangeText={setFormValor} keyboardType="numeric" placeholder="Ex: 15000.00" />
              </View>
            </View>

            <Text style={styles.label}>Responsável *</Text>
            <TextInput style={styles.input} value={formResponsavel} onChangeText={setFormResponsavel} placeholder="Nome do responsável" />

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
                <Text style={styles.btnSalvarText}>Salvar Movimentação</Text>
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
  saldoRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 4,
  },
  saldoCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  saldoNum: {
    fontSize: 22,
    fontWeight: "900",
    color: "#1a1a1a",
  },
  saldoLabel: {
    fontSize: 11,
    color: "#888",
    marginTop: 2,
  },
  filtroChip: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: "#fff",
  },
  filtroChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#555",
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
  cardTipo: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  cardData: {
    fontSize: 12,
    color: "#888",
  },
  cardQtd: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1a1a1a",
    marginTop: 2,
  },
  cardGta: {
    fontSize: 12,
    color: "#888",
    marginTop: 2,
  },
  cardSub: {
    fontSize: 12,
    color: "#aaa",
    marginTop: 1,
  },
  cardPeso: {
    fontSize: 16,
    fontWeight: "900",
    textAlign: "right",
  },
  cardPesoLabel: {
    fontSize: 10,
    color: "#aaa",
    textAlign: "right",
  },
  centro: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
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
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    paddingBottom: 6,
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
    alignItems: "center",
    justifyContent: "center",
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
