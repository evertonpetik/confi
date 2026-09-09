/**
 * Tela de Processos — Entrada / Saída / Transferência de animais.
 * O usuário abre um processo, vincula GTAs (importação de PDF) e depois
 * vai para a tela de pesagem selecionando o processo ativo.
 */
import { DrawerSceneWrapper } from "@/components/drawe-scene-wrapper";
import { DrawerToggleButton } from "@/components/DrawerToggleButton";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useResponsive } from "@/hooks/useResponsive";
import BrincoService from "@/services/brincoService";
import { GTA, PedidoBrinco, ProcessoMangueiro, TipoProcesso } from "@/services/weighing.types";
import { Feather } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// ─── Constantes ───────────────────────────────────────────────────────────────

const TIPOS: { value: TipoProcesso; label: string; icon: React.ComponentProps<typeof Feather>["name"]; cor: string }[] = [
  { value: "entrada", label: "Entrada de Animais", icon: "log-in", cor: "#009688" },
  { value: "saida", label: "Saída de Animais", icon: "log-out", cor: "#F44336" },
  { value: "transferencia", label: "Transferência entre Fazendas", icon: "shuffle", cor: "#2196F3" },
];

const COR_STATUS: Record<string, string> = {
  aberto: "#2196F3",
  em_andamento: "#FF9800",
  concluido: "#4CAF50",
  cancelado: "#9E9E9E",
};

const LABEL_STATUS: Record<string, string> = {
  aberto: "Aberto",
  em_andamento: "Em Andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

function formatarGrupoAnimal(animal: GTA["animais"][number]) {
  const sexo = animal.sexo === "F" ? "Fêmea" : animal.sexo === "M" ? "Macho" : "Animais";
  const faixa = animal.idadeCategoria
    ? animal.idadeCategoria.replace(/\s+/g, " ").trim()
    : animal.descricao?.replace(/^BOVINO\s+/i, "").replace(new RegExp(`^${sexo}\\s*`, "i"), "").trim() || "idade não informada";

  const faixaFormatada = faixa
    .replace(/\s*MESES\b/gi, " meses")
    .replace(/\s*A\s*/gi, " a ")
    .replace(/\s+/g, " ")
    .trim();

  return `${sexo}: ${animal.quantidade} ${faixaFormatada ? `(${faixaFormatada})` : ""}`.trim();
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function ProcessosPage() {
  const router = useRouter();
  const { selectedFazendaId, selectedFazendaNome, user, userProfile } = useAuth();
  const { primaryColor } = useTheme();
  const { isTablet, isDesktop, maxWidthContent, containerPadding, titleFontSize, headerPaddingTop } = useResponsive();
  const fazendaId = selectedFazendaId ?? "";

  const [processos, setProcessos] = useState<ProcessoMangueiro[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtro, setFiltro] = useState<"todos" | "aberto" | "em_andamento" | "concluido">("aberto");

  // ─── Modal: Novo Processo ──────────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [etapaModal, setEtapaModal] = useState<1 | 2 | 3>(1);
  const [tipoSelecionado, setTipoSelecionado] = useState<TipoProcesso>("entrada");
  const [nomeProcesso, setNomeProcesso] = useState("");
  const [observacoes, setObservacoes] = useState("");

  // GTAs do processo
  const [gtasExistentes, setGtasExistentes] = useState<GTA[]>([]);
  const [gtasSelecionadas, setGtasSelecionadas] = useState<GTA[]>([]);
  const [importandoPdf, setImportandoPdf] = useState(false);
  const [showGtaForm, setShowGtaForm] = useState(false);
  const [gtaForm, setGtaForm] = useState<Partial<GTA>>({});
  const [salvandoGta, setSalvandoGta] = useState(false);

  // Pedidos de brinco (apenas para entrada)
  const [pedidos, setPedidos] = useState<PedidoBrinco[]>([]);
  const [pedidoSelecionado, setPedidoSelecionado] = useState<PedidoBrinco | null>(null);
  const [fazendaDestinoNome, setFazendaDestinoNome] = useState("");
  const [fazendaOrigemNome, setFazendaOrigemNome] = useState("");

  const [salvando, setSalvando] = useState(false);

  // ─── Carregamentos ─────────────────────────────────────────────────────────

  const carregarProcessos = useCallback(async () => {
    if (!fazendaId) return;
    setLoading(true);
    try {
      const lista = await BrincoService.listarProcessosMangueiro(fazendaId);
      setProcessos(lista);
    } finally {
      setLoading(false);
    }
  }, [fazendaId]);

  const carregarGtasEPedidos = useCallback(async () => {
    if (!fazendaId) return;
    const [listaGtas, listaPedidos] = await Promise.all([
      BrincoService.listarGtas(fazendaId),
      BrincoService.listarPedidos(fazendaId),
    ]);
    setGtasExistentes(listaGtas.filter((g) => g.status === "ativa"));
    setPedidos(listaPedidos.filter((p) => p.ativo && p.proximoIndice < p.brincosTotal));
  }, [fazendaId]);

  useEffect(() => {
    carregarProcessos();
  }, [carregarProcessos]);

  // ─── Importar PDF da GTA ──────────────────────────────────────────────────

  const importarPdf = async () => {
    if (Platform.OS !== "web") {
      Alert.alert("Indisponível", "A importação de PDF só está disponível no navegador.");
      return;
    }
    setImportandoPdf(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf" });
      if (result.canceled || !result.assets?.length) return;
      const file = (result.assets[0] as any).file as File | undefined;
      if (!file) {
        Alert.alert("Erro", "Não foi possível acessar o PDF.");
        return;
      }
      const { parseGtaFromFile } = await import("../../services/gtaPdfParser.web");
      const parcial = await parseGtaFromFile(file);
      setGtaForm({ ...parcial, status: "ativa", farmedaId: fazendaId });
      setShowGtaForm(true);
    } catch {
      Alert.alert("Erro", "Não foi possível processar o PDF.");
    } finally {
      setImportandoPdf(false);
    }
  };

  const salvarGta = async () => {
    if (!gtaForm.numero?.trim()) {
      Alert.alert("Campo obrigatório", "Informe o número da GTA.");
      return;
    }
    setSalvandoGta(true);
    try {
      const novaGta: Omit<GTA, "id" | "criadoEm"> = {
        numero: gtaForm.numero ?? "",
        serie: gtaForm.serie ?? "",
        uf: gtaForm.uf ?? "",
        procCpfCnpj: gtaForm.procCpfCnpj ?? "",
        procNome: gtaForm.procNome ?? "",
        procFazenda: gtaForm.procFazenda ?? "",
        procCodigoMapa: gtaForm.procCodigoMapa ?? "",
        procInscricaoEstadual: gtaForm.procInscricaoEstadual ?? "",
        procMunicipio: gtaForm.procMunicipio ?? "",
        procUf: gtaForm.procUf ?? "",
        procRegiao: gtaForm.procRegiao,
        destCpfCnpj: gtaForm.destCpfCnpj ?? "",
        destNome: gtaForm.destNome ?? "",
        destFazenda: gtaForm.destFazenda ?? "",
        destCodigoMapa: gtaForm.destCodigoMapa ?? "",
        destInscricaoEstadual: gtaForm.destInscricaoEstadual ?? "",
        destMunicipio: gtaForm.destMunicipio ?? "",
        destUf: gtaForm.destUf ?? "",
        destRegiao: gtaForm.destRegiao,
        finalidade: gtaForm.finalidade ?? "",
        transporte: gtaForm.transporte ?? "",
        animais: gtaForm.animais ?? [],
        totalMachos: gtaForm.totalMachos ?? 0,
        totalFemeas: gtaForm.totalFemeas ?? 0,
        total: gtaForm.total ?? 0,
        rota: gtaForm.rota,
        dataEmissao: gtaForm.dataEmissao ?? new Date().toISOString().split("T")[0],
        dataValidade: gtaForm.dataValidade ?? "",
        unidadeExpedidora: gtaForm.unidadeExpedidora,
        farmedaId: fazendaId,
        status: "ativa",
      };
      const id = await BrincoService.cadastrarGta(novaGta, fazendaId);
      const gtaCompleta: GTA = { ...novaGta, id, criadoEm: new Date().toISOString() };
      setGtasSelecionadas((prev) => [...prev, gtaCompleta]);
      setGtasExistentes((prev) => [gtaCompleta, ...prev]);
      setShowGtaForm(false);
      setGtaForm({});
    } catch {
      Alert.alert("Erro", "Não foi possível salvar a GTA.");
    } finally {
      setSalvandoGta(false);
    }
  };

  const toggleGta = (gta: GTA) => {
    setGtasSelecionadas((prev) =>
      prev.find((g) => g.id === gta.id)
        ? prev.filter((g) => g.id !== gta.id)
        : [...prev, gta]
    );
  };

  // ─── Criar processo ────────────────────────────────────────────────────────

  const abrirNovoProcesso = async () => {
    setEtapaModal(1);
    setTipoSelecionado("entrada");
    setNomeProcesso("");
    setObservacoes("");
    setGtasSelecionadas([]);
    setPedidoSelecionado(null);
    setFazendaDestinoNome("");
    setFazendaOrigemNome("");
    await carregarGtasEPedidos();
    setShowModal(true);
  };

  const criarProcesso = async () => {
    if (!nomeProcesso.trim()) {
      Alert.alert("Campo obrigatório", "Informe o nome do processo.");
      return;
    }
    if (gtasSelecionadas.length === 0) {
      Alert.alert("GTAs necessárias", "Adicione pelo menos uma GTA ao processo.");
      return;
    }
    if (tipoSelecionado === "entrada" && !pedidoSelecionado) {
      Alert.alert("Pedido de brincos", "Selecione um pedido de brincos para processos de entrada.");
      return;
    }

    const total = gtasSelecionadas.reduce((acc, g) => acc + (g.total ?? 0), 0);

    setSalvando(true);
    try {
      const processo: Omit<ProcessoMangueiro, "id" | "criadoEm"> = {
        nome: nomeProcesso.trim(),
        tipo: tipoSelecionado,
        status: "aberto",
        gtaIds: gtasSelecionadas.map((g) => g.id!),
        totalAnimaisPrevisto: total,
        animaisManejados: 0,
        pedidoBrincoId: tipoSelecionado === "entrada" ? pedidoSelecionado?.id : undefined,
        fazendaOrigemNome: tipoSelecionado !== "entrada" ? fazendaOrigemNome.trim() || undefined : undefined,
        fazendaDestinoNome: tipoSelecionado !== "saida" ? fazendaDestinoNome.trim() || undefined : undefined,
        dataAbertura: new Date().toISOString(),
        observacoes: observacoes.trim() || undefined,
        farmedaId: fazendaId,
        usuarioId: user?.uid ?? "sistema",
      };
      await BrincoService.criarProcessoMangueiro(processo, fazendaId);
      setShowModal(false);
      await carregarProcessos();
      Alert.alert("Sucesso", "Processo criado! Agora vá para Pesagem e selecione este processo.");
    } catch {
      Alert.alert("Erro", "Não foi possível criar o processo.");
    } finally {
      setSalvando(false);
    }
  };

  // ─── Filtro ────────────────────────────────────────────────────────────────

  const processosFiltrados = processos.filter((p) =>
    filtro === "todos" ? true : p.status === filtro
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <DrawerSceneWrapper>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View
          style={[
            styles.container,
            { padding: containerPadding },
            isTablet && !isDesktop && { maxWidth: maxWidthContent, alignSelf: "center" as const, width: "100%" },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { paddingTop: headerPaddingTop }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.btnVoltar}>
              <Feather name="arrow-left" size={20} color="#333" />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.titulo, { fontSize: titleFontSize }]}>Processos</Text>
              <Text style={styles.subtitulo}>{selectedFazendaNome} · Entrada / Saída / Transferência</Text>
            </View>
            {!isDesktop && <DrawerToggleButton tintColor="#000000" />}
          </View>

          {/* Botão Novo Processo */}
          <TouchableOpacity
            style={[styles.btnNovo, { backgroundColor: primaryColor }]}
            onPress={abrirNovoProcesso}
          >
            <Feather name="plus-circle" size={18} color="#fff" />
            <Text style={styles.btnNovoText}>Novo Processo</Text>
          </TouchableOpacity>

          {/* Filtros */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtrosScroll}>
            <View style={styles.filtrosRow}>
              {(["aberto", "em_andamento", "concluido", "todos"] as const).map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.filtroChip, filtro === f && { backgroundColor: primaryColor }]}
                  onPress={() => setFiltro(f)}
                >
                  <Text style={[styles.filtroText, filtro === f && { color: "#fff" }]}>
                    {f === "todos" ? "Todos" : LABEL_STATUS[f]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Lista */}
          {loading ? (
            <ActivityIndicator color={primaryColor} style={{ marginTop: 40 }} />
          ) : processosFiltrados.length === 0 ? (
            <View style={styles.vazio}>
              <Feather name="inbox" size={48} color="#ccc" />
              <Text style={styles.vazioText}>
                {filtro === "aberto" ? "Nenhum processo aberto." : "Nenhum processo encontrado."}
              </Text>
              <Text style={styles.vazioSub}>Crie um novo processo para começar.</Text>
            </View>
          ) : (
            processosFiltrados.map((proc) => <ProcessoCard key={proc.id} processo={proc} primaryColor={primaryColor} />)
          )}
        </View>
      </ScrollView>

      {/* Modal Novo Processo */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitulo}>
                {etapaModal === 1 ? "Tipo e Nome" : etapaModal === 2 ? "GTAs do Processo" : "Configurações Finais"}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Feather name="x" size={22} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
              {/* Etapa 1: Tipo e Nome */}
              {etapaModal === 1 && (
                <View style={styles.etapaContainer}>
                  <Text style={styles.labelSecao}>Tipo de Processo</Text>
                  {TIPOS.map((t) => (
                    <TouchableOpacity
                      key={t.value}
                      style={[styles.tipoCard, tipoSelecionado === t.value && { borderColor: t.cor, backgroundColor: t.cor + "12" }]}
                      onPress={() => setTipoSelecionado(t.value)}
                    >
                      <View style={[styles.tipoIcone, { backgroundColor: t.cor + "20" }]}>
                        <Feather name={t.icon} size={22} color={t.cor} />
                      </View>
                      <Text style={[styles.tipoLabel, tipoSelecionado === t.value && { color: t.cor }]}>{t.label}</Text>
                      {tipoSelecionado === t.value && <Feather name="check-circle" size={18} color={t.cor} style={{ marginLeft: "auto" }} />}
                    </TouchableOpacity>
                  ))}

                  <Text style={[styles.labelSecao, { marginTop: 20 }]}>Nome do Processo</Text>
                  <TextInput
                    style={styles.input}
                    value={nomeProcesso}
                    onChangeText={setNomeProcesso}
                    placeholder="Ex: Entrada 50 bezerros - Fazenda São João"
                    placeholderTextColor="#999"
                  />

                  <Text style={[styles.labelSecao, { marginTop: 16 }]}>Observações (opcional)</Text>
                  <TextInput
                    style={[styles.input, { height: 80, textAlignVertical: "top" }]}
                    value={observacoes}
                    onChangeText={setObservacoes}
                    placeholder="Observações gerais sobre o processo..."
                    placeholderTextColor="#999"
                    multiline
                  />

                  <TouchableOpacity
                    style={[styles.btnAvancar, { backgroundColor: primaryColor }]}
                    onPress={() => setEtapaModal(2)}
                  >
                    <Text style={styles.btnAvancarText}>Próximo: GTAs</Text>
                    <Feather name="arrow-right" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}

              {/* Etapa 2: GTAs */}
              {etapaModal === 2 && (
                <View style={styles.etapaContainer}>
                  <Text style={styles.labelSecao}>GTAs do Processo</Text>
                  <Text style={styles.dica}>
                    {tipoSelecionado === "entrada"
                      ? "Adicione as GTAs de origem dos animais que entrarão."
                      : tipoSelecionado === "saida"
                        ? "Adicione as GTAs de destino dos animais que sairão."
                        : "Adicione as GTAs de origem e destino da transferência."}
                  </Text>

                  {/* Botões de adicionar GTA */}
                  <View style={styles.gtaBotoesRow}>
                    <TouchableOpacity
                      style={[styles.btnGtaAcao, { borderColor: primaryColor }]}
                      onPress={importarPdf}
                      disabled={importandoPdf}
                    >
                      {importandoPdf
                        ? <ActivityIndicator size="small" color={primaryColor} />
                        : <Feather name="upload" size={16} color={primaryColor} />}
                      <Text style={[styles.btnGtaAcaoText, { color: primaryColor }]}>
                        {Platform.OS === "web" ? "Importar PDF" : "Nova GTA"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.btnGtaAcao, { borderColor: "#607D8B" }]}
                      onPress={() => { setGtaForm({ status: "ativa", farmedaId: fazendaId }); setShowGtaForm(true); }}
                    >
                      <Feather name="edit-2" size={16} color="#607D8B" />
                      <Text style={[styles.btnGtaAcaoText, { color: "#607D8B" }]}>Digitar GTA</Text>
                    </TouchableOpacity>
                  </View>

                  {/* GTAs já vinculadas */}
                  {gtasSelecionadas.length > 0 && (
                    <>
                      <Text style={[styles.labelSecao, { marginTop: 12 }]}>GTAs Adicionadas</Text>
                      {gtasSelecionadas.map((gta) => (
                        <View key={gta.id} style={styles.gtaCardSelecionada}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.gtaNumero}>GTA {gta.serie}/{gta.numero}</Text>
                            <Text style={styles.gtaInfo}>
                              {gta.procFazenda || gta.procNome} → {gta.destFazenda || gta.destNome}
                            </Text>
                            <Text style={styles.gtaAnimais}>{gta.total} animais · {gta.totalMachos}M / {gta.totalFemeas}F</Text>
                            {gta.animais?.length > 0 && (
                              <View style={styles.gtaGruposList}>
                                {gta.animais.slice(0, 3).map((animal, idx) => (
                                  <Text key={`${gta.id}-${idx}`} style={styles.gtaGrupoAnimal}>
                                    • {formatarGrupoAnimal(animal)}
                                  </Text>
                                ))}
                                {gta.animais.length > 3 && (
                                  <Text style={styles.gtaGrupoAnimal}>• +{gta.animais.length - 3} grupo(s) adicional(is)</Text>
                                )}
                              </View>
                            )}
                          </View>
                          <TouchableOpacity onPress={() => toggleGta(gta)}>
                            <Feather name="x-circle" size={20} color="#F44336" />
                          </TouchableOpacity>
                        </View>
                      ))}
                      <View style={styles.totalGtas}>
                        <Text style={styles.totalGtasText}>
                          Total previsto: {gtasSelecionadas.reduce((a, g) => a + g.total, 0)} animais
                        </Text>
                      </View>
                    </>
                  )}

                  {/* GTAs existentes para selecionar */}
                  {gtasExistentes.filter((g) => !gtasSelecionadas.find((s) => s.id === g.id)).length > 0 && (
                    <>
                      <Text style={[styles.labelSecao, { marginTop: 16 }]}>GTAs Existentes</Text>
                      {gtasExistentes
                        .filter((g) => !gtasSelecionadas.find((s) => s.id === g.id))
                        .map((gta) => (
                          <TouchableOpacity key={gta.id} style={styles.gtaCardExistente} onPress={() => toggleGta(gta)}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.gtaNumero}>GTA {gta.serie}/{gta.numero}</Text>
                              <Text style={styles.gtaInfo}>{gta.procFazenda || gta.procNome}</Text>
                              <Text style={styles.gtaAnimais}>{gta.total} animais · {new Date(gta.dataEmissao).toLocaleDateString("pt-BR")}</Text>
                            </View>
                            <Feather name="plus-circle" size={20} color={primaryColor} />
                          </TouchableOpacity>
                        ))}
                    </>
                  )}

                  <View style={styles.botoesNavRow}>
                    <TouchableOpacity style={styles.btnVoltar2} onPress={() => setEtapaModal(1)}>
                      <Feather name="arrow-left" size={16} color="#333" />
                      <Text style={styles.btnVoltarText2}>Voltar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.btnAvancar, { backgroundColor: primaryColor, flex: 1 }]}
                      onPress={() => setEtapaModal(3)}
                    >
                      <Text style={styles.btnAvancarText}>Próximo</Text>
                      <Feather name="arrow-right" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Etapa 3: Config final */}
              {etapaModal === 3 && (
                <View style={styles.etapaContainer}>
                  {/* Pedido de brincos — apenas para entrada */}
                  {tipoSelecionado === "entrada" && (
                    <>
                      <Text style={styles.labelSecao}>Pedido de Brincos</Text>
                      <Text style={styles.dica}>Selecione o pedido MAPA cujos brincos serão atribuídos aos animais.</Text>
                      {pedidos.length === 0 ? (
                        <Text style={styles.semDados}>Nenhum pedido de brincos disponível.</Text>
                      ) : (
                        pedidos.map((p) => (
                          <TouchableOpacity
                            key={p.id}
                            style={[
                              styles.pedidoCard,
                              pedidoSelecionado?.id === p.id && { borderColor: primaryColor, backgroundColor: primaryColor + "10" },
                            ]}
                            onPress={() => setPedidoSelecionado(p)}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={styles.pedidoNumero}>Pedido {p.numeroPedidoMapa}</Text>
                              <Text style={styles.pedidoInfo}>{p.fabrica} · {p.brincosTotal - p.proximoIndice} brincos disponíveis</Text>
                              <Text style={styles.pedidoRange}>{p.brincoInicial} → {p.brincoFinal}</Text>
                            </View>
                            {pedidoSelecionado?.id === p.id && <Feather name="check-circle" size={18} color={primaryColor} />}
                          </TouchableOpacity>
                        ))
                      )}
                    </>
                  )}

                  {/* Fazenda destino — para transferência */}
                  {(tipoSelecionado === "transferencia") && (
                    <>
                      <Text style={[styles.labelSecao, { marginTop: 12 }]}>Fazenda Destino</Text>
                      <TextInput
                        style={styles.input}
                        value={fazendaDestinoNome}
                        onChangeText={setFazendaDestinoNome}
                        placeholder="Nome da fazenda de destino"
                        placeholderTextColor="#999"
                      />
                    </>
                  )}

                  {/* Fazenda origem — para saída */}
                  {(tipoSelecionado === "saida") && (
                    <>
                      <Text style={[styles.labelSecao, { marginTop: 12 }]}>Fazenda / Comprador Destino</Text>
                      <TextInput
                        style={styles.input}
                        value={fazendaDestinoNome}
                        onChangeText={setFazendaDestinoNome}
                        placeholder="Nome do destino / comprador"
                        placeholderTextColor="#999"
                      />
                    </>
                  )}

                  {/* Resumo */}
                  <View style={[styles.resumoBox, { borderColor: primaryColor + "40", backgroundColor: primaryColor + "08" }]}>
                    <Text style={[styles.resumoTitulo, { color: primaryColor }]}>Resumo do Processo</Text>
                    <Text style={styles.resumoLinha}><Text style={styles.resumoLabel}>Nome: </Text>{nomeProcesso}</Text>
                    <Text style={styles.resumoLinha}>
                      <Text style={styles.resumoLabel}>Tipo: </Text>
                      {TIPOS.find((t) => t.value === tipoSelecionado)?.label}
                    </Text>
                    <Text style={styles.resumoLinha}>
                      <Text style={styles.resumoLabel}>GTAs: </Text>
                      {gtasSelecionadas.length} GTA(s) · {gtasSelecionadas.reduce((a, g) => a + g.total, 0)} animais previstos
                    </Text>
                    {pedidoSelecionado && (
                      <Text style={styles.resumoLinha}>
                        <Text style={styles.resumoLabel}>Pedido brincos: </Text>
                        {pedidoSelecionado.numeroPedidoMapa}
                      </Text>
                    )}
                  </View>

                  <View style={styles.botoesNavRow}>
                    <TouchableOpacity style={styles.btnVoltar2} onPress={() => setEtapaModal(2)}>
                      <Feather name="arrow-left" size={16} color="#333" />
                      <Text style={styles.btnVoltarText2}>Voltar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.btnAvancar, { backgroundColor: primaryColor, flex: 1 }, salvando && { opacity: 0.6 }]}
                      onPress={criarProcesso}
                      disabled={salvando}
                    >
                      {salvando
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <>
                          <Feather name="check-circle" size={16} color="#fff" />
                          <Text style={styles.btnAvancarText}>Abrir Processo</Text>
                        </>}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal: Formulário de GTA manual */}
      <Modal visible={showGtaForm} animationType="slide" transparent onRequestClose={() => setShowGtaForm(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxHeight: "90%" }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitulo}>Dados da GTA</Text>
              <TouchableOpacity onPress={() => setShowGtaForm(false)}>
                <Feather name="x" size={22} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <GtaFormContent form={gtaForm} onChange={setGtaForm} />
              <TouchableOpacity
                style={[styles.btnAvancar, { backgroundColor: primaryColor, marginTop: 16 }, salvandoGta && { opacity: 0.6 }]}
                onPress={salvarGta}
                disabled={salvandoGta}
              >
                {salvandoGta
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.btnAvancarText}>Salvar GTA</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </DrawerSceneWrapper>
  );
}

// ─── Card de Processo ─────────────────────────────────────────────────────────

function ProcessoCard({ processo, primaryColor }: { processo: ProcessoMangueiro; primaryColor: string }) {
  const router = useRouter();
  const tipo = TIPOS.find((t) => t.value === processo.tipo);
  const progresso = processo.totalAnimaisPrevisto > 0
    ? Math.min(1, processo.animaisManejados / processo.totalAnimaisPrevisto)
    : 0;

  return (
    <View style={[cardStyles.card, { borderLeftColor: tipo?.cor ?? "#607D8B" }]}>
      <View style={cardStyles.cardHeader}>
        <View style={[cardStyles.iconeWrapper, { backgroundColor: (tipo?.cor ?? "#607D8B") + "18" }]}>
          <Feather name={(tipo?.icon ?? "file") as any} size={20} color={tipo?.cor ?? "#607D8B"} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={cardStyles.nome} numberOfLines={2}>{processo.nome}</Text>
          <Text style={cardStyles.tipo}>{tipo?.label ?? processo.tipo}</Text>
        </View>
        <View style={[cardStyles.statusBadge, { backgroundColor: (COR_STATUS[processo.status] ?? "#9E9E9E") + "20" }]}>
          <Text style={[cardStyles.statusText, { color: COR_STATUS[processo.status] ?? "#9E9E9E" }]}>
            {LABEL_STATUS[processo.status] ?? processo.status}
          </Text>
        </View>
      </View>

      {/* Progresso */}
      <View style={cardStyles.progressoRow}>
        <Text style={cardStyles.progressoLabel}>
          {processo.animaisManejados} / {processo.totalAnimaisPrevisto} animais manejados
        </Text>
        <Text style={cardStyles.progressoPct}>{Math.round(progresso * 100)}%</Text>
      </View>
      <View style={cardStyles.progressoBar}>
        <View style={[cardStyles.progressoFill, { width: `${Math.round(progresso * 100)}%` as any, backgroundColor: tipo?.cor ?? primaryColor }]} />
      </View>

      {/* GTAs */}
      <Text style={cardStyles.gtaInfo}>{processo.gtaIds.length} GTA(s) · Aberto em {new Date(processo.dataAbertura).toLocaleDateString("pt-BR")}</Text>

      {/* Botão ir para pesagem */}
      {(processo.status === "aberto" || processo.status === "em_andamento") && (
        <TouchableOpacity
          style={[cardStyles.btnPesagem, { borderColor: primaryColor }]}
          onPress={() => router.push({ pathname: "/pesagem-balanca", params: { processoId: processo.id } })}
        >
          <Feather name="activity" size={14} color={primaryColor} />
          <Text style={[cardStyles.btnPesagemText, { color: primaryColor }]}>Ir para Pesagem</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Formulário de GTA (campos) ───────────────────────────────────────────────

function GtaFormContent({ form, onChange }: { form: Partial<GTA>; onChange: (f: Partial<GTA>) => void }) {
  const set = (k: keyof GTA, v: any) => onChange({ ...form, [k]: v });
  return (
    <>
      <Text style={styles.labelSecao}>Identificação</Text>
      <TextInput style={styles.input} value={form.numero ?? ""} onChangeText={(v) => set("numero", v)} placeholder="Número da GTA*" placeholderTextColor="#999" keyboardType="numeric" />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TextInput style={[styles.input, { flex: 1 }]} value={form.serie ?? ""} onChangeText={(v) => set("serie", v)} placeholder="Série (ex: Q)" placeholderTextColor="#999" />
        <TextInput style={[styles.input, { flex: 1 }]} value={form.uf ?? ""} onChangeText={(v) => set("uf", v.toUpperCase())} placeholder="UF" placeholderTextColor="#999" maxLength={2} />
      </View>

      <Text style={styles.labelSecao}>Procedência (Origem)</Text>
      <TextInput style={styles.input} value={form.procNome ?? ""} onChangeText={(v) => set("procNome", v)} placeholder="Nome do produtor de origem" placeholderTextColor="#999" />
      <TextInput style={styles.input} value={form.procFazenda ?? ""} onChangeText={(v) => set("procFazenda", v)} placeholder="Nome da fazenda de origem" placeholderTextColor="#999" />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TextInput style={[styles.input, { flex: 2 }]} value={form.procMunicipio ?? ""} onChangeText={(v) => set("procMunicipio", v)} placeholder="Município origem" placeholderTextColor="#999" />
        <TextInput style={[styles.input, { flex: 1 }]} value={form.procUf ?? ""} onChangeText={(v) => set("procUf", v.toUpperCase())} placeholder="UF" placeholderTextColor="#999" maxLength={2} />
      </View>

      <Text style={styles.labelSecao}>Destino</Text>
      <TextInput style={styles.input} value={form.destNome ?? ""} onChangeText={(v) => set("destNome", v)} placeholder="Nome do produtor de destino" placeholderTextColor="#999" />
      <TextInput style={styles.input} value={form.destFazenda ?? ""} onChangeText={(v) => set("destFazenda", v)} placeholder="Nome da fazenda de destino" placeholderTextColor="#999" />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TextInput style={[styles.input, { flex: 2 }]} value={form.destMunicipio ?? ""} onChangeText={(v) => set("destMunicipio", v)} placeholder="Município destino" placeholderTextColor="#999" />
        <TextInput style={[styles.input, { flex: 1 }]} value={form.destUf ?? ""} onChangeText={(v) => set("destUf", v.toUpperCase())} placeholder="UF" placeholderTextColor="#999" maxLength={2} />
      </View>

      <Text style={styles.labelSecao}>Animais</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TextInput style={[styles.input, { flex: 1 }]} value={form.totalMachos?.toString() ?? ""} onChangeText={(v) => set("totalMachos", Number(v) || 0)} placeholder="Machos" placeholderTextColor="#999" keyboardType="numeric" />
        <TextInput style={[styles.input, { flex: 1 }]} value={form.totalFemeas?.toString() ?? ""} onChangeText={(v) => set("totalFemeas", Number(v) || 0)} placeholder="Fêmeas" placeholderTextColor="#999" keyboardType="numeric" />
        <TextInput style={[styles.input, { flex: 1 }]} value={form.total?.toString() ?? ""} onChangeText={(v) => set("total", Number(v) || 0)} placeholder="Total" placeholderTextColor="#999" keyboardType="numeric" />
      </View>

      <Text style={styles.labelSecao}>Datas</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TextInput style={[styles.input, { flex: 1 }]} value={form.dataEmissao ?? ""} onChangeText={(v) => set("dataEmissao", v)} placeholder="Emissão (AAAA-MM-DD)" placeholderTextColor="#999" />
        <TextInput style={[styles.input, { flex: 1 }]} value={form.dataValidade ?? ""} onChangeText={(v) => set("dataValidade", v)} placeholder="Validade (AAAA-MM-DD)" placeholderTextColor="#999" />
      </View>

      <TextInput style={styles.input} value={form.finalidade ?? ""} onChangeText={(v) => set("finalidade", v)} placeholder="Finalidade (ex: ENGORDA)" placeholderTextColor="#999" />
    </>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F5" },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  btnVoltar: { padding: 8, borderRadius: 8, backgroundColor: "#fff", elevation: 1, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 3 },
  titulo: { fontWeight: "700", color: "#1a1a1a" },
  subtitulo: { fontSize: 13, color: "#666", marginTop: 2 },
  btnNovo: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12, marginBottom: 16 },
  btnNovoText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  filtrosScroll: { marginBottom: 16 },
  filtrosRow: { flexDirection: "row", gap: 8, paddingBottom: 4 },
  filtroChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E0E0E0" },
  filtroText: { fontSize: 13, color: "#555", fontWeight: "500" },
  vazio: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 12 },
  vazioText: { fontSize: 16, color: "#999", fontWeight: "600" },
  vazioSub: { fontSize: 13, color: "#bbb" },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContainer: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "92%", flex: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitulo: { fontSize: 18, fontWeight: "700", color: "#1a1a1a" },
  etapaContainer: { paddingBottom: 40 },
  labelSecao: { fontSize: 13, fontWeight: "600", color: "#666", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  dica: { fontSize: 13, color: "#888", marginBottom: 12, lineHeight: 18 },
  input: { backgroundColor: "#F8F8F8", borderRadius: 10, borderWidth: 1, borderColor: "#E0E0E0", paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: "#1a1a1a", marginBottom: 10 },

  tipoCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, borderWidth: 2, borderColor: "#E0E0E0", backgroundColor: "#fff", marginBottom: 10 },
  tipoIcone: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  tipoLabel: { fontSize: 15, fontWeight: "600", color: "#333", flex: 1 },

  gtaBotoesRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  btnGtaAcao: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5 },
  btnGtaAcaoText: { fontWeight: "600", fontSize: 14 },

  gtaCardSelecionada: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 10, backgroundColor: "#E8F5E9", marginBottom: 8 },
  gtaCardExistente: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 10, backgroundColor: "#F8F8F8", borderWidth: 1, borderColor: "#E0E0E0", marginBottom: 8 },
  gtaNumero: { fontSize: 14, fontWeight: "700", color: "#1a1a1a" },
  gtaInfo: { fontSize: 12, color: "#666", marginTop: 2 },
  gtaAnimais: { fontSize: 12, color: "#888", marginTop: 1 },
  gtaGruposList: { marginTop: 8, gap: 3 },
  gtaGrupoAnimal: { fontSize: 11.5, color: "#475569", lineHeight: 18 },
  totalGtas: { padding: 10, borderRadius: 8, backgroundColor: "#E3F2FD", marginBottom: 8 },
  totalGtasText: { fontSize: 14, fontWeight: "700", color: "#1565C0", textAlign: "center" },

  pedidoCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, borderWidth: 2, borderColor: "#E0E0E0", backgroundColor: "#fff", marginBottom: 10 },
  pedidoNumero: { fontSize: 14, fontWeight: "700", color: "#1a1a1a" },
  pedidoInfo: { fontSize: 12, color: "#666", marginTop: 2 },
  pedidoRange: { fontSize: 11, color: "#999", marginTop: 2, fontFamily: Platform.OS === "web" ? "monospace" : undefined },

  semDados: { fontSize: 14, color: "#999", textAlign: "center", paddingVertical: 16 },

  botoesNavRow: { flexDirection: "row", gap: 10, marginTop: 20 },
  btnVoltar2: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: "#E0E0E0", backgroundColor: "#fff" },
  btnVoltarText2: { fontSize: 14, color: "#333", fontWeight: "500" },
  btnAvancar: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12, marginTop: 16 },
  btnAvancarText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  resumoBox: { padding: 16, borderRadius: 12, borderWidth: 1, marginTop: 20 },
  resumoTitulo: { fontSize: 14, fontWeight: "700", marginBottom: 10 },
  resumoLinha: { fontSize: 13, color: "#444", marginBottom: 4 },
  resumoLabel: { fontWeight: "600" },
});

const cardStyles = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 12, borderLeftWidth: 4, elevation: 2, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 },
  iconeWrapper: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  nome: { fontSize: 15, fontWeight: "700", color: "#1a1a1a", flex: 1 },
  tipo: { fontSize: 12, color: "#888", marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  progressoRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  progressoLabel: { fontSize: 12, color: "#666" },
  progressoPct: { fontSize: 12, fontWeight: "600", color: "#333" },
  progressoBar: { height: 6, borderRadius: 3, backgroundColor: "#F0F0F0", marginBottom: 8, overflow: "hidden" },
  progressoFill: { height: 6, borderRadius: 3 },
  gtaInfo: { fontSize: 12, color: "#999", marginBottom: 10 },
  btnPesagem: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5 },
  btnPesagemText: { fontWeight: "600", fontSize: 13 },
});
