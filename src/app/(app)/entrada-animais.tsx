/**
 * Entrada de Animais — fluxo em 3 etapas:
 * 1. Selecionar / importar / criar GTA
 * 2. Configurar pedido de brinco e confirmar
 * 3. Cadastrar cada animal (raça, sexo, regime, local, chip, peso)
 */
import { useAuth } from "@/contexts/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
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
  View
} from "react-native";
import BrincoService, {
  brincoByIndex
} from "../../services/brincoService";
import { PesagemFirestoreService } from "../../services/pesagemFirestoreService";
import {
  AnimalEntrada,
  Bovino,
  CategoriaBovino,
  GTA,
  LocalAnimal,
  PedidoBrinco,
  RegimeAnimal
} from "../../services/weighing.types";

// ─── Constantes ───────────────────────────────────────────────────────────────

const RACAS = [
  "Nelore", "Angus", "Brahman", "Hereford", "Gir",
  "Senepol", "Brangus", "Tabapuã", "Canchim", "Limousin", "Outro",
];

// Categorias conforme o enum CategoriaBovino — o sexo do animal é guardado
// separadamente no campo `sexo`, por isso não há entrada plural por sexo aqui.
const CATEGORIAS: { value: CategoriaBovino; label: string }[] = [
  { value: CategoriaBovino.BEZERRO, label: "Bezerro (0-12m)" },
  { value: CategoriaBovino.NOVILHO, label: "Novilho (12-24m)" },
  { value: CategoriaBovino.NOVILHA, label: "Novilha (12-24m)" },
  { value: CategoriaBovino.TOUROS, label: "Touro (>24m)" },
  { value: CategoriaBovino.VACAS, label: "Vaca (adulta)" },
  { value: CategoriaBovino.BOIS, label: "Boi castrado" },
];

const REGIMES: { value: RegimeAnimal; label: string }[] = [
  { value: RegimeAnimal.PASTO, label: "Pasto" },
  { value: RegimeAnimal.CONFINAMENTO, label: "Confinamento" },
  { value: RegimeAnimal.BOITEL, label: "Boitel" },
  { value: RegimeAnimal.SEMI_CONFINAMENTO, label: "Semi-Conf." },
];

// ─── Tipo de etapa ────────────────────────────────────────────────────────────

type Etapa = 1 | 2 | 3;

// ─── Componente principal ────────────────────────────────────────────────────

export default function EntradaAnimaisPage() {
  const router = useRouter();
  const { selectedFazendaId, selectedFazendaNome, user } = useAuth();
  const fazendaId = selectedFazendaId ?? "";

  const [etapa, setEtapa] = useState<Etapa>(1);

  // ── Etapa 1: GTA ─────────────────────────────────────────────────────────
  const [gtas, setGtas] = useState<GTA[]>([]);
  const [gtaSelecionada, setGtaSelecionada] = useState<GTA | null>(null);
  const [loadingGtas, setLoadingGtas] = useState(false);
  const [showNovaGtaModal, setShowNovaGtaModal] = useState(false);
  const [importandoPdf, setImportandoPdf] = useState(false);
  const [gtaForm, setGtaForm] = useState<Partial<GTA>>({});
  const [salvandoGta, setSalvandoGta] = useState(false);

  // ── Etapa 2: Pedido de Brinco ─────────────────────────────────────────────
  const [pedidos, setPedidos] = useState<PedidoBrinco[]>([]);
  const [pedidoSelecionado, setPedidoSelecionado] = useState<PedidoBrinco | null>(null);
  const [locais, setLocais] = useState<LocalAnimal[]>([]);

  // ── Etapa 3: Animais ──────────────────────────────────────────────────────
  const [animaisEntrada, setAnimaisEntrada] = useState<AnimalEntrada[]>([]);
  const [animalAtual, setAnimalAtual] = useState<number>(0); // índice
  const [salvando, setSalvando] = useState(false);
  const [concluido, setConcluido] = useState(false);
  const [csvGerado, setCsvGerado] = useState<string | null>(null);

  // ── Chip/peso em tempo real ────────────────────────────────────────────────
  const chipRef = useRef<TextInput | null>(null);
  const pesoRef = useRef<TextInput | null>(null);

  // ─── Carregamentos iniciais ───────────────────────────────────────────────

  const carregarGtas = useCallback(async () => {
    if (!fazendaId) return;
    setLoadingGtas(true);
    try {
      const lista = await BrincoService.listarGtas(fazendaId);
      setGtas(lista.filter((g) => g.status === "ativa"));
    } finally {
      setLoadingGtas(false);
    }
  }, [fazendaId]);

  const carregarPedidosELocais = useCallback(async () => {
    if (!fazendaId) return;
    const [lista, listLocais] = await Promise.all([
      BrincoService.listarPedidos(fazendaId),
      BrincoService.listarLocais(fazendaId),
    ]);
    setPedidos(lista.filter((p) => p.ativo && p.proximoIndice < p.brincosTotal));
    setLocais(listLocais);
  }, [fazendaId]);

  useEffect(() => {
    carregarGtas();
  }, [carregarGtas]);

  // ─── Importação de PDF (web only) ─────────────────────────────────────────

  const importarPdf = async () => {
    if (Platform.OS !== "web") {
      Alert.alert("Indisponível", "A importação de PDF só está disponível no navegador.");
      return;
    }
    setImportandoPdf(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf" });
      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      // No browser, asset.file é o File object
      const file = (asset as any).file as File | undefined;
      if (!file) {
        Alert.alert("Erro", "Não foi possível acessar o arquivo PDF.");
        return;
      }

      const { parseGtaFromFile } = await import("../../services/gtaPdfParser.web");
      const parcial = await parseGtaFromFile(file);
      setGtaForm({ ...parcial, status: "ativa", farmedaId: fazendaId });
      setShowNovaGtaModal(true);
    } catch (e) {
      console.error("Erro ao importar PDF:", e);
      Alert.alert("Erro", "Não foi possível processar o PDF da GTA.");
    } finally {
      setImportandoPdf(false);
    }
  };

  // ─── Salvar GTA ───────────────────────────────────────────────────────────

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
      setGtaSelecionada(gtaCompleta);
      setShowNovaGtaModal(false);
      setGtaForm({});
      await carregarGtas();
    } catch (e) {
      Alert.alert("Erro", "Não foi possível salvar a GTA.");
    } finally {
      setSalvandoGta(false);
    }
  };

  // ─── Avançar para etapa 2 ─────────────────────────────────────────────────

  const avancarEtapa2 = async () => {
    if (!gtaSelecionada) {
      Alert.alert("Seleção necessária", "Selecione uma GTA para continuar.");
      return;
    }
    await carregarPedidosELocais();
    setEtapa(2);
  };

  // ─── Avançar para etapa 3 ─────────────────────────────────────────────────

  const avancarEtapa3 = () => {
    if (!pedidoSelecionado) {
      Alert.alert("Seleção necessária", "Selecione um pedido de brincos.");
      return;
    }
    if (!gtaSelecionada) return;

    // Montar lista de animais a cadastrar a partir dos grupos da GTA
    const lista: AnimalEntrada[] = [];
    let seq = 1;
    for (const grupo of gtaSelecionada.animais) {
      const sexo: "M" | "F" = grupo.sexo === "F" ? "F" : "M";
      for (let i = 0; i < grupo.quantidade; i++) {
        lista.push({
          sequencia: seq++,
          gtaId: gtaSelecionada.id!,
          sexo,
          raca: RACAS[0],
          categoria: sexo === "F" ? CategoriaBovino.NOVILHA : CategoriaBovino.NOVILHO,
          regime: RegimeAnimal.PASTO,
          pedidoBrincoId: pedidoSelecionado.id,
          status: "pendente",
        });
      }
    }

    setAnimaisEntrada(lista);
    setAnimalAtual(0);
    setEtapa(3);
  };

  // ─── Salvar animal atual ──────────────────────────────────────────────────

  const salvarAnimalAtual = async () => {
    const animal = animaisEntrada[animalAtual];
    if (!animal) return;

    if (!animal.raca || !animal.categoria || !animal.regime) {
      Alert.alert("Campos obrigatórios", "Preencha raça, categoria e regime.");
      return;
    }

    setSalvando(true);
    try {
      // Reserva o próximo brinco
      const reserva = await BrincoService.reservarBrinco(
        pedidoSelecionado!.id!,
        fazendaId
      );
      if (!reserva) {
        Alert.alert("Erro", "Não há mais brincos disponíveis neste pedido.");
        return;
      }

      const brinco = reserva.brinco;
      const controle = reserva.controle;

      // Cria o bovino
      const bovino: Bovino = {
        id: brinco,
        chipId: animal.chipRfid ?? brinco,
        nome: `${animal.raca} ${controle}`,
        categoria: animal.categoria,
        raca: animal.raca,
        sexo: animal.sexo,
        dataNascimento: animal.dataNascimento ?? new Date().toISOString().split("T")[0],
        pesoEntrada: animal.pesoEntrada,
        farmedaId: fazendaId,
        loteId: animal.localId,
        loteNome: animal.localNome,
        ativo: true,
        dataEntrada: new Date().toISOString(),
        sisbov: {
          numeroInscricao: brinco,
          certificado: false,
        },
        metadados: {
          regime: animal.regime,
          localId: animal.localId,
          localNome: animal.localNome,
          chipRfid: animal.chipRfid,
          gtaId: animal.gtaId,
          controle,
        },
      };

      await PesagemFirestoreService.salvarBovino(bovino, fazendaId);

      // Registra a pesagem de entrada, se houver peso
      if (animal.pesoEntrada && animal.pesoEntrada > 0) {
        await PesagemFirestoreService.registrarPesagemRapida(
          brinco,
          animal.chipRfid ?? brinco,
          animal.pesoEntrada,
          fazendaId,
          user?.uid ?? "sistema",
          "pesagem_entrada"
        );
      }

      // Marca como concluído
      const updated = [...animaisEntrada];
      updated[animalAtual] = { ...animal, brincoNumero: brinco, brincoControle: controle, status: "concluido" };
      setAnimaisEntrada(updated);

      // Avança para o próximo
      const proximo = updated.findIndex((a, i) => i > animalAtual && a.status === "pendente");
      if (proximo >= 0) {
        setAnimalAtual(proximo);
      } else {
        // Todos cadastrados
        setConcluido(true);
        const bovinos = updated
          .filter((a) => a.status === "concluido")
          .map((a) => ({
            id: a.brincoNumero!,
            chipId: a.chipRfid ?? a.brincoNumero!,
            nome: `${a.raca} ${a.brincoControle}`,
            categoria: a.categoria,
            raca: a.raca,
            sexo: a.sexo,
            dataNascimento: a.dataNascimento ?? "",
            pesoEntrada: a.pesoEntrada,
            farmedaId: fazendaId,
            ativo: true,
            dataEntrada: new Date().toISOString(),
            metadados: {
              regime: a.regime,
              localNome: a.localNome,
              gtaId: a.gtaId,
              controle: a.brincoControle,
            },
          } as Bovino));

        const csv = BrincoService.gerarCsvPlanilhaCampo(
          bovinos,
          gtaSelecionada ? [gtaSelecionada] : [],
          selectedFazendaNome ?? "Fazenda"
        );
        setCsvGerado(csv);
      }
    } catch (e) {
      console.error("Erro ao salvar animal:", e);
      Alert.alert("Erro", "Não foi possível salvar o animal.");
    } finally {
      setSalvando(false);
    }
  };

  const pularAnimal = () => {
    const updated = [...animaisEntrada];
    updated[animalAtual] = { ...updated[animalAtual], status: "pulado" };
    setAnimaisEntrada(updated);
    const proximo = updated.findIndex((a, i) => i > animalAtual && a.status === "pendente");
    if (proximo >= 0) setAnimalAtual(proximo);
  };

  const atualizarAnimal = (campo: keyof AnimalEntrada, valor: any) => {
    const updated = [...animaisEntrada];
    updated[animalAtual] = { ...updated[animalAtual], [campo]: valor };
    setAnimaisEntrada(updated);
  };

  const baixarCsv = () => {
    if (!csvGerado || Platform.OS !== "web") return;
    const blob = new Blob([csvGerado], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `planilha-campo-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const animal = animaisEntrada[animalAtual];
  const concluidos = animaisEntrada.filter((a) => a.status === "concluido").length;
  const totalAnimais = animaisEntrada.length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.titulo}>Entrada de Animais</Text>
      </View>

      {/* Indicador de etapas */}
      <View style={styles.etapasBar}>
        {([1, 2, 3] as Etapa[]).map((e) => (
          <View key={e} style={styles.etapaItem}>
            <View style={[styles.etapaCircle, etapa >= e && styles.etapaCircleAtiva]}>
              <Text style={[styles.etapaNum, etapa >= e && styles.etapaNumAtiva]}>{e}</Text>
            </View>
            <Text style={[styles.etapaLabel, etapa >= e && styles.etapaLabelAtiva]}>
              {e === 1 ? "GTA" : e === 2 ? "Brincos" : "Animais"}
            </Text>
          </View>
        ))}
      </View>

      {/* ─── ETAPA 1: GTA ─────────────────────────────────────────────────────── */}
      {etapa === 1 && (
        <View style={styles.etapaContent}>
          <View style={styles.acoesBtns}>
            <TouchableOpacity style={styles.btnAcao} onPress={() => { setGtaForm({ status: "ativa", farmedaId: fazendaId }); setShowNovaGtaModal(true); }}>
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={styles.btnAcaoText}>Nova GTA</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnAcao, { backgroundColor: "#607D8B" }]}
              onPress={importarPdf}
              disabled={importandoPdf}
            >
              {importandoPdf ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="document" size={16} color="#fff" />
              )}
              <Text style={styles.btnAcaoText}>Importar PDF</Text>
            </TouchableOpacity>
          </View>

          {loadingGtas ? (
            <ActivityIndicator style={{ marginTop: 32 }} size="large" color="#009688" />
          ) : (
            <ScrollView style={{ flex: 1 }}>
              {gtas.length === 0 && (
                <Text style={styles.vazio}>Nenhuma GTA ativa. Crie ou importe uma.</Text>
              )}
              {gtas.map((g) => (
                <TouchableOpacity
                  key={g.id}
                  style={[styles.card, gtaSelecionada?.id === g.id && styles.cardSelecionado]}
                  onPress={() => setGtaSelecionada(g)}
                >
                  <View style={styles.cardRow}>
                    <Text style={styles.cardLabel}>GTA {g.serie} {g.numero}</Text>
                    {gtaSelecionada?.id === g.id && (
                      <Ionicons name="checkmark-circle" size={20} color="#009688" />
                    )}
                  </View>
                  <Text style={styles.cardSub}>{g.procNome} → {g.destFazenda}</Text>
                  <Text style={styles.cardSub}>
                    {g.total} animais · Validade: {g.dataValidade ? new Date(g.dataValidade).toLocaleDateString("pt-BR") : "-"}
                  </Text>
                  <Text style={styles.cardSub}>Finalidade: {g.finalidade}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <TouchableOpacity
            style={[styles.btnPrincipal, !gtaSelecionada && styles.btnDisabled]}
            onPress={avancarEtapa2}
            disabled={!gtaSelecionada}
          >
            <Text style={styles.btnPrincipalText}>Continuar →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ─── ETAPA 2: Pedido de Brinco ──────────────────────────────────────── */}
      {etapa === 2 && gtaSelecionada && (
        <View style={styles.etapaContent}>
          <ScrollView style={{ flex: 1 }}>
            {/* Resumo da GTA */}
            <View style={styles.resumoGta}>
              <Text style={styles.resumoTitulo}>GTA Selecionada</Text>
              <Text style={styles.resumoItem}>Nº {gtaSelecionada.serie} {gtaSelecionada.numero}</Text>
              <Text style={styles.resumoItem}>Procedência: {gtaSelecionada.procNome}</Text>
              <Text style={styles.resumoItem}>Fazenda destino: {gtaSelecionada.destFazenda}</Text>
              <Text style={styles.resumoItem}>Total: {gtaSelecionada.total} animais</Text>
              {gtaSelecionada.animais.map((a, i) => (
                <Text key={i} style={styles.resumoItem}>
                  · {a.descricao}: {a.quantidade}
                </Text>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Selecione o Pedido de Brincos *</Text>

            {pedidos.length === 0 && (
              <View style={styles.alertBox}>
                <Ionicons name="warning" size={16} color="#E65100" />
                <Text style={styles.alertText}>
                  Nenhum pedido com brincos disponíveis. Cadastre em Brincos antes de prosseguir.
                </Text>
              </View>
            )}

            {pedidos.map((p) => {
              const disponiveis = p.brincosTotal - p.proximoIndice;
              const suficiente = disponiveis >= gtaSelecionada.total;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    styles.card,
                    pedidoSelecionado?.id === p.id && styles.cardSelecionado,
                    !suficiente && styles.cardInsuficiente,
                  ]}
                  onPress={() => suficiente && setPedidoSelecionado(p)}
                  disabled={!suficiente}
                >
                  <View style={styles.cardRow}>
                    <Text style={styles.cardLabel}>{p.fabrica}</Text>
                    {pedidoSelecionado?.id === p.id && (
                      <Ionicons name="checkmark-circle" size={20} color="#009688" />
                    )}
                  </View>
                  <Text style={styles.cardSub}>Pedido MAPA: {p.numeroPedidoMapa}</Text>
                  <Text style={styles.cardSub}>
                    Controles: {p.controleInicial} → {p.controleFinal}
                  </Text>
                  <Text style={[styles.cardSub, { fontWeight: "700", color: suficiente ? "#2E7D32" : "#C62828" }]}>
                    {disponiveis} brincos disponíveis {suficiente ? "✓" : `(precisa de ${gtaSelecionada.total})`}
                  </Text>
                  {pedidoSelecionado?.id === p.id && (
                    <Text style={styles.cardSub}>
                      Próximo brinco: {brincoByIndex(p.brincoInicial, p.proximoIndice)}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.botoesNav}>
            <TouchableOpacity style={styles.btnSecundario} onPress={() => setEtapa(1)}>
              <Text style={styles.btnSecundarioText}>← Voltar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnPrincipal, { flex: 1 }, !pedidoSelecionado && styles.btnDisabled]}
              onPress={avancarEtapa3}
              disabled={!pedidoSelecionado}
            >
              <Text style={styles.btnPrincipalText}>Iniciar Cadastro →</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ─── ETAPA 3: Cadastro individual ───────────────────────────────────── */}
      {etapa === 3 && !concluido && animal && (
        <View style={styles.etapaContent}>
          {/* Progresso */}
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${(concluidos / totalAnimais) * 100}%` as any }]} />
          </View>
          <Text style={styles.progressText}>
            {concluidos} de {totalAnimais} animais cadastrados
          </Text>

          <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
            <View style={styles.animalHeader}>
              <Text style={styles.animalSeq}>Animal {animal.sequencia}</Text>
              <Text style={styles.animalSexo}>{animal.sexo === "M" ? "♂ Macho" : "♀ Fêmea"}</Text>
            </View>

            {/* Raça */}
            <Text style={styles.label}>Raça *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
              <View style={styles.row}>
                {RACAS.map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.chip, animal.raca === r && styles.chipActive]}
                    onPress={() => atualizarAnimal("raca", r)}
                  >
                    <Text style={[styles.chipText, animal.raca === r && styles.chipTextActive]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Categoria */}
            <Text style={styles.label}>Categoria *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
              <View style={styles.row}>
                {CATEGORIAS.map((c) => (
                  <TouchableOpacity
                    key={c.value}
                    style={[styles.chip, animal.categoria === c.value && styles.chipActive]}
                    onPress={() => atualizarAnimal("categoria", c.value)}
                  >
                    <Text style={[styles.chipText, animal.categoria === c.value && styles.chipTextActive]}>
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Regime */}
            <Text style={styles.label}>Regime *</Text>
            <View style={styles.row}>
              {REGIMES.map((r) => (
                <TouchableOpacity
                  key={r.value}
                  style={[styles.chip, animal.regime === r.value && styles.chipActive]}
                  onPress={() => atualizarAnimal("regime", r.value)}
                >
                  <Text style={[styles.chipText, animal.regime === r.value && styles.chipTextActive]}>
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Local */}
            <Text style={styles.label}>Local (Piquete / Baia)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
              <View style={styles.row}>
                {locais.map((l) => (
                  <TouchableOpacity
                    key={l.id}
                    style={[styles.chip, animal.localId === l.id && styles.chipActive]}
                    onPress={() => { atualizarAnimal("localId", l.id); atualizarAnimal("localNome", l.nome); }}
                  >
                    <Text style={[styles.chipText, animal.localId === l.id && styles.chipTextActive]}>
                      {l.nome}
                    </Text>
                  </TouchableOpacity>
                ))}
                {locais.length === 0 && (
                  <Text style={styles.vazio}>Nenhum local cadastrado</Text>
                )}
              </View>
            </ScrollView>

            {/* Chip RFID */}
            <Text style={styles.label}>Chip RFID (leitura ou manual)</Text>
            <TextInput
              ref={chipRef}
              style={styles.input}
              value={animal.chipRfid ?? ""}
              onChangeText={(v) => atualizarAnimal("chipRfid", v.replace(/\D/g, ""))}
              placeholder="Aponte o leitor ou digite"
              keyboardType="numeric"
            />

            {/* Peso de entrada */}
            <Text style={styles.label}>Peso de Entrada (kg)</Text>
            <TextInput
              ref={pesoRef}
              style={styles.input}
              value={animal.pesoEntrada?.toString() ?? ""}
              onChangeText={(v) => {
                const n = parseFloat(v.replace(",", "."));
                atualizarAnimal("pesoEntrada", isNaN(n) ? undefined : n);
              }}
              placeholder="Ex: 320.5"
              keyboardType="decimal-pad"
            />

            {/* Info brinco (será preenchido ao salvar) */}
            <View style={styles.brincoInfo}>
              <Ionicons name="pricetag" size={14} color="#795548" />
              <Text style={styles.brincoInfoText}>
                Brinco será atribuído automaticamente do pedido {pedidoSelecionado?.numeroPedidoMapa}
              </Text>
            </View>
          </ScrollView>

          <View style={styles.botoesNav}>
            <TouchableOpacity style={styles.btnSecundario} onPress={pularAnimal}>
              <Text style={styles.btnSecundarioText}>Pular</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnPrincipal, { flex: 1 }, salvando && styles.btnDisabled]}
              onPress={salvarAnimalAtual}
              disabled={salvando}
            >
              {salvando ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.btnPrincipalText}>Salvar e Próximo ✓</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ─── CONCLUÍDO ──────────────────────────────────────────────────────── */}
      {concluido && (
        <View style={styles.concluidoContainer}>
          <Ionicons name="checkmark-circle" size={72} color="#4CAF50" />
          <Text style={styles.concluidoTitulo}>Entrada Concluída!</Text>
          <Text style={styles.concluidoSub}>
            {concluidos} animais cadastrados com sucesso.
          </Text>

          {Platform.OS === "web" && csvGerado && (
            <TouchableOpacity style={styles.btnCsv} onPress={baixarCsv}>
              <Ionicons name="download" size={18} color="#fff" />
              <Text style={styles.btnCsvText}>Baixar Planilha de Campo (.csv)</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.btnPrincipal} onPress={() => router.back()}>
            <Text style={styles.btnPrincipalText}>Voltar ao Início</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ─── Modal: Nova GTA ──────────────────────────────────────────────────── */}
      <Modal visible={showNovaGtaModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>Dados da GTA</Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              {([
                ["Número *", "numero", "numeric"],
                ["Série", "serie", "default"],
                ["UF", "uf", "default"],
                ["Procedência – Nome", "procNome", "default"],
                ["Procedência – CPF/CNPJ", "procCpfCnpj", "default"],
                ["Procedência – Fazenda", "procFazenda", "default"],
                ["Procedência – Código MAPA", "procCodigoMapa", "numeric"],
                ["Procedência – Insc. Estadual", "procInscricaoEstadual", "default"],
                ["Procedência – Município/UF", "procMunicipio", "default"],
                ["Destino – Nome", "destNome", "default"],
                ["Destino – CPF/CNPJ", "destCpfCnpj", "default"],
                ["Destino – Fazenda", "destFazenda", "default"],
                ["Destino – Código MAPA", "destCodigoMapa", "numeric"],
                ["Destino – Insc. Estadual", "destInscricaoEstadual", "default"],
                ["Destino – Município/UF", "destMunicipio", "default"],
                ["Finalidade", "finalidade", "default"],
                ["Transporte", "transporte", "default"],
                ["Data Emissão (AAAA-MM-DD)", "dataEmissao", "default"],
                ["Data Validade (AAAA-MM-DD)", "dataValidade", "default"],
                ["Total de Animais", "total", "numeric"],
                ["Total Machos", "totalMachos", "numeric"],
                ["Total Fêmeas", "totalFemeas", "numeric"],
              ] as [string, keyof GTA, "default" | "numeric"][]).map(([label, campo, kt]) => (
                <View key={campo as string}>
                  <Text style={styles.label}>{label}</Text>
                  <TextInput
                    style={styles.input}
                    value={String((gtaForm as any)[campo] ?? "")}
                    onChangeText={(v) => setGtaForm((prev) => ({ ...prev, [campo]: kt === "numeric" ? (v === "" ? undefined : Number(v)) : v }))}
                    keyboardType={kt}
                    placeholder={label}
                  />
                </View>
              ))}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.btnModal, styles.btnCancelar]}
                onPress={() => { setShowNovaGtaModal(false); setGtaForm({}); }}
              >
                <Text style={styles.btnCancelarText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnModal, styles.btnSalvar, salvandoGta && styles.btnDisabled]}
                onPress={salvarGta}
                disabled={salvandoGta}
              >
                {salvandoGta ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnSalvarText}>Salvar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F5" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#009688",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 56 : 16,
    paddingBottom: 12,
  },
  titulo: { fontSize: 18, fontWeight: "700", color: "#fff" },
  etapasBar: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingVertical: 12,
    paddingHorizontal: 24,
    justifyContent: "space-around",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  etapaItem: { alignItems: "center", gap: 4 },
  etapaCircle: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "#E0E0E0", alignItems: "center", justifyContent: "center",
  },
  etapaCircleAtiva: { backgroundColor: "#009688" },
  etapaNum: { fontSize: 13, fontWeight: "700", color: "#9E9E9E" },
  etapaNumAtiva: { color: "#fff" },
  etapaLabel: { fontSize: 11, color: "#9E9E9E" },
  etapaLabelAtiva: { color: "#009688", fontWeight: "700" },
  etapaContent: { flex: 1, padding: 16, gap: 10 },
  acoesBtns: { flexDirection: "row", gap: 10 },
  btnAcao: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, backgroundColor: "#009688", padding: 10, borderRadius: 8,
  },
  btnAcaoText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    gap: 4,
    borderWidth: 2,
    borderColor: "transparent",
    boxShadow: "0px 1px 4px rgba(0,0,0,0.1)",
  } as any,
  cardSelecionado: { borderColor: "#009688" },
  cardInsuficiente: { opacity: 0.5 },
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardLabel: { fontSize: 15, fontWeight: "700", color: "#333" },
  cardSub: { fontSize: 13, color: "#616161" },
  vazio: { textAlign: "center", color: "#9E9E9E", marginTop: 16 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#555", marginTop: 8 },
  resumoGta: {
    backgroundColor: "#E0F2F1",
    borderRadius: 10,
    padding: 12,
    gap: 3,
  },
  resumoTitulo: { fontWeight: "700", color: "#00695C", marginBottom: 4 },
  resumoItem: { fontSize: 13, color: "#004D40" },
  alertBox: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#FFF3E0",
    borderRadius: 8,
    padding: 12,
    alignItems: "flex-start",
  },
  alertText: { flex: 1, fontSize: 13, color: "#E65100" },
  progressBar: { height: 8, backgroundColor: "#E0E0E0", borderRadius: 4, overflow: "hidden" },
  progressFill: { height: 8, backgroundColor: "#009688", borderRadius: 4 },
  progressText: { fontSize: 12, color: "#616161", textAlign: "center" },
  animalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  animalSeq: { fontSize: 18, fontWeight: "700", color: "#333" },
  animalSexo: { fontSize: 16, color: "#009688", fontWeight: "700" },
  label: { fontSize: 13, fontWeight: "600", color: "#555", marginTop: 10, marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: "#E0E0E0", borderRadius: 8,
    padding: 10, fontSize: 14, backgroundColor: "#FAFAFA", color: "#333",
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    borderWidth: 1, borderColor: "#E0E0E0", backgroundColor: "#F5F5F5",
  },
  chipActive: { backgroundColor: "#009688", borderColor: "#009688" },
  chipText: { fontSize: 13, color: "#555" },
  chipTextActive: { color: "#fff", fontWeight: "700" },
  brincoInfo: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#FFF8E1", borderRadius: 8, padding: 10, marginTop: 12,
  },
  brincoInfoText: { fontSize: 12, color: "#795548", flex: 1 },
  botoesNav: { flexDirection: "row", gap: 10 },
  btnPrincipal: {
    backgroundColor: "#009688", padding: 14, borderRadius: 8, alignItems: "center",
  },
  btnPrincipalText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  btnSecundario: {
    padding: 14, borderRadius: 8, alignItems: "center",
    borderWidth: 1, borderColor: "#009688",
  },
  btnSecundarioText: { color: "#009688", fontWeight: "700" },
  btnDisabled: { opacity: 0.4 },
  concluidoContainer: {
    flex: 1, alignItems: "center", justifyContent: "center",
    padding: 32, gap: 16,
  },
  concluidoTitulo: { fontSize: 24, fontWeight: "700", color: "#333" },
  concluidoSub: { fontSize: 16, color: "#616161", textAlign: "center" },
  btnCsv: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#4CAF50", padding: 14, borderRadius: 8,
  },
  btnCsvText: { color: "#fff", fontWeight: "700" },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: "90%",
  },
  modalTitulo: { fontSize: 18, fontWeight: "700", color: "#333", marginBottom: 12 },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 16 },
  btnModal: { flex: 1, padding: 14, borderRadius: 8, alignItems: "center" },
  btnCancelar: { backgroundColor: "#EEE" },
  btnCancelarText: { color: "#555", fontWeight: "700" },
  btnSalvar: { backgroundColor: "#009688" },
  btnSalvarText: { color: "#fff", fontWeight: "700" },
});
