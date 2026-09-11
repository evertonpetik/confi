/**
 * Protocolos sanitários.
 *
 * Cada protocolo é um conjunto de aplicações feitas juntas no mangueiro —
 * "Entrada Padrão" com aftosa e vermífugo, por exemplo. Cadastrado aqui uma
 * vez, vira um toque por animal na hora do manejo.
 */
import { DrawerSceneWrapper } from "@/components/drawe-scene-wrapper";
import { DrawerToggleButton } from "@/components/DrawerToggleButton";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useResponsive } from "@/hooks/useResponsive";
import Aviso from "@/services/alerta";
import ProtocoloService from "@/services/protocoloService";
import { ItemProtocolo, ProtocoloSanitario } from "@/services/weighing.types";
import { Feather } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const TIPOS: { valor: ItemProtocolo["tipo"]; rotulo: string; cor: string }[] = [
  { valor: "vacinacao", rotulo: "Vacina", cor: "#4CAF50" },
  { valor: "vermifugacao", rotulo: "Vermífugo", cor: "#FF9800" },
  { valor: "tratamento", rotulo: "Tratamento", cor: "#F44336" },
  { valor: "exame", rotulo: "Exame", cor: "#2196F3" },
  { valor: "outro", rotulo: "Outro", cor: "#9E9E9E" },
];

const VIAS: { valor: NonNullable<ItemProtocolo["via"]>; rotulo: string }[] = [
  { valor: "subcutanea", rotulo: "Subcutânea" },
  { valor: "intramuscular", rotulo: "Intramuscular" },
  { valor: "oral", rotulo: "Oral" },
  { valor: "topica", rotulo: "Tópica" },
  { valor: "intravenosa", rotulo: "Intravenosa" },
];

/** Sugestões dos produtos mais usados, para não digitar tudo à mão. */
const SUGESTOES: Record<string, string[]> = {
  vacinacao: ["Febre Aftosa", "Brucelose", "Raiva", "Clostridiose", "IBR/BVD", "Leptospirose", "Botulismo"],
  vermifugacao: ["Ivermectina", "Doramectina", "Albendazol", "Levamisol", "Moxidectina"],
};

const corDoTipo = (tipo: ItemProtocolo["tipo"]) =>
  TIPOS.find((t) => t.valor === tipo)?.cor ?? "#9E9E9E";
const rotuloDoTipo = (tipo: ItemProtocolo["tipo"]) =>
  TIPOS.find((t) => t.valor === tipo)?.rotulo ?? tipo;

export default function Sanidade() {
  const { primaryColor } = useTheme();
  const { selectedFazendaId } = useAuth();
  const { containerPadding, titleFontSize, headerPaddingTop, isDesktop, isTablet, maxWidthContent } =
    useResponsive();
  const fazendaId = selectedFazendaId ?? "";

  const [protocolos, setProtocolos] = useState<ProtocoloSanitario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modal, setModal] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const [editando, setEditando] = useState<ProtocoloSanitario | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [itens, setItens] = useState<ItemProtocolo[]>([]);

  const carregar = useCallback(async () => {
    if (!fazendaId) return;
    setCarregando(true);
    try {
      setProtocolos(await ProtocoloService.listar(fazendaId));
    } catch {
      Aviso.alert("Erro", "Não foi possível carregar os protocolos.");
    } finally {
      setCarregando(false);
    }
  }, [fazendaId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function abrirNovo() {
    setEditando(null);
    setNome("");
    setDescricao("");
    setItens([{ tipo: "vacinacao", produto: "" }]);
    setModal(true);
  }

  function abrirEdicao(p: ProtocoloSanitario) {
    setEditando(p);
    setNome(p.nome);
    setDescricao(p.descricao ?? "");
    setItens(p.itens.length ? p.itens : [{ tipo: "vacinacao", produto: "" }]);
    setModal(true);
  }

  const alterarItem = (indice: number, mudanca: Partial<ItemProtocolo>) =>
    setItens((prev) => prev.map((item, i) => (i === indice ? { ...item, ...mudanca } : item)));

  async function salvar() {
    const validos = itens.filter((i) => i.produto.trim());
    if (!nome.trim()) {
      Aviso.alert("Atenção", "Dê um nome ao protocolo.");
      return;
    }
    if (validos.length === 0) {
      Aviso.alert("Atenção", "Adicione pelo menos um produto ao protocolo.");
      return;
    }

    setSalvando(true);
    try {
      await ProtocoloService.salvar(
        {
          id: editando?.id,
          nome: nome.trim(),
          descricao: descricao.trim() || undefined,
          itens: validos.map((i) => ({ ...i, produto: i.produto.trim() })),
          ativo: true,
          farmedaId: fazendaId,
        },
        fazendaId
      );
      setModal(false);
      carregar();
    } catch {
      Aviso.alert("Erro", "Não foi possível salvar o protocolo.");
    } finally {
      setSalvando(false);
    }
  }

  function excluir(p: ProtocoloSanitario) {
    Aviso.alert(
      "Desativar protocolo",
      `"${p.nome}" deixa de aparecer no mangueiro. As aplicações já registradas nos animais continuam no histórico.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Desativar",
          style: "destructive",
          onPress: async () => {
            await ProtocoloService.desativar(p.id!, fazendaId);
            carregar();
          },
        },
      ]
    );
  }

  return (
    <DrawerSceneWrapper>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View
          style={[
            styles.container,
            { padding: containerPadding },
            isTablet && !isDesktop && { maxWidth: maxWidthContent, alignSelf: "center", width: "100%" },
          ]}
        >
          <View style={[styles.header, { paddingTop: headerPaddingTop }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.titulo, { fontSize: titleFontSize }]}>Sanidade</Text>
              <Text style={styles.subtitulo}>Protocolos aplicados no mangueiro</Text>
            </View>
            {!isDesktop && <DrawerToggleButton tintColor="#000000" />}
          </View>

          <TouchableOpacity
            style={[styles.btnNovo, { backgroundColor: primaryColor }]}
            onPress={abrirNovo}
          >
            <Feather name="plus" size={18} color="#fff" />
            <Text style={styles.btnNovoText}>Novo protocolo</Text>
          </TouchableOpacity>

          {carregando ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={primaryColor} />
          ) : protocolos.length === 0 ? (
            <View style={styles.vazioBox}>
              <Feather name="shield" size={32} color="#DDD" />
              <Text style={styles.vazio}>Nenhum protocolo cadastrado.</Text>
              <Text style={styles.vazioDica}>
                Monte um protocolo com as aplicações que você faz junto na entrada — no mangueiro
                ele vira um toque por animal.
              </Text>
            </View>
          ) : (
            protocolos.map((p) => (
              <View key={p.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardNome}>{p.nome}</Text>
                    {p.descricao ? <Text style={styles.cardDesc}>{p.descricao}</Text> : null}
                  </View>
                  <TouchableOpacity onPress={() => abrirEdicao(p)} style={styles.iconeAcao}>
                    <Feather name="edit-2" size={16} color="#666" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => excluir(p)} style={styles.iconeAcao}>
                    <Feather name="trash-2" size={16} color="#C62828" />
                  </TouchableOpacity>
                </View>

                {p.itens.map((item, i) => (
                  <View key={i} style={styles.itemLinha}>
                    <View style={[styles.itemTag, { backgroundColor: corDoTipo(item.tipo) + "18" }]}>
                      <Text style={[styles.itemTagText, { color: corDoTipo(item.tipo) }]}>
                        {rotuloDoTipo(item.tipo)}
                      </Text>
                    </View>
                    <Text style={styles.itemProduto}>{item.produto}</Text>
                    {item.dose ? <Text style={styles.itemDetalhe}>{item.dose}</Text> : null}
                    {item.carenciaDias ? (
                      <Text style={styles.itemCarencia}>carência {item.carenciaDias}d</Text>
                    ) : null}
                  </View>
                ))}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Modal de edição */}
      <Modal visible={modal} animationType="slide" transparent onRequestClose={() => setModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitulo}>
                {editando ? "Editar protocolo" : "Novo protocolo"}
              </Text>
              <TouchableOpacity onPress={() => setModal(false)}>
                <Feather name="x" size={22} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 480 }}>
              <Text style={styles.label}>Nome *</Text>
              <TextInput
                style={styles.input}
                value={nome}
                onChangeText={setNome}
                placeholder="Ex: Entrada Padrão"
                placeholderTextColor="#999"
              />

              <Text style={styles.label}>Descrição</Text>
              <TextInput
                style={styles.input}
                value={descricao}
                onChangeText={setDescricao}
                placeholder="Quando este protocolo é usado"
                placeholderTextColor="#999"
              />

              <Text style={[styles.label, { marginTop: 8 }]}>Produtos</Text>
              {itens.map((item, indice) => (
                <View key={indice} style={styles.itemEditor}>
                  <View style={styles.itemEditorHeader}>
                    <Text style={styles.itemEditorNum}>{indice + 1}</Text>
                    {itens.length > 1 && (
                      <TouchableOpacity
                        onPress={() => setItens((prev) => prev.filter((_, i) => i !== indice))}
                      >
                        <Feather name="x-circle" size={16} color="#C62828" />
                      </TouchableOpacity>
                    )}
                  </View>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      {TIPOS.map((t) => (
                        <TouchableOpacity
                          key={t.valor}
                          style={[
                            styles.chip,
                            item.tipo === t.valor && { backgroundColor: t.cor, borderColor: t.cor },
                          ]}
                          onPress={() => alterarItem(indice, { tipo: t.valor })}
                        >
                          <Text style={[styles.chipText, item.tipo === t.valor && { color: "#fff" }]}>
                            {t.rotulo}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>

                  <TextInput
                    style={[styles.input, { marginTop: 8 }]}
                    value={item.produto}
                    onChangeText={(v) => alterarItem(indice, { produto: v })}
                    placeholder="Nome do produto"
                    placeholderTextColor="#999"
                  />

                  {SUGESTOES[item.tipo]?.length ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={{ flexDirection: "row", gap: 6, marginBottom: 8 }}>
                        {SUGESTOES[item.tipo].map((s) => (
                          <TouchableOpacity
                            key={s}
                            style={styles.sugestao}
                            onPress={() => alterarItem(indice, { produto: s })}
                          >
                            <Text style={styles.sugestaoText}>{s}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                  ) : null}

                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.labelPequeno}>Dose</Text>
                      <TextInput
                        style={styles.input}
                        value={item.dose ?? ""}
                        onChangeText={(v) => alterarItem(indice, { dose: v || undefined })}
                        placeholder="5ml"
                        placeholderTextColor="#999"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.labelPequeno}>Carência (dias)</Text>
                      <TextInput
                        style={styles.input}
                        value={item.carenciaDias?.toString() ?? ""}
                        onChangeText={(v) =>
                          alterarItem(indice, { carenciaDias: v ? Number(v) : undefined })
                        }
                        placeholder="0"
                        placeholderTextColor="#999"
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.labelPequeno}>Repetir em</Text>
                      <TextInput
                        style={styles.input}
                        value={item.repetirEmDias?.toString() ?? ""}
                        onChangeText={(v) =>
                          alterarItem(indice, { repetirEmDias: v ? Number(v) : undefined })
                        }
                        placeholder="dias"
                        placeholderTextColor="#999"
                        keyboardType="numeric"
                      />
                    </View>
                  </View>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      {VIAS.map((v) => (
                        <TouchableOpacity
                          key={v.valor}
                          style={[
                            styles.chip,
                            item.via === v.valor && {
                              backgroundColor: primaryColor,
                              borderColor: primaryColor,
                            },
                          ]}
                          onPress={() =>
                            alterarItem(indice, { via: item.via === v.valor ? undefined : v.valor })
                          }
                        >
                          <Text style={[styles.chipText, item.via === v.valor && { color: "#fff" }]}>
                            {v.rotulo}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              ))}

              <TouchableOpacity
                style={styles.btnAddItem}
                onPress={() => setItens((prev) => [...prev, { tipo: "vacinacao", produto: "" }])}
              >
                <Feather name="plus" size={15} color="#666" />
                <Text style={styles.btnAddItemText}>Adicionar produto</Text>
              </TouchableOpacity>
            </ScrollView>

            <TouchableOpacity
              style={[styles.btnSalvar, { backgroundColor: primaryColor }, salvando && { opacity: 0.7 }]}
              onPress={salvar}
              disabled={salvando}
            >
              <Text style={styles.btnSalvarText}>{salvando ? "Salvando…" : "Salvar protocolo"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </DrawerSceneWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FDFDFD" },
  header: { flexDirection: "row", alignItems: "flex-start", marginBottom: 16 },
  titulo: { fontWeight: "900", color: "#1a1a1a" },
  subtitulo: { fontSize: 13, color: "#888", marginTop: 2 },

  btnNovo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  btnNovoText: { color: "#fff", fontWeight: "800", fontSize: 15 },

  vazioBox: { alignItems: "center", paddingVertical: 40, gap: 10 },
  vazio: { fontSize: 14, color: "#999", fontWeight: "600" },
  vazioDica: { fontSize: 12, color: "#BBB", textAlign: "center", lineHeight: 18, paddingHorizontal: 20 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    padding: 14,
    marginBottom: 10,
  },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 10 },
  cardNome: { fontSize: 15, fontWeight: "800", color: "#1a1a1a" },
  cardDesc: { fontSize: 12, color: "#999", marginTop: 2 },
  iconeAcao: { padding: 6 },

  itemLinha: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4, flexWrap: "wrap" },
  itemTag: { paddingVertical: 2, paddingHorizontal: 7, borderRadius: 6 },
  itemTagText: { fontSize: 10, fontWeight: "800" },
  itemProduto: { fontSize: 13, color: "#444", fontWeight: "600" },
  itemDetalhe: { fontSize: 12, color: "#888" },
  itemCarencia: { fontSize: 11, color: "#E65100", fontWeight: "600" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "92%",
  },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitulo: { fontSize: 17, fontWeight: "800", color: "#1a1a1a" },

  label: { fontSize: 13, fontWeight: "600", color: "#555", marginBottom: 6 },
  labelPequeno: { fontSize: 11, fontWeight: "600", color: "#777", marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#333",
    marginBottom: 12,
    backgroundColor: "#FAFAFA",
  },

  itemEditor: {
    borderWidth: 1,
    borderColor: "#EEE",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    backgroundColor: "#FCFCFC",
  },
  itemEditorHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  itemEditorNum: { fontSize: 12, fontWeight: "800", color: "#BBB" },

  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    backgroundColor: "#fff",
  },
  chipText: { fontSize: 12, fontWeight: "600", color: "#666" },

  sugestao: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: "#F0F0F0",
  },
  sugestaoText: { fontSize: 11, color: "#666" },

  btnAddItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#DDD",
    marginBottom: 12,
  },
  btnAddItemText: { fontSize: 13, color: "#666", fontWeight: "600" },

  btnSalvar: { paddingVertical: 15, borderRadius: 12, alignItems: "center", marginTop: 12 },
  btnSalvarText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
