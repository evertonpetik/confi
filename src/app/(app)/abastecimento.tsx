import { DrawerSceneWrapper } from "@/components/drawe-scene-wrapper";
import { DrawerToggleButton } from "@/components/DrawerToggleButton";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import type { Tanque } from "@/components/TanqueCard";
import type { Veiculo } from "@/components/VeiculoCard";
import { useTheme } from "@/contexts/ThemeContext";
import { useResponsive } from "@/hooks/useResponsive";
import {
  addDocument,
  getCollection,
  updateDocument,
} from "@/services/firestoreService";
import { parseVeiculoQRPayload } from "@/services/qrCodeService";
import { Feather } from "@expo/vector-icons";
import NetInfo from "@react-native-community/netinfo";
import { useFocusEffect } from "@react-navigation/native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
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

type Step = "SCAN_QR" | "PHOTO_BOMBA" | "PHOTO_PAINEL" | "CONFIRM" | "SAVED";

const STEPS: Step[] = ["SCAN_QR", "PHOTO_BOMBA", "PHOTO_PAINEL", "CONFIRM", "SAVED"];

export default function Abastecimento() {
  const { primaryColor } = useTheme();
  const {
    isTablet,
    isDesktop,
    maxWidthContent,
    containerPadding,
    titleFontSize,
    headerPaddingTop,
  } = useResponsive();
  const router = useRouter();

  const [step, setStep] = useState<Step>("SCAN_QR");
  const [permission, requestPermission] = useCameraPermissions();
  const [isOffline, setIsOffline] = useState(false);

  // Data
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [tanques, setTanques] = useState<Tanque[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Selected
  const [selectedVeiculo, setSelectedVeiculo] = useState<Veiculo | null>(null);
  const [selectedVeiculoId, setSelectedVeiculoId] = useState("");
  const [selectedTanqueId, setSelectedTanqueId] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const [scanned, setScanned] = useState(false);

  // Photos & OCR
  const [fotoBombaUri, setFotoBombaUri] = useState<string | null>(null);
  const [litros, setLitros] = useState("");
  const [ocrLitros, setOcrLitros] = useState<number | null>(null);
  const [ocrProcessing, setOcrProcessing] = useState(false);

  const [fotoPainelUri, setFotoPainelUri] = useState<string | null>(null);
  const [marcadorAtual, setMarcadorAtual] = useState("");
  const [ocrMarcador, setOcrMarcador] = useState<number | null>(null);

  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState(false);

  // Network status
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(!state.isConnected);
    });
    return unsubscribe;
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  async function fetchData() {
    try {
      setLoadingData(true);
      const [veiculosSnap, tanquesSnap] = await Promise.all([
        getCollection("veiculos"),
        getCollection("tanques"),
      ]);
      const v: Veiculo[] = veiculosSnap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() } as Veiculo))
        .filter((v) => v.ativo);
      const t: Tanque[] = tanquesSnap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() } as Tanque))
        .filter((t) => t.ativo);
      v.sort((a, b) => a.nome.localeCompare(b.nome));
      t.sort((a, b) => a.nome.localeCompare(b.nome));
      setVeiculos(v);
      setTanques(t);
    } catch (err) {
      console.error("Erro ao buscar dados:", err);
    } finally {
      setLoadingData(false);
    }
  }

  function handleQRScanned({ data }: { data: string }) {
    if (scanned) return;
    setScanned(true);

    const payload = parseVeiculoQRPayload(data);
    if (!payload) {
      Alert.alert("QR Code Invalido", "Este QR code nao pertence a um veiculo cadastrado.");
      setScanned(false);
      return;
    }

    // Find vehicle in local list or use QR data
    const found = veiculos.find((v) => v.id === payload.id);
    if (found) {
      setSelectedVeiculo(found);
      setSelectedVeiculoId(found.id);
    } else {
      // Vehicle from QR data (offline, not in cache)
      setSelectedVeiculo({
        id: payload.id,
        nome: payload.nome,
        tipoMarcador: payload.tipoMarcador,
        tipo: payload.tipoMarcador === "km" ? "veiculo" : payload.tipoMarcador === "horimetro" ? "maquina" : "equipamento",
        placa: "",
        tipoCombustivel: "",
        marcadorAtual: 0,
        ativo: true,
      });
      setSelectedVeiculoId(payload.id);
    }
  }

  function handleManualSelect(veiculoId: string) {
    const found = veiculos.find((v) => v.id === veiculoId);
    setSelectedVeiculoId(veiculoId);
    setSelectedVeiculo(found ?? null);
  }

  function handleTanqueSelect(tanqueId: string) {
    setSelectedTanqueId(tanqueId);
  }

  function proceedFromScan() {
    if (!selectedVeiculo) {
      Alert.alert("Atencao", "Selecione um veiculo.");
      return;
    }
    if (!selectedTanqueId) {
      Alert.alert("Atencao", "Selecione o tanque de combustivel.");
      return;
    }
    setStep("PHOTO_BOMBA");
  }

  async function handleTakePhotoBomba() {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setFotoBombaUri(uri);

      // Try OCR
      setOcrProcessing(true);
      try {
        const { recognizeFuelPumpValue } = await import("@/services/ocrService");
        const ocrResult = await recognizeFuelPumpValue(uri);
        if (ocrResult.extractedValue !== null) {
          setLitros(ocrResult.extractedValue.toString());
          setOcrLitros(ocrResult.extractedValue);
        }
      } catch (err) {
        console.error("OCR error:", err);
      } finally {
        setOcrProcessing(false);
      }
    }
  }

  function proceedFromBomba() {
    const litrosNum = parseFloat(litros.replace(",", "."));
    if (!fotoBombaUri) {
      Alert.alert("Atencao", "Tire a foto da bomba de combustivel.");
      return;
    }
    if (isNaN(litrosNum) || litrosNum <= 0) {
      Alert.alert("Atencao", "Informe a quantidade de litros abastecidos.");
      return;
    }

    if (selectedVeiculo?.tipoMarcador === "nenhum") {
      setStep("CONFIRM");
    } else {
      setStep("PHOTO_PAINEL");
    }
  }

  async function handleTakePhotoPainel() {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setFotoPainelUri(uri);

      // Try OCR
      setOcrProcessing(true);
      try {
        const { recognizeMeterValue } = await import("@/services/ocrService");
        const ocrResult = await recognizeMeterValue(uri);
        if (ocrResult.extractedValue !== null) {
          setMarcadorAtual(ocrResult.extractedValue.toString());
          setOcrMarcador(ocrResult.extractedValue);
        }
      } catch (err) {
        console.error("OCR error:", err);
      } finally {
        setOcrProcessing(false);
      }
    }
  }

  function proceedFromPainel() {
    if (!fotoPainelUri) {
      Alert.alert("Atencao", "Tire a foto do painel.");
      return;
    }
    const marcador = parseFloat(marcadorAtual.replace(",", "."));
    if (isNaN(marcador) || marcador < 0) {
      Alert.alert("Atencao", "Informe a leitura do marcador.");
      return;
    }
    if (selectedVeiculo && marcador < selectedVeiculo.marcadorAtual) {
      Alert.alert(
        "Atencao",
        `A leitura atual (${marcador}) nao pode ser menor que a anterior (${selectedVeiculo.marcadorAtual}).`
      );
      return;
    }
    setStep("CONFIRM");
  }

  async function handleConfirm() {
    if (!selectedVeiculo || !selectedTanqueId) return;
    setSaving(true);

    try {
      const tanque = tanques.find((t) => t.id === selectedTanqueId);
      const litrosNum = parseFloat(litros.replace(",", "."));
      const marcadorNum = parseFloat(marcadorAtual.replace(",", ".")) || 0;
      const marcadorAnterior = selectedVeiculo.marcadorAtual ?? 0;

      let consumo: number | null = null;
      if (
        selectedVeiculo.tipoMarcador !== "nenhum" &&
        marcadorNum > marcadorAnterior
      ) {
        consumo = litrosNum / (marcadorNum - marcadorAnterior);
      }

      const now = new Date();
      const abastecimentoData = {
        data: now.toISOString().split("T")[0],
        hora: now.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        veiculoId: selectedVeiculo.id,
        veiculoNome: selectedVeiculo.nome,
        veiculoTipo: selectedVeiculo.tipo,
        tanqueId: selectedTanqueId,
        tanqueNome: tanque?.nome ?? "",
        litros: litrosNum,
        marcadorAnterior,
        marcadorAtual: marcadorNum,
        consumo,
        fotoBomba: fotoBombaUri ?? "",
        fotoPainel: fotoPainelUri ?? null,
        ocrLitros,
        ocrMarcador,
        observacao: observacao.trim(),
        criadoOffline: isOffline,
        criadoEm: now.toISOString(),
      };

      // Save abastecimento
      await addDocument(["abastecimentos"], abastecimentoData);

      // Update tank level
      if (tanque) {
        const novoNivel = Math.max(0, tanque.nivelAtual - litrosNum);
        await updateDocument(["tanques"], selectedTanqueId, {
          nivelAtual: novoNivel,
        });
      }

      // Update vehicle marker
      if (selectedVeiculo.tipoMarcador !== "nenhum" && marcadorNum > 0) {
        await updateDocument(["veiculos"], selectedVeiculo.id, {
          marcadorAtual: marcadorNum,
        });
      }

      setStep("SAVED");
    } catch (err) {
      console.error("Erro ao salvar abastecimento:", err);
      Alert.alert("Erro", "Nao foi possivel salvar o abastecimento.");
    } finally {
      setSaving(false);
    }
  }

  function handleNewAbastecimento() {
    setStep("SCAN_QR");
    setSelectedVeiculo(null);
    setSelectedVeiculoId("");
    setSelectedTanqueId("");
    setManualMode(false);
    setScanned(false);
    setFotoBombaUri(null);
    setLitros("");
    setOcrLitros(null);
    setFotoPainelUri(null);
    setMarcadorAtual("");
    setOcrMarcador(null);
    setObservacao("");
  }

  // ---- Render helpers ----

  function renderScanQR() {
    const tanqueOptions = tanques
      .filter(
        (t) =>
          !selectedVeiculo?.tipoCombustivel ||
          t.tipoCombustivel === selectedVeiculo.tipoCombustivel
      )
      .map((t) => ({
        label: `${t.nome} (${t.nivelAtual.toLocaleString("pt-BR")} L)`,
        value: t.id,
      }));

    const veiculoOptions = veiculos.map((v) => ({
      label: `${v.nome}${v.placa ? ` - ${v.placa}` : ""}`,
      value: v.id,
    }));

    return (
      <>
        <Text style={styles.stepTitle}>Identificar Veiculo</Text>
        <Text style={styles.stepDescription}>
          Escaneie o QR code do veiculo ou selecione manualmente.
        </Text>

        {!manualMode && !selectedVeiculo && Platform.OS !== "web" && (
          <>
            {!permission?.granted ? (
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: primaryColor }]}
                activeOpacity={0.7}
                onPress={requestPermission}
              >
                <Feather name="camera" size={18} color="#FFF" style={{ marginRight: 8 }} />
                <Text style={styles.primaryButtonText}>Permitir Camera</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.cameraContainer}>
                <CameraView
                  style={styles.camera}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                  onBarcodeScanned={scanned ? undefined : handleQRScanned}
                />
                <View style={styles.cameraOverlay}>
                  <View style={[styles.scanFrame, { borderColor: primaryColor }]} />
                </View>
              </View>
            )}

            <TouchableOpacity
              style={styles.secondaryButton}
              activeOpacity={0.7}
              onPress={() => setManualMode(true)}
            >
              <Text style={[styles.secondaryButtonText, { color: primaryColor }]}>
                Selecionar manualmente
              </Text>
            </TouchableOpacity>
          </>
        )}

        {(manualMode || Platform.OS === "web") && !selectedVeiculo && (
          <View style={{ marginTop: 16 }}>
            <Text style={styles.label}>Veiculo *</Text>
            <Select
              placeholder="Selecione o veiculo"
              value={selectedVeiculoId}
              options={veiculoOptions}
              onSelect={handleManualSelect}
              loading={loadingData}
            />
            {Platform.OS !== "web" && (
              <TouchableOpacity
                style={[styles.secondaryButton, { marginTop: 8 }]}
                activeOpacity={0.7}
                onPress={() => {
                  setManualMode(false);
                  setScanned(false);
                }}
              >
                <Text style={[styles.secondaryButtonText, { color: primaryColor }]}>
                  Voltar para QR code
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {selectedVeiculo && (
          <>
            <View style={styles.infoCard}>
              <View style={styles.infoCardHeader}>
                <Text style={styles.infoCardTitle}>
                  {selectedVeiculo.nome}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedVeiculo(null);
                    setSelectedVeiculoId("");
                    setScanned(false);
                    setManualMode(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Feather name="x" size={18} color="#666" />
                </TouchableOpacity>
              </View>
              {!!selectedVeiculo.placa && (
                <Text style={styles.infoCardDetail}>
                  Placa: {selectedVeiculo.placa}
                </Text>
              )}
              <Text style={styles.infoCardDetail}>
                Tipo:{" "}
                {selectedVeiculo.tipo === "veiculo"
                  ? "Veiculo (km)"
                  : selectedVeiculo.tipo === "maquina"
                    ? "Maquina (horimetro)"
                    : "Equipamento"}
              </Text>
              {selectedVeiculo.tipoMarcador !== "nenhum" && (
                <Text style={styles.infoCardDetail}>
                  {selectedVeiculo.tipoMarcador === "km"
                    ? "Hodometro"
                    : "Horimetro"}
                  : {selectedVeiculo.marcadorAtual.toLocaleString("pt-BR")}{" "}
                  {selectedVeiculo.tipoMarcador === "km" ? "km" : "h"}
                </Text>
              )}
            </View>

            <View style={{ marginTop: 16 }}>
              <Text style={styles.label}>Tanque *</Text>
              <Select
                placeholder="Selecione o tanque"
                value={selectedTanqueId}
                options={tanqueOptions}
                onSelect={handleTanqueSelect}
                loading={loadingData}
              />
            </View>

            <View style={styles.buttonGroup}>
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  { backgroundColor: primaryColor },
                  !selectedTanqueId && styles.buttonDisabled,
                ]}
                activeOpacity={0.7}
                onPress={proceedFromScan}
                disabled={!selectedTanqueId}
              >
                <Text style={styles.primaryButtonText}>Continuar</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </>
    );
  }

  function renderPhotoBomba() {
    return (
      <>
        <Text style={styles.stepTitle}>Foto da Bomba</Text>
        <Text style={styles.stepDescription}>
          Tire uma foto do marcador da bomba de combustivel mostrando os litros
          abastecidos.
        </Text>

        {fotoBombaUri ? (
          <>
            <Image
              source={{ uri: fotoBombaUri }}
              style={styles.previewImage}
              resizeMode="contain"
            />
            <TouchableOpacity
              style={styles.secondaryButton}
              activeOpacity={0.7}
              onPress={() => {
                setFotoBombaUri(null);
                setLitros("");
                setOcrLitros(null);
              }}
            >
              <Text style={[styles.secondaryButtonText, { color: primaryColor }]}>Tirar outra foto</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: primaryColor }]}
            activeOpacity={0.7}
            onPress={handleTakePhotoBomba}
          >
            <Feather
              name="camera"
              size={18}
              color="#FFF"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.primaryButtonText}>Tirar Foto da Bomba</Text>
          </TouchableOpacity>
        )}

        {ocrProcessing && (
          <View style={styles.ocrStatus}>
            <ActivityIndicator size="small" color={primaryColor} />
            <Text style={[styles.ocrStatusText, { color: primaryColor }]}>Lendo imagem...</Text>
          </View>
        )}

        <View style={{ marginTop: 16 }}>
          <Text style={styles.label}>Litros Abastecidos *</Text>
          <Input
            placeholder="Ex: 34"
            value={litros}
            onChangeText={setLitros}
            keyboardType="decimal-pad"
          />
          {ocrLitros !== null && (
            <Text style={styles.ocrHint}>
              Valor lido pela camera: {ocrLitros} L
            </Text>
          )}
        </View>

        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: primaryColor }]}
            activeOpacity={0.7}
            onPress={proceedFromBomba}
          >
            <Text style={styles.primaryButtonText}>Continuar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.backLink}
            activeOpacity={0.7}
            onPress={() => setStep("SCAN_QR")}
          >
            <Feather name="arrow-left" size={16} color={primaryColor} />
            <Text style={[styles.backLinkText, { color: primaryColor }]}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  function renderPhotoPainel() {
    const labelMarcador =
      selectedVeiculo?.tipoMarcador === "km"
        ? "Hodometro (km)"
        : "Horimetro (h)";

    return (
      <>
        <Text style={styles.stepTitle}>Foto do Painel</Text>
        <Text style={styles.stepDescription}>
          Tire uma foto do{" "}
          {selectedVeiculo?.tipoMarcador === "km"
            ? "hodometro"
            : "horimetro"}{" "}
          do veiculo.
        </Text>

        {selectedVeiculo && selectedVeiculo.tipoMarcador !== "nenhum" && (
          <View style={styles.infoCard}>
            <Text style={styles.infoCardDetail}>
              Leitura anterior:{" "}
              {selectedVeiculo.marcadorAtual.toLocaleString("pt-BR")}{" "}
              {selectedVeiculo.tipoMarcador === "km" ? "km" : "h"}
            </Text>
          </View>
        )}

        {fotoPainelUri ? (
          <>
            <Image
              source={{ uri: fotoPainelUri }}
              style={styles.previewImage}
              resizeMode="contain"
            />
            <TouchableOpacity
              style={styles.secondaryButton}
              activeOpacity={0.7}
              onPress={() => {
                setFotoPainelUri(null);
                setMarcadorAtual("");
                setOcrMarcador(null);
              }}
            >
              <Text style={[styles.secondaryButtonText, { color: primaryColor }]}>Tirar outra foto</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: primaryColor }]}
            activeOpacity={0.7}
            onPress={handleTakePhotoPainel}
          >
            <Feather
              name="camera"
              size={18}
              color="#FFF"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.primaryButtonText}>Tirar Foto do Painel</Text>
          </TouchableOpacity>
        )}

        {ocrProcessing && (
          <View style={styles.ocrStatus}>
            <ActivityIndicator size="small" color={primaryColor} />
            <Text style={[styles.ocrStatusText, { color: primaryColor }]}>Lendo imagem...</Text>
          </View>
        )}

        <View style={{ marginTop: 16 }}>
          <Text style={styles.label}>{labelMarcador} *</Text>
          <Input
            placeholder={
              selectedVeiculo?.tipoMarcador === "km"
                ? "Ex: 50000"
                : "Ex: 1903"
            }
            value={marcadorAtual}
            onChangeText={setMarcadorAtual}
            keyboardType="decimal-pad"
          />
          {ocrMarcador !== null && (
            <Text style={styles.ocrHint}>
              Valor lido pela camera: {ocrMarcador}
            </Text>
          )}
        </View>

        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: primaryColor }]}
            activeOpacity={0.7}
            onPress={proceedFromPainel}
          >
            <Text style={styles.primaryButtonText}>Continuar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.backLink}
            activeOpacity={0.7}
            onPress={() => setStep("PHOTO_BOMBA")}
          >
            <Feather name="arrow-left" size={16} color={primaryColor} />
            <Text style={[styles.backLinkText, { color: primaryColor }]}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  function renderConfirm() {
    const litrosNum = parseFloat(litros.replace(",", ".")) || 0;
    const marcadorNum = parseFloat(marcadorAtual.replace(",", ".")) || 0;
    const marcadorAnterior = selectedVeiculo?.marcadorAtual ?? 0;
    const tanque = tanques.find((t) => t.id === selectedTanqueId);

    let consumo: string | null = null;
    if (
      selectedVeiculo?.tipoMarcador !== "nenhum" &&
      marcadorNum > marcadorAnterior
    ) {
      const c = litrosNum / (marcadorNum - marcadorAnterior);
      const unit = selectedVeiculo?.tipoMarcador === "km" ? "L/km" : "L/h";
      consumo = `${c.toFixed(2)} ${unit}`;
    }

    return (
      <>
        <Text style={styles.stepTitle}>Confirmar Abastecimento</Text>

        <View style={styles.confirmCard}>
          <View style={styles.confirmRow}>
            <Text style={styles.confirmLabel}>Veiculo</Text>
            <Text style={styles.confirmValue}>
              {selectedVeiculo?.nome ?? "-"}
            </Text>
          </View>
          <View style={styles.confirmRow}>
            <Text style={styles.confirmLabel}>Tanque</Text>
            <Text style={styles.confirmValue}>{tanque?.nome ?? "-"}</Text>
          </View>
          <View style={styles.confirmRow}>
            <Text style={styles.confirmLabel}>Litros</Text>
            <Text style={styles.confirmValue}>{litrosNum} L</Text>
          </View>
          {selectedVeiculo?.tipoMarcador !== "nenhum" && (
            <>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>
                  {selectedVeiculo?.tipoMarcador === "km"
                    ? "Hodometro"
                    : "Horimetro"}
                </Text>
                <Text style={styles.confirmValue}>
                  {marcadorAnterior.toLocaleString("pt-BR")} {" -> "}{" "}
                  {marcadorNum.toLocaleString("pt-BR")}{" "}
                  {selectedVeiculo?.tipoMarcador === "km" ? "km" : "h"}
                </Text>
              </View>
              {consumo && (
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Consumo</Text>
                  <Text style={styles.confirmValue}>{consumo}</Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* Photo previews */}
        <View style={styles.photosRow}>
          {fotoBombaUri && (
            <View style={styles.photoPreview}>
              <Text style={styles.photoLabel}>Bomba</Text>
              <Image
                source={{ uri: fotoBombaUri }}
                style={styles.photoThumb}
                resizeMode="cover"
              />
            </View>
          )}
          {fotoPainelUri && (
            <View style={styles.photoPreview}>
              <Text style={styles.photoLabel}>Painel</Text>
              <Image
                source={{ uri: fotoPainelUri }}
                style={styles.photoThumb}
                resizeMode="cover"
              />
            </View>
          )}
        </View>

        <View style={{ marginTop: 16 }}>
          <Text style={styles.label}>Observacao (opcional)</Text>
          <Input
            placeholder="Ex: Abastecimento no pasto sul"
            value={observacao}
            onChangeText={setObservacao}
          />
        </View>

        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: primaryColor }]}
            activeOpacity={0.7}
            onPress={handleConfirm}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Feather
                  name="check"
                  size={18}
                  color="#FFF"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.primaryButtonText}>
                  Confirmar Abastecimento
                </Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.backLink}
            activeOpacity={0.7}
            onPress={() =>
              setStep(
                selectedVeiculo?.tipoMarcador === "nenhum"
                  ? "PHOTO_BOMBA"
                  : "PHOTO_PAINEL"
              )
            }
          >
            <Feather name="arrow-left" size={16} color={primaryColor} />
            <Text style={[styles.backLinkText, { color: primaryColor }]}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  function renderSaved() {
    return (
      <View style={styles.savedContainer}>
        <View style={styles.savedIcon}>
          <Feather name="check-circle" size={64} color="#2E7D32" />
        </View>
        <Text style={styles.savedTitle}>Abastecimento Registrado!</Text>
        {isOffline && (
          <Text style={styles.savedOfflineHint}>
            Voce esta offline. Os dados serao sincronizados automaticamente
            quando a conexao for restabelecida.
          </Text>
        )}

        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: primaryColor }]}
            activeOpacity={0.7}
            onPress={handleNewAbastecimento}
          >
            <Feather
              name="plus"
              size={18}
              color="#FFF"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.primaryButtonText}>Novo Abastecimento</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.outlineButton, { borderColor: primaryColor }]}
            activeOpacity={0.7}
            onPress={() =>
              router.replace("/(app)/historico-combustivel" as any)
            }
          >
            <Feather
              name="list"
              size={18}
              color={primaryColor}
              style={{ marginRight: 8 }}
            />
            <Text style={[styles.outlineButtonText, { color: primaryColor }]}>Ver Historico</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const currentStepIndex = STEPS.indexOf(step);

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
              { padding: containerPadding },
              isTablet &&
              !isDesktop && {
                maxWidth: maxWidthContent,
                alignSelf: "center" as const,
                width: "100%",
              },
            ]}
          >
            <View style={[styles.header, { paddingTop: headerPaddingTop }]}>
              <Text
                style={[styles.title, { fontSize: titleFontSize, flex: 1 }]}
                numberOfLines={1}
              >
                Abastecimento
              </Text>
              {!isDesktop && <DrawerToggleButton tintColor="#000000" />}
            </View>

            <Text style={styles.subtitle}>
              Registre o abastecimento de combustivel.
            </Text>

            {isOffline && (
              <View style={styles.offlineBanner}>
                <Feather name="wifi-off" size={14} color="#E65100" />
                <Text style={styles.offlineBannerText}>
                  Sem conexao - dados serao sincronizados automaticamente
                </Text>
              </View>
            )}

            {/* Step indicators */}
            <View style={styles.stepIndicator}>
              {STEPS.map((s, i) => (
                <View
                  key={s}
                  style={[
                    styles.stepDot,
                    step === s && [styles.stepDotActive, { backgroundColor: primaryColor }],
                    currentStepIndex > i && { backgroundColor: primaryColor },
                  ]}
                />
              ))}
            </View>

            {step === "SCAN_QR" && renderScanQR()}
            {step === "PHOTO_BOMBA" && renderPhotoBomba()}
            {step === "PHOTO_PAINEL" && renderPhotoPainel()}
            {step === "CONFIRM" && renderConfirm()}
            {step === "SAVED" && renderSaved()}
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
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFF3E0",
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
  },
  offlineBannerText: {
    fontSize: 13,
    color: "#E65100",
    fontWeight: "500",
    flex: 1,
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
    width: 28,
  },
  stepDotDone: {
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
  cameraContainer: {
    height: 280,
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 16,
    position: "relative",
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  scanFrame: {
    width: 200,
    height: 200,
    borderWidth: 2,
    borderRadius: 16,
  },
  infoCard: {
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  infoCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoCardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  infoCardDetail: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
  },
  previewImage: {
    width: "100%",
    height: 220,
    borderRadius: 12,
    marginTop: 16,
    backgroundColor: "#F0F0F0",
  },
  ocrStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  ocrStatusText: {
    fontSize: 13,
    fontWeight: "500",
  },
  ocrHint: {
    fontSize: 12,
    color: "#2E7D32",
    marginTop: 4,
    fontStyle: "italic",
  },
  confirmCard: {
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    gap: 10,
  },
  confirmRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  confirmLabel: {
    fontSize: 14,
    color: "#666",
  },
  confirmValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  photosRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  photoPreview: {
    flex: 1,
  },
  photoLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  photoThumb: {
    height: 100,
    borderRadius: 8,
    backgroundColor: "#F0F0F0",
  },
  buttonGroup: {
    marginTop: 24,
    gap: 12,
  },
  primaryButton: {
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
    marginTop: 8,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  outlineButton: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  outlineButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
  backLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "center",
  },
  backLinkText: {
    fontSize: 14,
    fontWeight: "500",
  },
  savedContainer: {
    alignItems: "center",
    paddingVertical: 32,
  },
  savedIcon: {
    marginBottom: 16,
  },
  savedTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#2E7D32",
    textAlign: "center",
  },
  savedOfflineHint: {
    fontSize: 14,
    color: "#E65100",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
});
