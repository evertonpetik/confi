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
import {
  CategoriaBovino,
  Bovino,
} from "@/services/weighing.types";
import { PesagemFirestoreService } from "@/services/pesagemFirestoreService";

type FiltroCategoria = "todos" | CategoriaBovino;

const CATEGORIAS: { label: string; value: FiltroCategoria }[] = [
  { label: "Todos", value: "todos" },
  { label: "Bezerros", value: CategoriaBovino.BEZERRO },
  { label: "Novilhos", value: CategoriaBovino.NOVILHO },
  { label: "Novilhas", value: CategoriaBovino.NOVILHA },
  { label: "Vacas", value: CategoriaBovino.VACAS },
  { label: "Bois", value: CategoriaBovino.BOIS },
  { label: "Touros", value: CategoriaBovino.TOUROS },
];

const RACAS = ["Nelore", "Angus", "Brahman", "Hereford", "Gir", "Senepol", "Brangus", "Tabapuã", "Canchim", "Limousin", "Outro"];

export default function Animais() {
  const { primaryColor } = useTheme();
  const { selectedFazendaId } = useAuth();
  const { isTablet, isDesktop, maxWidthContent, containerPadding, titleFontSize, headerPaddingTop } = useResponsive();

  const [animais, setAnimais] = useState<Bovino[]>([]);
  const [filtrados, setFiltrados] = useState<Bovino[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [termo, setTermo] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState<FiltroCategoria>("todos");
  const [modalVisible, setModalVisible] = useState(false);
  const [animalSelecionado, setAnimalSelecionado] = useState<Bovino | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Form state
  const [formChipId, setFormChipId] = useState("");
  const [formNome, setFormNome] = useState("");
  const [formCategoria, setFormCategoria] = useState<CategoriaBovino>(CategoriaBovino.NOVILHO);
  const [formRaca, setFormRaca] = useState("Nelore");
  const [formSexo, setFormSexo] = useState<"M" | "F">("M");
  const [formNascimento, setFormNascimento] = useState("");
  const [formPesoEntrada, setFormPesoEntrada] = useState("");

  const fazendaId = selectedFazendaId ?? "";

  const carregar = useCallback(async () => {
    if (!fazendaId) return;
    setCarregando(true);
    try {
      const lista = await PesagemFirestoreService.listarBovinos(fazendaId);
      setAnimais(lista);
      setFiltrados(lista);
    } catch (e) {
      Alert.alert("Erro", "Não foi possível carregar os animais.");
    } finally {
      setCarregando(false);
    }
  }, [fazendaId]);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    let lista = animais;
    if (filtroCategoria !== "todos") {
      lista = lista.filter((a) => a.categoria === filtroCategoria);
    }
    if (termo) {
      const t = termo.toLowerCase();
      lista = lista.filter(
        (a) =>
          a.nome.toLowerCase().includes(t) ||
          a.chipId.includes(termo) ||
          a.raca.toLowerCase().includes(t)
      );
    }
    setFiltrados(lista);
  }, [animais, filtroCategoria, termo]);

  function abrirNovoAnimal() {
    setAnimalSelecionado(null);
    setFormChipId("");
    setFormNome("");
    setFormCategoria(CategoriaBovino.NOVILHO);
    setFormRaca("Nelore");
    setFormSexo("M");
    setFormNascimento("");
    setFormPesoEntrada("");
    setModalVisible(true);
  }

  function abrirEditar(animal: Bovino) {
    setAnimalSelecionado(animal);
    setFormChipId(animal.chipId);
    setFormNome(animal.nome);
    setFormCategoria(animal.categoria);
    setFormRaca(animal.raca);
    setFormSexo(animal.sexo);
    setFormNascimento(animal.dataNascimento.split("T")[0]);
    setFormPesoEntrada(animal.pesoEntrada?.toString() ?? "");
    setModalVisible(true);
  }

  async function salvar() {
    if (!formChipId || formChipId.length !== 15 || !/^\d+$/.test(formChipId)) {
      Alert.alert("Atenção", "O número SISBOV deve ter exatamente 15 dígitos numéricos.");
      return;
    }
    if (!formNome.trim()) {
      Alert.alert("Atenção", "Informe um nome ou identificação para o animal.");
      return;
    }
    setSalvando(true);
    try {
      const dados: Omit<Bovino, "id"> = {
        chipId: formChipId,
        nome: formNome.trim(),
        categoria: formCategoria,
        raca: formRaca,
        sexo: formSexo,
        dataNascimento: formNascimento ? new Date(formNascimento).toISOString() : new Date().toISOString(),
        pesoEntrada: formPesoEntrada ? parseFloat(formPesoEntrada) : undefined,
        farmedaId: fazendaId,
      };

      if (animalSelecionado?.id) {
        await PesagemFirestoreService.atualizarBovino({ ...dados, id: animalSelecionado.id }, fazendaId);
      } else {
        await PesagemFirestoreService.salvarBovino({ ...dados, id: `bovino_${Date.now()}` }, fazendaId);
      }

      setModalVisible(false);
      carregar();
    } catch (e) {
      Alert.alert("Erro", "Não foi possível salvar o animal.");
    } finally {
      setSalvando(false);
    }
  }

  const corCategoria: Record<string, string> = {
    bezerro: "#FF9800",
    novilho: "#2196F3",
    novilha: "#E91E63",
    touros: "#9C27B0",
    vacas: "#4CAF50",
    bois: "#607D8B",
  };

  function renderAnimal({ item }: { item: Bovino }) {
    const cor = corCategoria[item.categoria] ?? "#888";
    return (
      <TouchableOpacity style={styles.card} onPress={() => abrirEditar(item)} activeOpacity={0.75}>
        <View style={[styles.categoriaTag, { backgroundColor: cor + "22" }]}>
          <Text style={[styles.categoriaText, { color: cor }]}>
            {item.categoria.charAt(0).toUpperCase() + item.categoria.slice(1)}
          </Text>
        </View>
        <View style={styles.cardBody}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardNome}>{item.nome}</Text>
            <Text style={styles.cardChip}>
              <Feather name="radio" size={12} color="#888" /> {item.chipId}
            </Text>
            <Text style={styles.cardInfo}>{item.raca} · {item.sexo === "M" ? "Macho" : "Fêmea"}</Text>
          </View>
          <View style={styles.cardRight}>
            {item.pesoAnterior ? (
              <>
                <Text style={[styles.cardPeso, { color: primaryColor }]}>{item.pesoAnterior} kg</Text>
                <Text style={styles.cardPesoLabel}>últ. pesagem</Text>
              </>
            ) : item.pesoEntrada ? (
              <>
                <Text style={[styles.cardPeso, { color: primaryColor }]}>{item.pesoEntrada} kg</Text>
                <Text style={styles.cardPesoLabel}>entrada</Text>
              </>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  const totalPorCategoria = CATEGORIAS.filter((c) => c.value !== "todos").map((c) => ({
    ...c,
    total: animais.filter((a) => a.categoria === c.value).length,
  }));

  return (
    <DrawerSceneWrapper>
      <View style={{ flex: 1, backgroundColor: "#FDFDFD" }}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: headerPaddingTop, paddingHorizontal: containerPadding }]}>
          <Text style={[styles.titulo, { fontSize: titleFontSize, flex: 1 }]} numberOfLines={1}>
            Rebanho
          </Text>
          <TouchableOpacity
            style={[styles.btnNovo, { backgroundColor: primaryColor }]}
            onPress={abrirNovoAnimal}
            activeOpacity={0.8}
          >
            <Feather name="plus" size={18} color="#fff" />
            <Text style={styles.btnNovoText}>Novo</Text>
          </TouchableOpacity>
          {!isDesktop && <DrawerToggleButton tintColor="#000" />}
        </View>

        {/* Resumo por categoria */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: containerPadding, paddingVertical: 8, gap: 8 }}
        >
          {totalPorCategoria.filter((c) => c.total > 0).map((c) => (
            <TouchableOpacity
              key={c.value}
              style={[
                styles.categoriaChip,
                filtroCategoria === c.value && { backgroundColor: primaryColor, borderColor: primaryColor },
              ]}
              onPress={() => setFiltroCategoria(filtroCategoria === c.value ? "todos" : c.value)}
            >
              <Text style={[
                styles.categoriaChipText,
                filtroCategoria === c.value && { color: "#fff" },
              ]}>
                {c.label} ({c.total})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Busca */}
        <View style={[styles.busca, { marginHorizontal: containerPadding }]}>
          <Feather name="search" size={16} color="#999" />
          <TextInput
            style={styles.buscaInput}
            placeholder="Buscar por nome, SISBOV ou raça..."
            placeholderTextColor="#bbb"
            value={termo}
            onChangeText={setTermo}
          />
          {termo ? (
            <TouchableOpacity onPress={() => setTermo("")}>
              <Feather name="x" size={16} color="#999" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Lista */}
        {carregando ? (
          <View style={styles.centro}>
            <ActivityIndicator size="large" color={primaryColor} />
          </View>
        ) : filtrados.length === 0 ? (
          <View style={styles.centro}>
            <Feather name="inbox" size={48} color="#ddd" />
            <Text style={styles.emptyText}>
              {animais.length === 0 ? "Nenhum animal cadastrado." : "Nenhum resultado encontrado."}
            </Text>
            {animais.length === 0 && (
              <TouchableOpacity
                style={[styles.btnNovo, { backgroundColor: primaryColor, marginTop: 16 }]}
                onPress={abrirNovoAnimal}
              >
                <Feather name="plus" size={18} color="#fff" />
                <Text style={styles.btnNovoText}>Cadastrar primeiro animal</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <FlatList
            data={filtrados}
            keyExtractor={(item) => item.id}
            renderItem={renderAnimal}
            contentContainerStyle={{ paddingHorizontal: containerPadding, paddingBottom: 32 }}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Modal cadastro/edição */}
        <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
          <ScrollView contentContainerStyle={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitulo}>
                {animalSelecionado ? "Editar Animal" : "Novo Animal"}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Feather name="x" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Número SISBOV (15 dígitos) *</Text>
            <TextInput
              style={styles.input}
              value={formChipId}
              onChangeText={setFormChipId}
              placeholder="000000000000000"
              keyboardType="numeric"
              maxLength={15}
            />

            <Text style={styles.label}>Nome / Identificação *</Text>
            <TextInput
              style={styles.input}
              value={formNome}
              onChangeText={setFormNome}
              placeholder="Ex: #1234 ou Mimosa"
            />

            <Text style={styles.label}>Categoria *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {CATEGORIAS.filter((c) => c.value !== "todos").map((c) => (
                  <TouchableOpacity
                    key={c.value}
                    style={[
                      styles.categoriaChip,
                      formCategoria === c.value && { backgroundColor: primaryColor, borderColor: primaryColor },
                    ]}
                    onPress={() => setFormCategoria(c.value as CategoriaBovino)}
                  >
                    <Text style={[styles.categoriaChipText, formCategoria === c.value && { color: "#fff" }]}>
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={styles.label}>Raça *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {RACAS.map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[
                      styles.categoriaChip,
                      formRaca === r && { backgroundColor: primaryColor, borderColor: primaryColor },
                    ]}
                    onPress={() => setFormRaca(r)}
                  >
                    <Text style={[styles.categoriaChipText, formRaca === r && { color: "#fff" }]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={styles.label}>Sexo *</Text>
            <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
              {(["M", "F"] as const).map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.sexoBtn,
                    formSexo === s && { backgroundColor: primaryColor, borderColor: primaryColor },
                  ]}
                  onPress={() => setFormSexo(s)}
                >
                  <Text style={[styles.sexoBtnText, formSexo === s && { color: "#fff" }]}>
                    {s === "M" ? "Macho" : "Fêmea"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Data de Nascimento</Text>
            <TextInput
              style={styles.input}
              value={formNascimento}
              onChangeText={setFormNascimento}
              placeholder="AAAA-MM-DD"
            />

            <Text style={styles.label}>Peso de Entrada (kg)</Text>
            <TextInput
              style={styles.input}
              value={formPesoEntrada}
              onChangeText={setFormPesoEntrada}
              placeholder="Ex: 320"
              keyboardType="numeric"
            />

            <TouchableOpacity
              style={[styles.btnSalvar, { backgroundColor: primaryColor }]}
              onPress={salvar}
              disabled={salvando}
            >
              {salvando ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnSalvarText}>
                  {animalSelecionado ? "Salvar Alterações" : "Cadastrar Animal"}
                </Text>
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
  busca: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F0F0F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  buscaInput: {
    flex: 1,
    fontSize: 14,
    color: "#1a1a1a",
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
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  categoriaTag: {
    alignSelf: "flex-start",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 8,
  },
  categoriaText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  cardBody: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardNome: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  cardChip: {
    fontSize: 12,
    color: "#888",
    marginTop: 2,
    fontFamily: "monospace",
  },
  cardInfo: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
  },
  cardRight: {
    alignItems: "flex-end",
  },
  cardPeso: {
    fontSize: 20,
    fontWeight: "900",
  },
  cardPesoLabel: {
    fontSize: 11,
    color: "#aaa",
  },
  centro: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingBottom: 80,
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
  sexoBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  sexoBtnText: {
    fontWeight: "700",
    fontSize: 15,
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
