import { DrawerSceneWrapper } from "@/components/drawe-scene-wrapper";
import { DrawerToggleButton } from "@/components/DrawerToggleButton";
import {
  calcularPesoMedio,
  calcularQuantidadeAtual,
  type Lote,
  type Movimentacao,
} from "@/components/LoteCard";
import { Select } from "@/components/Select";
import { useResponsive } from "@/hooks/useResponsive";
import {
  estimarPesoPorImagem,
  type AnimalContext,
  type EstimativaPesoResult,
} from "@/services/aiWeightEstimation";
import {
  addDocument,
  getCollection,
} from "@/services/firestoreService";
import { Feather } from "@expo/vector-icons";
import NetInfo from "@react-native-community/netinfo";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type Step = "SELECT_LOTE" | "CAMERA" | "ANALYZING" | "RESULTS";

export default function EstimativaPeso() {
  const { isTablet, isDesktop, maxWidthContent } = useResponsive();

  const [step, setStep] = useState<Step>("SELECT_LOTE");
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [loadingLotes, setLoadingLotes] = useState(true);
  const [selectedLoteId, setSelectedLoteId] = useState("");
  const [selectedLote, setSelectedLote] = useState<Lote | null>(null);
  const [pesoProjetado, setPesoProjetado] = useState<number | null>(null);

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState("image/jpeg");

  const [result, setResult] = useState<EstimativaPesoResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchLotes();
    }, [])
  );

  async function fetchLotes() {
    try {
      setLoadingLotes(true);
      const lotesSnap = await getCollection("lotes");
      const lotesData: Lote[] = [];

      for (const doc of lotesSnap.docs) {
        const d = doc.data();
        if (!d.ativo) continue;

        const movSnap = await getCollection("lotes", doc.id, "movimentacoes");
        const movimentacoes: Movimentacao[] = movSnap.docs.map((m) => ({
          id: m.id,
          ...m.data(),
        })) as Movimentacao[];

        const qtd = calcularQuantidadeAtual(movimentacoes);
        if (qtd <= 0) continue;

        lotesData.push({
          id: doc.id,
          ...d,
          movimentacoes,
        } as Lote);
      }

      lotesData.sort((a, b) => a.numero - b.numero);
      setLotes(lotesData);
    } catch (err) {
      console.error("Erro ao buscar lotes:", err);
    } finally {
      setLoadingLotes(false);
    }
  }

  function handleSelectLote(loteId: string) {
    setSelectedLoteId(loteId);
    const lote = lotes.find((l) => l.id === loteId) ?? null;
    setSelectedLote(lote);
    if (lote) {
      setPesoProjetado(calcularPesoMedio(lote.movimentacoes, lote.gmdEstimado));
    } else {
      setPesoProjetado(null);
    }
  }

  function goToCamera() {
    setStep("CAMERA");
  }

  function skipLote() {
    setSelectedLoteId("");
    setSelectedLote(null);
    setPesoProjetado(null);
    setStep("CAMERA");
  }

  async function handleTakePhoto() {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      base64: true,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setImageUri(asset.uri);
      setImageBase64(asset.base64 ?? null);
      setImageMimeType(asset.mimeType ?? "image/jpeg");
    }
  }

  async function handlePickFromGallery() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      base64: true,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setImageUri(asset.uri);
      setImageBase64(asset.base64 ?? null);
      setImageMimeType(asset.mimeType ?? "image/jpeg");
    }
  }

  function clearPhoto() {
    setImageUri(null);
    setImageBase64(null);
  }

  async function handleAnalyze() {
    if (!imageBase64) {
      Alert.alert("Erro", "Nenhuma imagem selecionada.");
      return;
    }

    // Check connectivity
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      Alert.alert(
        "Sem Conexao",
        "Estimativa de peso requer conexao com a internet."
      );
      return;
    }

    setStep("ANALYZING");
    setError(null);

    try {
      // Fetch API key from configuracoesIA
      const configSnap = await getCollection("configuracoesIA");
      const apiKeyDoc = configSnap.docs.find(
        (d) => d.data().descricao === "ANTHROPIC_API_KEY"
      );
      const apiKey = apiKeyDoc?.data().valor as string | undefined;

      if (!apiKey) {
        Alert.alert(
          "Configuracao",
          "Chave da API Anthropic nao configurada. Va em Configuracoes > Configuracoes IA e adicione um registro com descricao 'ANTHROPIC_API_KEY' e o valor da sua chave."
        );
        setStep("CAMERA");
        return;
      }

      const contexto: AnimalContext | undefined = selectedLote
        ? {
          raca: selectedLote.raca || undefined,
          categoria: selectedLote.categoria || undefined,
          tamanhoCorporal: selectedLote.tamanhoCorporal || undefined,
          pesoProjetado: pesoProjetado ?? undefined,
          gmdEstimado: selectedLote.gmdEstimado || undefined,
        }
        : undefined;

      const resultado = await estimarPesoPorImagem(
        imageBase64,
        imageMimeType,
        apiKey,
        contexto
      );

      setResult(resultado);
      setStep("RESULTS");
    } catch (err: any) {
      console.error("Erro na estimativa:", err);
      setError(err.message ?? "Erro desconhecido ao analisar a imagem.");
      Alert.alert("Erro", err.message ?? "Nao foi possivel analisar a imagem.");
      setStep("CAMERA");
    }
  }

  async function handleSave() {
    if (!result) return;
    setSaving(true);

    try {
      const docData = {
        data: new Date().toISOString().split("T")[0],
        hora: new Date().toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        pesoEstimado: result.pesoEstimado,
        confiancaMin: result.confiancaMin,
        confiancaMax: result.confiancaMax,
        escoreCondicaoCorporal: result.escoreCondicaoCorporal,
        metodo: "ia_visual",
        observacao: result.observacao,
        loteId: selectedLote?.id ?? null,
        loteNumero: selectedLote?.numero ?? null,
        raca: selectedLote?.raca ?? null,
        categoria: selectedLote?.categoria ?? null,
        pesoProjetadoSistema: pesoProjetado ?? null,
      };

      if (selectedLote) {
        await addDocument(["lotes", selectedLote.id, "estimativasPeso"], docData);
      } else {
        await addDocument(["estimativasPesoAvulsas"], docData);
      }

      Alert.alert("Sucesso", "Estimativa salva com sucesso!");
    } catch (err) {
      console.error("Erro ao salvar:", err);
      Alert.alert("Erro", "Nao foi possivel salvar a estimativa.");
    } finally {
      setSaving(false);
    }
  }

  function handleNewEstimation() {
    setStep("SELECT_LOTE");
    setSelectedLoteId("");
    setSelectedLote(null);
    setPesoProjetado(null);
    setImageUri(null);
    setImageBase64(null);
    setResult(null);
    setError(null);
  }

  // ---- Render helpers per step ----

  function renderSelectLote() {
    const loteOptions = lotes.map((l) => ({
      label: `Lote ${l.numero} - ${l.raca || "Sem raca"}`,
      value: l.id,
    }));

    return (
      <>
        <Text style={styles.stepTitle}>Selecione o Lote (opcional)</Text>
        <Text style={styles.stepDescription}>
          Selecionar o lote melhora a estimativa, pois fornece informacoes como
          raca, categoria e peso projetado.
        </Text>

        <View style={{ marginTop: 16 }}>
          <Text style={styles.label}>Lote</Text>
          <Select
            placeholder="Selecione um lote"
            value={selectedLoteId}
            options={loteOptions}
            onSelect={handleSelectLote}
            loading={loadingLotes}
          />
        </View>

        {selectedLote && (
          <View style={styles.loteInfoCard}>
            <Text style={styles.loteInfoTitle}>
              Lote {selectedLote.numero}
            </Text>
            {!!selectedLote.raca && (
              <Text style={styles.loteInfoDetail}>
                Raca: {selectedLote.raca}
              </Text>
            )}
            {!!selectedLote.categoria && (
              <Text style={styles.loteInfoDetail}>
                Categoria: {selectedLote.categoria}
              </Text>
            )}
            {pesoProjetado !== null && pesoProjetado > 0 && (
              <Text style={styles.loteInfoDetail}>
                Peso Projetado: {pesoProjetado.toFixed(1)} kg
              </Text>
            )}
            {!!selectedLote.gmdEstimado && (
              <Text style={styles.loteInfoDetail}>
                GMD Estimado: {selectedLote.gmdEstimado} kg/dia
              </Text>
            )}
          </View>
        )}

        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={[styles.primaryButton, !selectedLoteId && styles.buttonDisabled]}
            activeOpacity={0.7}
            onPress={goToCamera}
            disabled={!selectedLoteId}
          >
            <Text style={styles.primaryButtonText}>Continuar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            activeOpacity={0.7}
            onPress={skipLote}
          >
            <Text style={styles.secondaryButtonText}>
              Pular sem selecionar lote
            </Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  function renderCamera() {
    return (
      <>
        <Text style={styles.stepTitle}>Foto do Animal</Text>
        <Text style={styles.stepDescription}>
          Posicione o animal de lado, corpo inteiro visivel, a aproximadamente
          3-5 metros de distancia. Quanto melhor a foto, mais precisa a
          estimativa.
        </Text>

        {/* Camera guidance */}
        <View style={styles.guideCard}>
          <Feather name="info" size={18} color="#3366FF" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.guideText}>
              Dicas para uma boa foto:
            </Text>
            <Text style={styles.guideTip}>
              {"\u2022"} Fotografe de lado (perfil do animal)
            </Text>
            <Text style={styles.guideTip}>
              {"\u2022"} Corpo inteiro visivel na foto
            </Text>
            <Text style={styles.guideTip}>
              {"\u2022"} Boa iluminacao, sem sombras fortes
            </Text>
            <Text style={styles.guideTip}>
              {"\u2022"} Distancia de 3 a 5 metros
            </Text>
          </View>
        </View>

        {imageUri ? (
          <>
            <Image
              source={{ uri: imageUri }}
              style={styles.previewImage}
              resizeMode="contain"
            />
            <View style={styles.buttonGroup}>
              <TouchableOpacity
                style={styles.primaryButton}
                activeOpacity={0.7}
                onPress={handleAnalyze}
              >
                <Feather name="zap" size={18} color="#FFF" style={{ marginRight: 8 }} />
                <Text style={styles.primaryButtonText}>Analisar Imagem</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                activeOpacity={0.7}
                onPress={clearPhoto}
              >
                <Text style={styles.secondaryButtonText}>Tirar outra foto</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={styles.primaryButton}
              activeOpacity={0.7}
              onPress={handleTakePhoto}
            >
              <Feather name="camera" size={18} color="#FFF" style={{ marginRight: 8 }} />
              <Text style={styles.primaryButtonText}>Tirar Foto</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.outlineButton}
              activeOpacity={0.7}
              onPress={handlePickFromGallery}
            >
              <Feather name="image" size={18} color="#3366FF" style={{ marginRight: 8 }} />
              <Text style={styles.outlineButtonText}>Escolher da Galeria</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={styles.backLink}
          activeOpacity={0.7}
          onPress={() => {
            clearPhoto();
            setStep("SELECT_LOTE");
          }}
        >
          <Feather name="arrow-left" size={16} color="#3366FF" />
          <Text style={styles.backLinkText}>Voltar para selecao de lote</Text>
        </TouchableOpacity>
      </>
    );
  }

  function renderAnalyzing() {
    return (
      <View style={styles.analyzingContainer}>
        <ActivityIndicator size="large" color="#3366FF" />
        <Text style={styles.analyzingTitle}>Analisando imagem...</Text>
        <Text style={styles.analyzingSubtitle}>
          A inteligencia artificial esta avaliando o animal na foto.
          Isso pode levar alguns segundos.
        </Text>
      </View>
    );
  }

  function renderResults() {
    if (!result) return null;

    const delta = pesoProjetado
      ? result.pesoEstimado - pesoProjetado
      : null;
    const deltaPercent = pesoProjetado && pesoProjetado > 0
      ? (Math.abs(delta!) / pesoProjetado) * 100
      : null;

    let deltaColor = "#2E7D32"; // green
    if (deltaPercent !== null) {
      if (deltaPercent > 20) deltaColor = "#E53935"; // red
      else if (deltaPercent > 10) deltaColor = "#FF9800"; // orange
    }

    return (
      <>
        <Text style={styles.stepTitle}>Resultado da Estimativa</Text>

        {/* Main result card */}
        <View style={styles.resultCard}>
          <Text style={styles.resultMainLabel}>Peso Estimado</Text>
          <Text style={styles.resultMainValue}>
            ~{result.pesoEstimado.toFixed(0)} kg
          </Text>
          <Text style={styles.resultRange}>
            Faixa: {result.confiancaMin.toFixed(0)} - {result.confiancaMax.toFixed(0)} kg
          </Text>

          <View style={styles.resultBadgeRow}>
            <View style={styles.eccBadge}>
              <Text style={styles.eccBadgeText}>
                ECC: {result.escoreCondicaoCorporal}/9
              </Text>
            </View>
          </View>

          {!!result.observacao && (
            <Text style={styles.resultObservacao}>
              {result.observacao}
            </Text>
          )}
        </View>

        {/* Comparison with projected weight */}
        {pesoProjetado !== null && pesoProjetado > 0 && (
          <View style={styles.comparisonCard}>
            <Text style={styles.comparisonTitle}>
              Comparacao com o Sistema
            </Text>
            <View style={styles.comparisonRow}>
              <View style={styles.comparisonItem}>
                <Text style={styles.comparisonLabel}>Peso Projetado</Text>
                <Text style={styles.comparisonValue}>
                  {pesoProjetado.toFixed(1)} kg
                </Text>
              </View>
              <View style={styles.comparisonItem}>
                <Text style={styles.comparisonLabel}>Peso IA</Text>
                <Text style={styles.comparisonValue}>
                  {result.pesoEstimado.toFixed(0)} kg
                </Text>
              </View>
              <View style={styles.comparisonItem}>
                <Text style={styles.comparisonLabel}>Diferenca</Text>
                <Text style={[styles.comparisonValue, { color: deltaColor }]}>
                  {delta! > 0 ? "+" : ""}
                  {delta!.toFixed(0)} kg
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Image preview */}
        {imageUri && (
          <Image
            source={{ uri: imageUri }}
            style={styles.resultImagePreview}
            resizeMode="contain"
          />
        )}

        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.7}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Feather name="save" size={18} color="#FFF" style={{ marginRight: 8 }} />
                <Text style={styles.primaryButtonText}>Salvar Estimativa</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.outlineButton}
            activeOpacity={0.7}
            onPress={handleNewEstimation}
          >
            <Feather name="refresh-cw" size={18} color="#3366FF" style={{ marginRight: 8 }} />
            <Text style={styles.outlineButtonText}>Nova Estimativa</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  return (
    <DrawerSceneWrapper>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.select({ ios: "padding", android: "height" })}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.container,
              isTablet &&
              !isDesktop && {
                maxWidth: maxWidthContent,
                alignSelf: "center" as const,
                width: "100%",
              },
            ]}
          >
            <View style={styles.header}>
              <Text style={styles.title}>Estimativa de Peso</Text>
              {!isDesktop && <DrawerToggleButton tintColor="#000000" />}
            </View>
            <Text style={styles.subtitle}>
              Estime o peso do animal por foto usando inteligencia artificial.
            </Text>

            {/* Step indicators */}
            <View style={styles.stepIndicator}>
              {(["SELECT_LOTE", "CAMERA", "ANALYZING", "RESULTS"] as Step[]).map(
                (s, i) => (
                  <View
                    key={s}
                    style={[
                      styles.stepDot,
                      step === s && styles.stepDotActive,
                      (
                        ["SELECT_LOTE", "CAMERA", "ANALYZING", "RESULTS"] as Step[]
                      ).indexOf(step) > i && styles.stepDotDone,
                    ]}
                  />
                )
              )}
            </View>

            {step === "SELECT_LOTE" && renderSelectLote()}
            {step === "CAMERA" && renderCamera()}
            {step === "ANALYZING" && renderAnalyzing()}
            {step === "RESULTS" && renderResults()}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </DrawerSceneWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FDFDFD",
    padding: 32,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 40,
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginTop: 8,
  },
  stepIndicator: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 24,
    marginBottom: 24,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#DCDCDC",
  },
  stepDotActive: {
    backgroundColor: "#3366FF",
    width: 28,
  },
  stepDotDone: {
    backgroundColor: "#3366FF",
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#444",
    marginBottom: 6,
  },
  loteInfoCard: {
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  loteInfoTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  loteInfoDetail: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
  },
  buttonGroup: {
    marginTop: 24,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: "#3366FF",
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFF",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  secondaryButton: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3366FF",
  },
  outlineButton: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#3366FF",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  outlineButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#3366FF",
  },
  guideCard: {
    backgroundColor: "#EEF2FF",
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  guideText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  guideTip: {
    fontSize: 13,
    color: "#444",
    lineHeight: 20,
  },
  previewImage: {
    width: "100%",
    height: 280,
    borderRadius: 12,
    marginTop: 16,
    backgroundColor: "#F0F0F0",
  },
  backLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 20,
    alignSelf: "center",
  },
  backLinkText: {
    fontSize: 14,
    color: "#3366FF",
    fontWeight: "500",
  },
  analyzingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
  },
  analyzingTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a1a",
    marginTop: 20,
  },
  analyzingSubtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginTop: 8,
    maxWidth: 300,
    lineHeight: 20,
  },
  resultCard: {
    backgroundColor: "#F5F5F5",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginTop: 8,
  },
  resultMainLabel: {
    fontSize: 14,
    color: "#666",
    fontWeight: "600",
  },
  resultMainValue: {
    fontSize: 48,
    fontWeight: "900",
    color: "#1a1a1a",
    marginTop: 4,
  },
  resultRange: {
    fontSize: 14,
    color: "#888",
    marginTop: 4,
  },
  resultBadgeRow: {
    flexDirection: "row",
    marginTop: 12,
  },
  eccBadge: {
    backgroundColor: "#3366FF",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  eccBadgeText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "700",
  },
  resultObservacao: {
    fontSize: 14,
    color: "#444",
    textAlign: "center",
    marginTop: 16,
    lineHeight: 20,
    fontStyle: "italic",
  },
  comparisonCard: {
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  comparisonTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 12,
  },
  comparisonRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  comparisonItem: {
    alignItems: "center",
  },
  comparisonLabel: {
    fontSize: 12,
    color: "#999",
  },
  comparisonValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a1a",
    marginTop: 4,
  },
  resultImagePreview: {
    width: "100%",
    height: 180,
    borderRadius: 12,
    marginTop: 16,
    backgroundColor: "#F0F0F0",
  },
});
