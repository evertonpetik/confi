import { DrawerSceneWrapper } from "@/components/drawe-scene-wrapper";
import { DrawerToggleButton } from "@/components/DrawerToggleButton";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useResponsive } from "@/hooks/useResponsive";
import { PesagemFirestoreService } from "@/services/pesagemFirestoreService";
import serialService from "@/services/serialService";
import { Bovino } from "@/services/weighing.types";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// ─── BLE nativo (apenas Android/iOS) ─────────────────────────────────────────
// Importado condicionalmente para evitar erros no web build
let BluetoothService: any = null;
if (Platform.OS !== "web") {
  try {
    BluetoothService = require("@/services/bluetoothService").obterBluetoothService;
  } catch {
    BluetoothService = null;
  }
}

const isWeb = Platform.OS === "web";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatarChip(chip: string): string {
  return chip.replace(/(\d{3})(\d{6})(\d{6})/, "$1.$2.$3");
}

// Mínimo de leituras estáveis consecutivas antes de aceitar o peso
const LEITURAS_ESTABILIDADE = 3;
const VARIACAO_ESTABILIDADE_KG = 0.5;

type ConexaoEstado = "desconectado" | "conectando" | "conectado" | "erro";

interface DispositivoInfo {
  id: string;
  label: string;
  tipo: "balanca" | "rfid";
  estado: ConexaoEstado;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function PesagemBalanca() {
  const { animalId: paramAnimalId, chipId: paramChipId } = useLocalSearchParams<{
    animalId?: string;
    chipId?: string;
  }>();

  const { selectedFazendaId, userProfile } = useAuth();
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
  const fazendaId = selectedFazendaId ?? "";

  // ─── Estado de conexão ─────────────────────────────────────────────────────
  const [dispositivos, setDispositivos] = useState<DispositivoInfo[]>([]);
  const [balancaConectada, setBalancaConectada] = useState(false);
  const [rfidConectado, setRfidConectado] = useState(false);

  // ─── Estado de leitura ─────────────────────────────────────────────────────
  const [pesoAtual, setPesoAtual] = useState<number | null>(null);
  const [pesoEstavel, setPesoEstavel] = useState(false);
  const [chipLido, setChipLido] = useState<string | null>(paramChipId ?? null);
  const [animal, setAnimal] = useState<Bovino | null>(null);
  const [buscandoAnimal, setBuscandoAnimal] = useState(false);

  // ─── Entrada manual ────────────────────────────────────────────────────────
  const [modoManual, setModoManual] = useState(false);
  const [inputChip, setInputChip] = useState(paramChipId ?? "");
  const [inputPeso, setInputPeso] = useState("");
  const [inputObs, setInputObs] = useState("");

  // ─── Salvamento ────────────────────────────────────────────────────────────
  const [salvando, setSalvando] = useState(false);
  const [pesagemSalva, setPesagemSalva] = useState(false);

  // ─── Animações ─────────────────────────────────────────────────────────────
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const leituras = useRef<number[]>([]);

  // Pulso quando peso está estável
  useEffect(() => {
    if (pesoEstavel) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.04, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [pesoEstavel]);

  // ─── Busca animal pelo chip ────────────────────────────────────────────────
  const buscarAnimalPorChip = useCallback(
    async (chip: string) => {
      if (!fazendaId || chip.length !== 15) return;
      setBuscandoAnimal(true);
      try {
        const found = await PesagemFirestoreService.obterBovinoPorChip(chip, fazendaId);
        setAnimal(found);
        if (!found) {
          // Chip lido mas não cadastrado — avisa sem bloquear
          console.warn("[Pesagem] Animal não encontrado para chip:", chip);
        }
      } finally {
        setBuscandoAnimal(false);
      }
    },
    [fazendaId]
  );

  // Se vier animalId via params, carrega o animal
  useEffect(() => {
    if (paramAnimalId && fazendaId) {
      PesagemFirestoreService.listarBovinos(fazendaId).then((lista) => {
        const found = lista.find((b) => b.id === paramAnimalId) ?? null;
        setAnimal(found);
        if (found) setChipLido(found.chipId);
      });
    }
  }, [paramAnimalId, fazendaId]);

  // ─── Callback de peso recebido (serial ou BLE) ────────────────────────────
  const handlePesoRecebido = useCallback((peso: number) => {
    if (peso < 10 || peso > 2000) return; // fora de range físico

    leituras.current.push(peso);
    if (leituras.current.length > LEITURAS_ESTABILIDADE * 2) {
      leituras.current.shift();
    }

    setPesoAtual(peso);

    // Verifica estabilidade: últimas N leituras dentro da variação
    if (leituras.current.length >= LEITURAS_ESTABILIDADE) {
      const recentes = leituras.current.slice(-LEITURAS_ESTABILIDADE);
      const max = Math.max(...recentes);
      const min = Math.min(...recentes);
      setPesoEstavel(max - min <= VARIACAO_ESTABILIDADE_KG);
    } else {
      setPesoEstavel(false);
    }
  }, []);

  // ─── Callback de chip recebido (serial ou BLE) ────────────────────────────
  const handleChipRecebido = useCallback(
    (chip: string) => {
      if (chip.length !== 15) return;
      setChipLido(chip);
      setInputChip(chip);
      buscarAnimalPorChip(chip);
    },
    [buscarAnimalPorChip]
  );

  // ─── Conexão Web Serial (PC / Browser) ────────────────────────────────────
  const conectarSerialBalanca = async () => {
    try {
      const dev = await serialService.requestPort("balanca", 9600);
      if (!dev) return;
      setDispositivos((prev) => [
        ...prev.filter((d) => d.tipo !== "balanca"),
        { id: dev.id, label: dev.label, tipo: "balanca", estado: "conectado" },
      ]);
      setBalancaConectada(true);
      serialService.onWeight(handlePesoRecebido);
    } catch (err: any) {
      Alert.alert("Erro", err.message ?? "Não foi possível conectar a balança.");
    }
  };

  const conectarSerialRfid = async () => {
    try {
      const dev = await serialService.requestPort("rfid", 9600);
      if (!dev) return;
      setDispositivos((prev) => [
        ...prev.filter((d) => d.tipo !== "rfid"),
        { id: dev.id, label: dev.label, tipo: "rfid", estado: "conectado" },
      ]);
      setRfidConectado(true);
      serialService.onRfid(handleChipRecebido);
    } catch (err: any) {
      Alert.alert("Erro", err.message ?? "Não foi possível conectar o leitor RFID.");
    }
  };

  // Tenta reconectar portas já concedidas ao reabrir a página (web)
  useEffect(() => {
    if (!isWeb || !serialService.isSupported) return;
    serialService.reconnectGranted(9600).then((devs) => {
      if (devs.length > 0) {
        setDispositivos(
          devs.map((d) => ({ id: d.id, label: d.label, tipo: d.type as any, estado: "conectado" as const }))
        );
        serialService.onWeight(handlePesoRecebido);
        serialService.onRfid(handleChipRecebido);
        setBalancaConectada(true);
        setRfidConectado(true);
      }
    });
    return () => { serialService.disconnectAll(); };
  }, []);

  // ─── Salvar pesagem ────────────────────────────────────────────────────────
  const pesoParaSalvar = modoManual
    ? parseFloat(inputPeso.replace(",", "."))
    : pesoAtual;
  const chipParaSalvar = modoManual ? inputChip : chipLido;

  const salvarPesagem = async () => {
    if (!pesoParaSalvar || isNaN(pesoParaSalvar) || pesoParaSalvar <= 0) {
      Alert.alert("Atenção", "Peso inválido. Verifique a leitura da balança.");
      return;
    }
    if (!chipParaSalvar || chipParaSalvar.length !== 15) {
      Alert.alert("Atenção", "Chip inválido. O número SISBOV deve ter 15 dígitos.");
      return;
    }
    if (!animal) {
      Alert.alert(
        "Animal não cadastrado",
        "O chip lido não está cadastrado. Deseja registrar a pesagem assim mesmo?",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Registrar mesmo assim", onPress: () => _persistir() },
        ]
      );
      return;
    }
    await _persistir();
  };

  const _persistir = async () => {
    setSalvando(true);
    try {
      const animalAlvo = animal ?? { id: `chip_${chipParaSalvar}` } as Bovino;
      await PesagemFirestoreService.registrarPesagemRapida(
        animalAlvo.id,
        chipParaSalvar!,
        pesoParaSalvar!,
        fazendaId,
        userProfile?.uid ?? "sistema",
        inputObs || undefined
      );
      setPesagemSalva(true);
      leituras.current = [];
      setTimeout(() => setPesagemSalva(false), 3000);
    } catch {
      Alert.alert("Erro", "Não foi possível salvar a pesagem. Verifique a conexão.");
    } finally {
      setSalvando(false);
    }
  };

  const resetarLeitura = () => {
    setPesoAtual(null);
    setPesoEstavel(false);
    setChipLido(paramChipId ?? null);
    setInputChip(paramChipId ?? "");
    setInputPeso("");
    setInputObs("");
    leituras.current = [];
    if (!paramAnimalId) setAnimal(null);
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  const corPeso = pesoEstavel ? "#2E7D32" : pesoAtual ? "#E65100" : "#9E9E9E";

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
              <Text style={[styles.titulo, { fontSize: titleFontSize }]}>Pesagem</Text>
              <Text style={styles.subtitulo}>Balança + Leitor RFID</Text>
            </View>
            {!isDesktop && <DrawerToggleButton tintColor="#000000" />}
          </View>

          {/* Painel de conexão de dispositivos */}
          <View style={styles.conexaoPanel}>
            <Text style={[styles.secaoTitulo, { color: primaryColor }]}>
              {isWeb ? "Conexão via Porta Serial (Bluetooth)" : "Conexão Bluetooth"}
            </Text>
            <Text style={styles.conexaoHint}>
              {isWeb
                ? "No PC, pareie a balança/leitor via Bluetooth e selecione a porta COM virtual."
                : "Certifique-se que Bluetooth está ativo no celular."}
            </Text>

            <View style={styles.dispositivosRow}>
              {/* Balança */}
              <View style={[styles.dispositivoCard, balancaConectada && styles.dispositivoOk]}>
                <Feather
                  name="activity"
                  size={24}
                  color={balancaConectada ? "#2E7D32" : "#9E9E9E"}
                />
                <Text style={[styles.dispositivoLabel, balancaConectada && { color: "#2E7D32" }]}>
                  Balança
                </Text>
                <Text style={styles.dispositivoStatus}>
                  {balancaConectada ? "Conectada" : "Desconectada"}
                </Text>
                {isWeb && !balancaConectada && (
                  <TouchableOpacity
                    style={[styles.btnConectar, { borderColor: primaryColor }]}
                    onPress={conectarSerialBalanca}
                  >
                    <Text style={[styles.btnConectarText, { color: primaryColor }]}>Conectar</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Leitor RFID */}
              <View style={[styles.dispositivoCard, rfidConectado && styles.dispositivoOk]}>
                <Feather
                  name="radio"
                  size={24}
                  color={rfidConectado ? "#2E7D32" : "#9E9E9E"}
                />
                <Text style={[styles.dispositivoLabel, rfidConectado && { color: "#2E7D32" }]}>
                  Leitor RFID
                </Text>
                <Text style={styles.dispositivoStatus}>
                  {rfidConectado ? "Conectado" : "Desconectado"}
                </Text>
                {isWeb && !rfidConectado && (
                  <TouchableOpacity
                    style={[styles.btnConectar, { borderColor: primaryColor }]}
                    onPress={conectarSerialRfid}
                  >
                    <Text style={[styles.btnConectarText, { color: primaryColor }]}>Conectar</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Modo manual toggle */}
            <TouchableOpacity
              style={styles.modoManualBtn}
              onPress={() => setModoManual((v) => !v)}
            >
              <Feather name={modoManual ? "wifi" : "edit-3"} size={14} color={primaryColor} />
              <Text style={[styles.modoManualText, { color: primaryColor }]}>
                {modoManual ? "Usar dispositivos" : "Entrada manual"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Painel principal de leitura */}
          {modoManual ? (
            <View style={styles.leituraPanel}>
              <Text style={[styles.secaoTitulo, { color: primaryColor }]}>Entrada Manual</Text>

              <Text style={styles.formLabel}>Nº Inscrição SISBOV (15 dígitos)</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={inputChip}
                  onChangeText={(v) => {
                    const only = v.replace(/\D/g, "").slice(0, 15);
                    setInputChip(only);
                    if (only.length === 15) buscarAnimalPorChip(only);
                  }}
                  placeholder="000000000000000"
                  keyboardType="numeric"
                  maxLength={15}
                />
                {buscandoAnimal && <ActivityIndicator size="small" color={primaryColor} style={{ marginLeft: 8 }} />}
              </View>

              <Text style={styles.formLabel}>Peso (kg)</Text>
              <TextInput
                style={styles.input}
                value={inputPeso}
                onChangeText={setInputPeso}
                placeholder="Ex: 350,5"
                keyboardType="decimal-pad"
              />

              <Text style={styles.formLabel}>Observações</Text>
              <TextInput
                style={[styles.input, styles.inputMulti]}
                value={inputObs}
                onChangeText={setInputObs}
                placeholder="Condição corporal, notas..."
                multiline
                numberOfLines={2}
              />
            </View>
          ) : (
            <View style={styles.leituraPanel}>
              {/* Display do CHIP */}
              <View style={[styles.displayCard, chipLido ? styles.displayCardOk : {}]}>
                <View style={styles.displayHeader}>
                  <Feather name="radio" size={18} color={chipLido ? "#1565C0" : "#9E9E9E"} />
                  <Text style={[styles.displayLabel, chipLido && { color: "#1565C0" }]}>
                    Brinco / Chip RFID
                  </Text>
                </View>
                {chipLido ? (
                  <>
                    <Text style={styles.chipDisplay}>{formatarChip(chipLido)}</Text>
                    {buscandoAnimal && (
                      <ActivityIndicator size="small" color={primaryColor} style={{ marginTop: 4 }} />
                    )}
                  </>
                ) : (
                  <Text style={styles.aguardandoText}>Aguardando leitura do brinco...</Text>
                )}
              </View>

              {/* Display do PESO */}
              <Animated.View
                style={[
                  styles.displayCard,
                  pesoEstavel && styles.displayCardOk,
                  { transform: [{ scale: pulseAnim }] },
                ]}
              >
                <View style={styles.displayHeader}>
                  <Feather name="activity" size={18} color={corPeso} />
                  <Text style={[styles.displayLabel, { color: corPeso }]}>
                    Peso{pesoEstavel ? " · Estável ✓" : pesoAtual ? " · Instável..." : ""}
                  </Text>
                </View>
                {pesoAtual ? (
                  <Text style={[styles.pesoDisplay, { color: corPeso }]}>
                    {pesoAtual.toFixed(1)}{" "}
                    <Text style={styles.pesoUnidade}>kg</Text>
                  </Text>
                ) : (
                  <Text style={styles.aguardandoText}>Aguardando balança...</Text>
                )}
              </Animated.View>
            </View>
          )}

          {/* Painel do animal identificado */}
          {(animal || buscandoAnimal) && (
            <View style={[styles.animalPanel, { borderLeftColor: primaryColor }]}>
              {buscandoAnimal ? (
                <ActivityIndicator size="small" color={primaryColor} />
              ) : animal ? (
                <>
                  <View style={styles.animalHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.animalNome}>{animal.nome}</Text>
                      <Text style={styles.animalInfo}>
                        {animal.raca} · {animal.categoria} ·{" "}
                        {animal.sexo === "M" ? "Macho" : "Fêmea"}
                      </Text>
                    </View>
                    {animal.sisbov?.certificado && (
                      <View style={styles.sisbovBadge}>
                        <Feather name="check-circle" size={12} color="#1565C0" />
                        <Text style={styles.sisbovBadgeText}>SISBOV</Text>
                      </View>
                    )}
                  </View>
                  {animal.pesoAnterior && (
                    <View style={styles.pesoAnteriorRow}>
                      <Text style={styles.pesoAnteriorLabel}>Último peso registrado:</Text>
                      <Text style={[styles.pesoAnteriorValor, { color: primaryColor }]}>
                        {animal.pesoAnterior.toFixed(1)} kg
                      </Text>
                      {pesoAtual && (
                        <Text
                          style={[
                            styles.pesoVariacao,
                            { color: pesoAtual - animal.pesoAnterior >= 0 ? "#2E7D32" : "#C62828" },
                          ]}
                        >
                          {pesoAtual - animal.pesoAnterior >= 0 ? "▲" : "▼"}
                          {Math.abs(pesoAtual - animal.pesoAnterior).toFixed(1)} kg
                        </Text>
                      )}
                    </View>
                  )}
                  <TouchableOpacity
                    onPress={() =>
                      router.push({
                        pathname: "/(app)/animal-detalhe",
                        params: { animalId: animal.id },
                      })
                    }
                  >
                    <Text style={[styles.verDetalhes, { color: primaryColor }]}>
                      Ver ficha completa →
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={styles.animalNaoEncontrado}>
                  ⚠ Chip não cadastrado. Verifique o número ou cadastre o animal.
                </Text>
              )}
            </View>
          )}

          {/* Observações (modo automático) */}
          {!modoManual && (
            <View style={{ marginBottom: 12 }}>
              <Text style={styles.formLabel}>Observações (opcional)</Text>
              <TextInput
                style={[styles.input, styles.inputMulti]}
                value={inputObs}
                onChangeText={setInputObs}
                placeholder="Condição corporal, notas..."
                multiline
                numberOfLines={2}
              />
            </View>
          )}

          {/* Botões de ação */}
          {pesagemSalva ? (
            <View style={styles.sucessoBox}>
              <Feather name="check-circle" size={32} color="#2E7D32" />
              <Text style={styles.sucessoText}>Pesagem salva com sucesso!</Text>
              <TouchableOpacity
                style={[styles.btnNovaPesagem, { borderColor: primaryColor }]}
                onPress={resetarLeitura}
              >
                <Text style={[styles.btnNovaPesagemText, { color: primaryColor }]}>
                  Nova pesagem
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.acoesRow}>
              <TouchableOpacity style={styles.btnReset} onPress={resetarLeitura}>
                <Feather name="refresh-ccw" size={16} color="#555" />
                <Text style={styles.btnResetText}>Resetar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.btnSalvar,
                  { backgroundColor: primaryColor },
                  salvando && { opacity: 0.7 },
                ]}
                onPress={salvarPesagem}
                disabled={salvando}
              >
                {salvando ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Feather name="save" size={18} color="#fff" />
                    <Text style={styles.btnSalvarText}>Salvar pesagem</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Nota Web Serial */}
          {isWeb && (
            <View style={styles.notaWeb}>
              <Feather name="info" size={13} color="#666" />
              <Text style={styles.notaWebText}>
                A Web Serial API funciona no Chrome e Edge. Pareie a balança e o leitor via
                Bluetooth no Windows/Mac antes de conectar.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </DrawerSceneWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA" },

  header: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  btnVoltar: { padding: 4 },
  titulo: { fontSize: 20, fontWeight: "700", color: "#1A1A1A" },
  subtitulo: { fontSize: 13, color: "#666", marginTop: 2 },

  secaoTitulo: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },

  // Conexão
  conexaoPanel: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  conexaoHint: { fontSize: 12, color: "#888", marginBottom: 12 },
  dispositivosRow: { flexDirection: "row", gap: 12, marginBottom: 10 },
  dispositivoCard: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: "#E0E0E0",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    gap: 6,
  },
  dispositivoOk: { borderColor: "#4CAF50", backgroundColor: "#F1F8E9" },
  dispositivoLabel: { fontSize: 13, fontWeight: "700", color: "#888" },
  dispositivoStatus: { fontSize: 11, color: "#888" },
  btnConectar: {
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 4,
  },
  btnConectarText: { fontSize: 12, fontWeight: "700" },

  modoManualBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-end",
    paddingVertical: 4,
  },
  modoManualText: { fontSize: 12, fontWeight: "600" },

  // Leitura
  leituraPanel: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    gap: 12,
  },
  displayCard: {
    borderWidth: 1.5,
    borderColor: "#E0E0E0",
    borderRadius: 12,
    padding: 16,
    backgroundColor: "#FAFAFA",
  },
  displayCardOk: { borderColor: "#1565C0", backgroundColor: "#E3F2FD" },
  displayHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  displayLabel: { fontSize: 13, fontWeight: "600", color: "#9E9E9E" },
  chipDisplay: { fontSize: 22, fontWeight: "700", color: "#1565C0", letterSpacing: 2 },
  pesoDisplay: { fontSize: 48, fontWeight: "900", textAlign: "center" },
  pesoUnidade: { fontSize: 24, fontWeight: "400" },
  aguardandoText: { fontSize: 14, color: "#BDBDBD", fontStyle: "italic", textAlign: "center" },

  // Animal
  animalPanel: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  animalHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8 },
  animalNome: { fontSize: 17, fontWeight: "700", color: "#1A1A1A" },
  animalInfo: { fontSize: 12, color: "#666", marginTop: 2 },
  sisbovBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#E3F2FD", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  sisbovBadgeText: { fontSize: 11, color: "#1565C0", fontWeight: "700" },
  pesoAnteriorRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  pesoAnteriorLabel: { fontSize: 12, color: "#666" },
  pesoAnteriorValor: { fontSize: 14, fontWeight: "700" },
  pesoVariacao: { fontSize: 13, fontWeight: "700" },
  verDetalhes: { fontSize: 12, fontWeight: "600", marginTop: 8 },
  animalNaoEncontrado: { fontSize: 13, color: "#E65100" },

  // Forms
  formLabel: { fontSize: 12, color: "#666", fontWeight: "600", marginBottom: 4 },
  inputRow: { flexDirection: "row", alignItems: "center" },
  input: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1A1A1A",
    backgroundColor: "#FAFAFA",
    marginBottom: 8,
  },
  inputMulti: { minHeight: 60, textAlignVertical: "top" },

  // Ações
  acoesRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  btnReset: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    backgroundColor: "#fff",
  },
  btnResetText: { fontSize: 14, color: "#555", fontWeight: "600" },
  btnSalvar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  btnSalvarText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  // Sucesso
  sucessoBox: {
    alignItems: "center",
    backgroundColor: "#F1F8E9",
    borderRadius: 14,
    padding: 24,
    marginBottom: 16,
    gap: 10,
  },
  sucessoText: { fontSize: 16, fontWeight: "700", color: "#2E7D32" },
  btnNovaPesagem: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  btnNovaPesagemText: { fontSize: 14, fontWeight: "700" },

  // Nota
  notaWeb: {
    flexDirection: "row",
    gap: 6,
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    padding: 10,
    marginBottom: 20,
    alignItems: "flex-start",
  },
  notaWebText: { fontSize: 11, color: "#666", flex: 1, lineHeight: 16 },
});
