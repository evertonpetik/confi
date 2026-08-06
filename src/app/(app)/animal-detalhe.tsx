import { DrawerSceneWrapper } from "@/components/drawe-scene-wrapper";
import { DrawerToggleButton } from "@/components/DrawerToggleButton";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useResponsive } from "@/hooks/useResponsive";
import { PesagemFirestoreService } from "@/services/pesagemFirestoreService";
import {
  Bovino,
  EventoSanitario,
  GanhoDiarioPeso,
  Pesagem,
} from "@/services/weighing.types";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
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

const TIPO_EVENTO_LABEL: Record<EventoSanitario["tipo"], string> = {
  vacinacao: "Vacinação",
  vermifugacao: "Vermifugação",
  tratamento: "Tratamento",
  exame: "Exame",
  outro: "Outro",
};

const TIPO_EVENTO_COR: Record<EventoSanitario["tipo"], string> = {
  vacinacao: "#4CAF50",
  vermifugacao: "#FF9800",
  tratamento: "#F44336",
  exame: "#2196F3",
  outro: "#9E9E9E",
};

function calcularIdade(dataNascimento: string): string {
  const nasc = new Date(dataNascimento);
  const hoje = new Date();
  const meses =
    (hoje.getFullYear() - nasc.getFullYear()) * 12 +
    (hoje.getMonth() - nasc.getMonth());
  if (meses < 12) return `${meses} meses`;
  const anos = Math.floor(meses / 12);
  const restMeses = meses % 12;
  return restMeses > 0 ? `${anos}a ${restMeses}m` : `${anos} anos`;
}

function calcularGmd(pesagens: Pesagem[]): GanhoDiarioPeso | null {
  if (pesagens.length < 2) return null;
  const ordenadas = [...pesagens].sort(
    (a, b) => new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime()
  );
  const primeira = ordenadas[0];
  const ultima = ordenadas[ordenadas.length - 1];
  const dias = Math.max(
    1,
    Math.floor(
      (new Date(ultima.dataHora).getTime() -
        new Date(primeira.dataHora).getTime()) /
      (1000 * 60 * 60 * 24)
    )
  );
  const ganho = ultima.peso - primeira.peso;
  const gmd = ganho / dias;

  let classificacao: GanhoDiarioPeso["classificacao"] = "ruim";
  if (gmd >= 1.5) classificacao = "otimo";
  else if (gmd >= 1.0) classificacao = "bom";
  else if (gmd >= 0.5) classificacao = "regular";

  return {
    periodo: `${new Date(primeira.dataHora).toLocaleDateString("pt-BR")} – ${new Date(ultima.dataHora).toLocaleDateString("pt-BR")}`,
    pesagemInicio: primeira.peso,
    pesagemFim: ultima.peso,
    diasPeriodo: dias,
    gmdKg: gmd,
    classificacao,
  };
}

const GMD_COR: Record<GanhoDiarioPeso["classificacao"], string> = {
  ruim: "#F44336",
  regular: "#FF9800",
  bom: "#4CAF50",
  otimo: "#1976D2",
};

export default function AnimalDetalhe() {
  const { animalId } = useLocalSearchParams<{ animalId: string }>();
  const { selectedFazendaId } = useAuth();
  const { primaryColor } = useTheme();
  const { isTablet, isDesktop, maxWidthContent, containerPadding, titleFontSize, headerPaddingTop } = useResponsive();
  const router = useRouter();

  const fazendaId = selectedFazendaId ?? "";

  const [animal, setAnimal] = useState<Bovino | null>(null);
  const [pesagens, setPesagens] = useState<Pesagem[]>([]);
  const [eventos, setEventos] = useState<EventoSanitario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [abaAtiva, setAbaAtiva] = useState<"info" | "pesagens" | "sanidade">("info");

  // Modal de evento sanitário
  const [modalEvento, setModalEvento] = useState(false);
  const [eventoSelecionado, setEventoSelecionado] = useState<EventoSanitario | null>(null);
  const [formEvTipo, setFormEvTipo] = useState<EventoSanitario["tipo"]>("vacinacao");
  const [formEvDesc, setFormEvDesc] = useState("");
  const [formEvData, setFormEvData] = useState("");
  const [formEvDose, setFormEvDose] = useState("");
  const [formEvTecnico, setFormEvTecnico] = useState("");
  const [formEvObs, setFormEvObs] = useState("");
  const [formEvProx, setFormEvProx] = useState("");
  const [salvandoEvento, setSalvandoEvento] = useState(false);

  const carregar = useCallback(async () => {
    if (!animalId || !fazendaId) return;
    setCarregando(true);
    try {
      const [lista, pesagensData, eventosData] = await Promise.all([
        PesagemFirestoreService.listarBovinos(fazendaId),
        PesagemFirestoreService.obterPesagensAnimal(animalId, fazendaId, 50),
        PesagemFirestoreService.listarEventosSanitarios(animalId, fazendaId),
      ]);
      const found = lista.find((b) => b.id === animalId) ?? null;
      setAnimal(found);
      setPesagens(pesagensData);
      setEventos(eventosData);
    } finally {
      setCarregando(false);
    }
  }, [animalId, fazendaId]);

  useEffect(() => { carregar(); }, [carregar]);

  function abrirNovoEvento() {
    setEventoSelecionado(null);
    setFormEvTipo("vacinacao");
    setFormEvDesc("");
    setFormEvData(new Date().toISOString().split("T")[0]);
    setFormEvDose("");
    setFormEvTecnico("");
    setFormEvObs("");
    setFormEvProx("");
    setModalEvento(true);
  }

  function abrirEditarEvento(ev: EventoSanitario) {
    setEventoSelecionado(ev);
    setFormEvTipo(ev.tipo);
    setFormEvDesc(ev.descricao);
    setFormEvData(ev.dataAplicacao.split("T")[0]);
    setFormEvDose(ev.dose ?? "");
    setFormEvTecnico(ev.tecnico ?? "");
    setFormEvObs(ev.observacoes ?? "");
    setFormEvProx(ev.proxAplicacao?.split("T")[0] ?? "");
    setModalEvento(true);
  }

  async function salvarEvento() {
    if (!formEvDesc.trim() || !formEvData) {
      Alert.alert("Atenção", "Informe a descrição e a data do evento.");
      return;
    }
    setSalvandoEvento(true);
    try {
      const ev: EventoSanitario = {
        ...(eventoSelecionado ?? {}),
        id: eventoSelecionado?.id,
        animalId: animalId!,
        tipo: formEvTipo,
        descricao: formEvDesc.trim(),
        dataAplicacao: new Date(formEvData).toISOString(),
        dose: formEvDose || undefined,
        tecnico: formEvTecnico || undefined,
        observacoes: formEvObs || undefined,
        proxAplicacao: formEvProx ? new Date(formEvProx).toISOString() : undefined,
        farmedaId: fazendaId,
        criadoEm: eventoSelecionado?.criadoEm ?? new Date().toISOString(),
      };
      await PesagemFirestoreService.salvarEventoSanitario(ev, fazendaId);
      setModalEvento(false);
      carregar();
    } catch {
      Alert.alert("Erro", "Não foi possível salvar o evento.");
    } finally {
      setSalvandoEvento(false);
    }
  }

  async function excluirEvento(ev: EventoSanitario) {
    Alert.alert("Confirmar", `Excluir "${ev.descricao}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          await PesagemFirestoreService.excluirEventoSanitario(ev.id!, animalId!, fazendaId);
          carregar();
        },
      },
    ]);
  }

  if (carregando) {
    return (
      <DrawerSceneWrapper>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      </DrawerSceneWrapper>
    );
  }

  if (!animal) {
    return (
      <DrawerSceneWrapper>
        <View style={styles.loadingContainer}>
          <Text style={styles.erroText}>Animal não encontrado.</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={[styles.linkText, { color: primaryColor }]}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </DrawerSceneWrapper>
    );
  }

  const gmd = calcularGmd(pesagens);

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
              <Text style={[styles.titulo, { fontSize: titleFontSize }]} numberOfLines={1}>
                {animal.nome}
              </Text>
              <Text style={styles.subtitulo}>
                {animal.chipId} · {animal.raca} · {animal.sexo === "M" ? "Macho" : "Fêmea"}
              </Text>
            </View>
            {!isDesktop && <DrawerToggleButton tintColor="#000000" />}
          </View>

          {/* Status badges */}
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: animal.ativo ? "#E8F5E9" : "#FFEBEE" }]}>
              <Text style={[styles.badgeText, { color: animal.ativo ? "#2E7D32" : "#C62828" }]}>
                {animal.ativo ? "Ativo" : "Inativo"}
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: primaryColor + "18" }]}>
              <Text style={[styles.badgeText, { color: primaryColor }]}>{animal.categoria}</Text>
            </View>
            {animal.sisbov?.certificado && (
              <View style={[styles.badge, { backgroundColor: "#E3F2FD" }]}>
                <Feather name="check-circle" size={12} color="#1565C0" />
                <Text style={[styles.badgeText, { color: "#1565C0", marginLeft: 4 }]}>SISBOV</Text>
              </View>
            )}
          </View>

          {/* Cards de resumo */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Peso atual</Text>
              <Text style={[styles.statValor, { color: primaryColor }]}>
                {animal.pesoAnterior ? `${animal.pesoAnterior.toFixed(0)} kg` : "—"}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Idade</Text>
              <Text style={[styles.statValor, { color: primaryColor }]}>
                {calcularIdade(animal.dataNascimento)}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Pesagens</Text>
              <Text style={[styles.statValor, { color: primaryColor }]}>{pesagens.length}</Text>
            </View>
            {gmd && (
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>GMD</Text>
                <Text style={[styles.statValor, { color: GMD_COR[gmd.classificacao] }]}>
                  {gmd.gmdKg >= 0 ? "+" : ""}{gmd.gmdKg.toFixed(2)} kg/d
                </Text>
              </View>
            )}
          </View>

          {/* Botão pesagem rápida */}
          <TouchableOpacity
            style={[styles.btnPesar, { backgroundColor: primaryColor }]}
            onPress={() =>
              router.push({
                pathname: "/(app)/pesagem-balanca",
                params: { animalId: animal.id, chipId: animal.chipId },
              })
            }
          >
            <Feather name="activity" size={18} color="#fff" />
            <Text style={styles.btnPesarText}>Pesar agora</Text>
          </TouchableOpacity>

          {/* Abas */}
          <View style={styles.tabs}>
            {(["info", "pesagens", "sanidade"] as const).map((aba) => (
              <TouchableOpacity
                key={aba}
                style={[styles.tab, abaAtiva === aba && { borderBottomColor: primaryColor, borderBottomWidth: 2 }]}
                onPress={() => setAbaAtiva(aba)}
              >
                <Text style={[styles.tabText, abaAtiva === aba && { color: primaryColor, fontWeight: "700" }]}>
                  {aba === "info" ? "Informações" : aba === "pesagens" ? "Pesagens" : "Sanidade"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ABA: Informações / SISBOV */}
          {abaAtiva === "info" && (
            <View style={styles.abaConteudo}>
              <View style={styles.secao}>
                <Text style={[styles.secaoTitulo, { color: primaryColor }]}>Identificação</Text>
                <InfoRow label="Nº Inscrição (SISBOV)" value={animal.chipId} />
                <InfoRow label="Nome / Apelido" value={animal.nome} />
                <InfoRow label="Raça" value={animal.raca} />
                <InfoRow label="Sexo" value={animal.sexo === "M" ? "Macho" : "Fêmea"} />
                <InfoRow label="Categoria" value={animal.categoria} />
                <InfoRow label="Pelagem" value={animal.pelagem ?? "Não informado"} />
                <InfoRow
                  label="Nascimento"
                  value={new Date(animal.dataNascimento).toLocaleDateString("pt-BR")}
                />
              </View>

              <View style={styles.secao}>
                <Text style={[styles.secaoTitulo, { color: primaryColor }]}>Rastreabilidade SISBOV</Text>
                <InfoRow
                  label="Certificado"
                  value={animal.sisbov?.certificado ? "Sim" : "Não"}
                  destaque={animal.sisbov?.certificado}
                />
                {animal.sisbov?.dataCertificacao && (
                  <InfoRow
                    label="Data de certificação"
                    value={new Date(animal.sisbov.dataCertificacao).toLocaleDateString("pt-BR")}
                  />
                )}
                {animal.sisbov?.codigoEstabelecimento && (
                  <InfoRow label="Estabelecimento (MAPA)" value={animal.sisbov.codigoEstabelecimento} />
                )}
                <InfoRow label="Propriedade de origem" value={animal.propriedadeOrigem ?? "—"} />
                <InfoRow
                  label="Município/UF origem"
                  value={
                    animal.municipioOrigem
                      ? `${animal.municipioOrigem}/${animal.estadoOrigem ?? ""}`
                      : "—"
                  }
                />
                <InfoRow label="Pai" value={animal.pai ?? "—"} />
                <InfoRow label="Mãe" value={animal.mae ?? "—"} />
              </View>

              <View style={styles.secao}>
                <Text style={[styles.secaoTitulo, { color: primaryColor }]}>Localização</Text>
                <InfoRow label="Lote" value={animal.loteNome ?? animal.loteId ?? "Sem lote"} />
                <InfoRow label="Piquete" value={animal.piqueteId ?? "Sem piquete"} />
                {animal.dataEntrada && (
                  <InfoRow
                    label="Entrada na fazenda"
                    value={new Date(animal.dataEntrada).toLocaleDateString("pt-BR")}
                  />
                )}
              </View>

              {gmd && (
                <View style={styles.secao}>
                  <Text style={[styles.secaoTitulo, { color: primaryColor }]}>Desempenho</Text>
                  <InfoRow label="Período analisado" value={gmd.periodo} />
                  <InfoRow label="Peso inicial" value={`${gmd.pesagemInicio.toFixed(1)} kg`} />
                  <InfoRow label="Peso final" value={`${gmd.pesagemFim.toFixed(1)} kg`} />
                  <InfoRow label="Dias no período" value={`${gmd.diasPeriodo} dias`} />
                  <View style={styles.row}>
                    <Text style={styles.infoLabel}>GMD</Text>
                    <Text style={[styles.infoValor, { color: GMD_COR[gmd.classificacao], fontWeight: "700" }]}>
                      {gmd.gmdKg >= 0 ? "+" : ""}{gmd.gmdKg.toFixed(3)} kg/dia ({gmd.classificacao})
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* ABA: Pesagens */}
          {abaAtiva === "pesagens" && (
            <View style={styles.abaConteudo}>
              {pesagens.length === 0 ? (
                <View style={styles.vazio}>
                  <Feather name="activity" size={40} color="#ccc" />
                  <Text style={styles.vazioText}>Nenhuma pesagem registrada</Text>
                  <TouchableOpacity
                    style={[styles.btnPrimary, { backgroundColor: primaryColor }]}
                    onPress={() =>
                      router.push({
                        pathname: "/(app)/pesagem-balanca",
                        params: { animalId: animal.id, chipId: animal.chipId },
                      })
                    }
                  >
                    <Text style={styles.btnPrimaryText}>Registrar primeira pesagem</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                pesagens.map((p, idx) => (
                  <View key={p.id ?? idx} style={styles.pesagemCard}>
                    <View style={styles.pesagemHeader}>
                      <Text style={[styles.pesagemPeso, { color: primaryColor }]}>
                        {p.peso.toFixed(1)} kg
                      </Text>
                      <Text style={styles.pesagemTipo}>{p.tipoPesagem}</Text>
                    </View>
                    <Text style={styles.pesagemData}>
                      {new Date(p.dataHora).toLocaleString("pt-BR")}
                    </Text>
                    {idx > 0 && (
                      <Text
                        style={[
                          styles.pesagemVariacao,
                          { color: p.peso - pesagens[idx - 1].peso >= 0 ? "#2E7D32" : "#C62828" },
                        ]}
                      >
                        {p.peso - pesagens[idx - 1].peso >= 0 ? "▲" : "▼"}{" "}
                        {Math.abs(p.peso - pesagens[idx - 1].peso).toFixed(1)} kg
                      </Text>
                    )}
                    {p.observacoes ? (
                      <Text style={styles.pesagemObs}>{p.observacoes}</Text>
                    ) : null}
                  </View>
                ))
              )}
            </View>
          )}

          {/* ABA: Sanidade */}
          {abaAtiva === "sanidade" && (
            <View style={styles.abaConteudo}>
              <TouchableOpacity
                style={[styles.btnAdicionar, { borderColor: primaryColor }]}
                onPress={abrirNovoEvento}
              >
                <Feather name="plus" size={16} color={primaryColor} />
                <Text style={[styles.btnAdicionarText, { color: primaryColor }]}>
                  Registrar evento sanitário
                </Text>
              </TouchableOpacity>

              {eventos.length === 0 ? (
                <View style={styles.vazio}>
                  <Feather name="shield" size={40} color="#ccc" />
                  <Text style={styles.vazioText}>Nenhum evento registrado</Text>
                </View>
              ) : (
                eventos.map((ev) => (
                  <View key={ev.id} style={styles.eventoCard}>
                    <View style={[styles.eventoTipoBadge, { backgroundColor: TIPO_EVENTO_COR[ev.tipo] + "20" }]}>
                      <Text style={[styles.eventoTipoText, { color: TIPO_EVENTO_COR[ev.tipo] }]}>
                        {TIPO_EVENTO_LABEL[ev.tipo]}
                      </Text>
                    </View>
                    <Text style={styles.eventoDesc}>{ev.descricao}</Text>
                    <Text style={styles.eventoData}>
                      {new Date(ev.dataAplicacao).toLocaleDateString("pt-BR")}
                      {ev.dose ? ` · ${ev.dose}` : ""}
                      {ev.tecnico ? ` · ${ev.tecnico}` : ""}
                    </Text>
                    {ev.proxAplicacao && (
                      <Text style={styles.eventoProx}>
                        Próxima: {new Date(ev.proxAplicacao).toLocaleDateString("pt-BR")}
                      </Text>
                    )}
                    {ev.observacoes ? <Text style={styles.eventoObs}>{ev.observacoes}</Text> : null}
                    <View style={styles.eventoAcoes}>
                      <TouchableOpacity onPress={() => abrirEditarEvento(ev)} style={styles.eventoBtn}>
                        <Feather name="edit-2" size={14} color="#555" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => excluirEvento(ev)} style={styles.eventoBtn}>
                        <Feather name="trash-2" size={14} color="#F44336" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Modal: Evento Sanitário */}
      <Modal visible={modalEvento} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitulo}>
                {eventoSelecionado ? "Editar evento" : "Novo evento sanitário"}
              </Text>

              <Text style={styles.formLabel}>Tipo</Text>
              <View style={styles.tipoRow}>
                {(["vacinacao", "vermifugacao", "tratamento", "exame", "outro"] as const).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.tipoPill,
                      formEvTipo === t && { backgroundColor: TIPO_EVENTO_COR[t] },
                    ]}
                    onPress={() => setFormEvTipo(t)}
                  >
                    <Text
                      style={[
                        styles.tipoPillText,
                        formEvTipo === t && { color: "#fff" },
                      ]}
                    >
                      {TIPO_EVENTO_LABEL[t]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.formLabel}>Descrição / Produto *</Text>
              <TextInput
                style={styles.input}
                value={formEvDesc}
                onChangeText={setFormEvDesc}
                placeholder="Ex: Vacina Aftosa, Ivermectina 1%"
              />

              <Text style={styles.formLabel}>Data de aplicação *</Text>
              <TextInput
                style={styles.input}
                value={formEvData}
                onChangeText={setFormEvData}
                placeholder="AAAA-MM-DD"
                keyboardType={Platform.OS === "web" ? "default" : "numeric"}
              />

              <Text style={styles.formLabel}>Dose</Text>
              <TextInput
                style={styles.input}
                value={formEvDose}
                onChangeText={setFormEvDose}
                placeholder="Ex: 5 ml, 2 comprimidos"
              />

              <Text style={styles.formLabel}>Técnico / Médico Veterinário</Text>
              <TextInput
                style={styles.input}
                value={formEvTecnico}
                onChangeText={setFormEvTecnico}
                placeholder="Nome do responsável"
              />

              <Text style={styles.formLabel}>Próxima aplicação</Text>
              <TextInput
                style={styles.input}
                value={formEvProx}
                onChangeText={setFormEvProx}
                placeholder="AAAA-MM-DD"
                keyboardType={Platform.OS === "web" ? "default" : "numeric"}
              />

              <Text style={styles.formLabel}>Observações</Text>
              <TextInput
                style={[styles.input, styles.inputMulti]}
                value={formEvObs}
                onChangeText={setFormEvObs}
                placeholder="Observações adicionais..."
                multiline
                numberOfLines={3}
              />

              <View style={styles.modalAcoes}>
                <TouchableOpacity
                  style={styles.btnCancelar}
                  onPress={() => setModalEvento(false)}
                >
                  <Text style={styles.btnCancelarText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btnSalvar, { backgroundColor: primaryColor }]}
                  onPress={salvarEvento}
                  disabled={salvandoEvento}
                >
                  {salvandoEvento ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.btnSalvarText}>Salvar</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </DrawerSceneWrapper>
  );
}

function InfoRow({
  label,
  value,
  destaque,
}: {
  label: string;
  value: string;
  destaque?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValor, destaque && styles.infoValorDestaque]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  erroText: { fontSize: 16, color: "#666", marginBottom: 12 },
  linkText: { fontSize: 15, fontWeight: "600" },

  header: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  btnVoltar: { padding: 4 },
  titulo: { fontSize: 20, fontWeight: "700", color: "#1A1A1A" },
  subtitulo: { fontSize: 13, color: "#666", marginTop: 2 },

  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: { fontSize: 12, fontWeight: "600" },

  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    minWidth: 80,
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  statLabel: { fontSize: 11, color: "#888", marginBottom: 4 },
  statValor: { fontSize: 18, fontWeight: "800" },

  btnPesar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  btnPesarText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  tabs: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#E0E0E0", marginBottom: 16 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 10 },
  tabText: { fontSize: 13, color: "#888", fontWeight: "500" },

  abaConteudo: { paddingBottom: 40 },

  secao: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  secaoTitulo: { fontSize: 14, fontWeight: "700", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  infoLabel: { fontSize: 13, color: "#666", flex: 1 },
  infoValor: { fontSize: 13, color: "#1A1A1A", fontWeight: "500", flex: 1.5, textAlign: "right" },
  infoValorDestaque: { color: "#2E7D32", fontWeight: "700" },

  pesagemCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  pesagemHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pesagemPeso: { fontSize: 20, fontWeight: "800" },
  pesagemTipo: { fontSize: 12, color: "#888", textTransform: "capitalize" },
  pesagemData: { fontSize: 12, color: "#888", marginTop: 4 },
  pesagemVariacao: { fontSize: 13, fontWeight: "600", marginTop: 4 },
  pesagemObs: { fontSize: 12, color: "#555", marginTop: 4, fontStyle: "italic" },

  eventoCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  eventoTipoBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, marginBottom: 6 },
  eventoTipoText: { fontSize: 11, fontWeight: "700" },
  eventoDesc: { fontSize: 15, fontWeight: "600", color: "#1A1A1A" },
  eventoData: { fontSize: 12, color: "#666", marginTop: 3 },
  eventoProx: { fontSize: 12, color: "#FF9800", marginTop: 2 },
  eventoObs: { fontSize: 12, color: "#555", marginTop: 4, fontStyle: "italic" },
  eventoAcoes: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 8 },
  eventoBtn: { padding: 6 },

  btnAdicionar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 10,
    padding: 12,
    justifyContent: "center",
    marginBottom: 14,
  },
  btnAdicionarText: { fontSize: 14, fontWeight: "600" },

  vazio: { alignItems: "center", paddingVertical: 40, gap: 12 },
  vazioText: { fontSize: 15, color: "#999" },
  btnPrimary: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  btnPrimaryText: { color: "#fff", fontWeight: "700" },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalBox: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "90%",
  },
  modalTitulo: { fontSize: 18, fontWeight: "700", marginBottom: 16, color: "#1A1A1A" },
  formLabel: { fontSize: 13, color: "#666", fontWeight: "600", marginTop: 12, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1A1A1A",
    backgroundColor: "#FAFAFA",
  },
  inputMulti: { minHeight: 70, textAlignVertical: "top" },
  tipoRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  tipoPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  tipoPillText: { fontSize: 12, color: "#555", fontWeight: "600" },
  modalAcoes: { flexDirection: "row", gap: 10, marginTop: 20, marginBottom: 10 },
  btnCancelar: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: "#E0E0E0", alignItems: "center" },
  btnCancelarText: { fontSize: 14, color: "#555", fontWeight: "600" },
  btnSalvar: { flex: 1, padding: 14, borderRadius: 10, alignItems: "center" },
  btnSalvarText: { fontSize: 14, color: "#fff", fontWeight: "700" },
});
