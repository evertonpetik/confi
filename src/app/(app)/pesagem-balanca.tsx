import { DrawerSceneWrapper } from "@/components/drawe-scene-wrapper";
import { DrawerToggleButton } from "@/components/DrawerToggleButton";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useResponsive } from "@/hooks/useResponsive";
import BrincoService, { brincoByIndex, controleFromBrinco } from "@/services/brincoService";
import { PesagemFirestoreService } from "@/services/pesagemFirestoreService";
import serialService from "@/services/serialService";
import { Bovino, CategoriaBovino, GTA, PedidoBrinco, ProcessoMangueiro } from "@/services/weighing.types";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated, Modal, Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";

const RACAS_BOVINOS = [
  "Nelore", "Angus", "Brahman", "Hereford", "Gir",
  "Senepol", "Brangus", "Tabapuã", "Canchim", "Limousin", "Outro",
];

const CATEGORIAS_BOVINO: { value: CategoriaBovino; label: string }[] = [
  { value: CategoriaBovino.BEZERRO, label: "Bezerro (0-12m)" },
  { value: CategoriaBovino.NOVILHO, label: "Novilho (12-24m)" },
  { value: CategoriaBovino.NOVILHA, label: "Novilha (12-24m)" },
  { value: CategoriaBovino.TOUROS, label: "Touro (>24m)" },
  { value: CategoriaBovino.VACAS, label: "Vaca (adulta)" },
  { value: CategoriaBovino.BOIS, label: "Boi castrado" },
];

const TIPO_LABEL: Record<string, string> = {
  entrada: "Entrada de Animais",
  saida: "Saída de Animais",
  transferencia: "Transferência",
};
const TIPO_COR: Record<string, string> = {
  entrada: "#009688",
  saida: "#F44336",
  transferencia: "#2196F3",
};

// ─── BLE nativo (apenas Android/iOS) ─────────────────────────────────────────
// Importado condicionalmente para evitar erros no web build
let obterBluetoothSvc: any = null;
if (Platform.OS !== "web") {
  try {
    obterBluetoothSvc = require("@/services/bluetoothService").obterBluetoothService;
  } catch {
    obterBluetoothSvc = null;
  }
}

const STORAGE_MAC_BALANCA = "@pesagem:mac_balanca";
const STORAGE_MAC_RFID = "@pesagem:mac_rfid";
const STORAGE_BAUD = "@pesagem:baud";

interface DispositivoBLE { id: string; nome: string; rssi?: number }

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
  const { animalId: paramAnimalId, chipId: paramChipId, processoId: paramProcessoId } = useLocalSearchParams<{
    animalId?: string;
    chipId?: string;
    processoId?: string;
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
  const [balancaPortId, setBalancaPortId] = useState<string | null>(null);
  const [rfidConectado, setRfidConectado] = useState(false);
  const [rfidPortId, setRfidPortId] = useState<string | null>(null);
  // Baud rate selecionado para a balança (ACR HD Easy: 9600; alguns modelos: 4800)
  const [balancaBaud, setBalancaBaud] = useState<4800 | 9600 | 19200>(9600);
  // Portas reconectadas sem papel definido — requer identificação pelo usuário
  const [portasParaIdentificar, setPortasParaIdentificar] = useState<DispositivoInfo[]>([]);
  // Log de dados brutos recebidos das portas (diagnóstico)
  const [logBruto, setLogBruto] = useState<{ portLabel: string; linha: string; ts: string }[]>([]);
  const [mostrarLog, setMostrarLog] = useState(false);

  // ─── Aba ativa ────────────────────────────────────────────────────────────
  const [abaAtiva, setAbaAtiva] = useState<"pesagem" | "config">("pesagem");

  // ─── Configuração BLE (nativo) ────────────────────────────────────────────
  const bleService = useRef<any>(null);
  const [macBalanca, setMacBalanca] = useState("");
  const [macRfid, setMacRfid] = useState("");
  const [dispositivosBle, setDispositivosBle] = useState<DispositivoBLE[]>([]);
  const [scanando, setScanando] = useState(false);
  const [bleBalancaId, setBleBalancaId] = useState<string | null>(null);
  const [bleRfidId, setBleRfidId] = useState<string | null>(null);
  const [bleBalancaConectando, setBleBalancaConectando] = useState(false);
  const [bleRfidConectando, setBleRfidConectando] = useState(false);

  // ─── Processo vinculado ───────────────────────────────────────────────────
  const [processos, setProcessos] = useState<ProcessoMangueiro[]>([]);
  const [processoSelecionado, setProcessoSelecionado] = useState<ProcessoMangueiro | null>(null);
  const [showSelecionarProcesso, setShowSelecionarProcesso] = useState(false);
  const [gtasProcesso, setGtasProcesso] = useState<GTA[]>([]);
  const [pedidoBrinco, setPedidoBrinco] = useState<PedidoBrinco | null>(null);
  const [proximoBrinco, setProximoBrinco] = useState<{ brinco: string; controle: string } | null>(null);
  const [carregandoProcessos, setCarregandoProcessos] = useState(false);

  // ─── Campos extras para processo de entrada ───────────────────────────────
  const [sexoAnimal, setSexoAnimal] = useState<"M" | "F">("M");
  const [racaAnimal, setRacaAnimal] = useState(RACAS_BOVINOS[0]);
  const [corAnimal, setCorAnimal] = useState("");
  const [idadeMeses, setIdadeMeses] = useState("");
  const [categoriaAnimal, setCategoriaAnimal] = useState<CategoriaBovino>(CategoriaBovino.NOVILHO);

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

  // ─── Configuração BLE: carrega MACs salvos e auto-conecta ─────────────────
  useEffect(() => {
    if (isWeb || !obterBluetoothSvc) return;
    const svc = obterBluetoothSvc();
    bleService.current = svc;

    // Registra callbacks globais (mesmos usados pelo serial)
    svc.registrarListener("peso", (leitura: any) => handlePesoRecebido(leitura.peso));
    svc.registrarListener("chip", (leitura: any) => handleChipRecebido(leitura.chipId));

    // Carrega MACs e baud salvos
    Promise.all([
      AsyncStorage.getItem(STORAGE_MAC_BALANCA),
      AsyncStorage.getItem(STORAGE_MAC_RFID),
      AsyncStorage.getItem(STORAGE_BAUD),
    ]).then(async ([macB, macR, baud]) => {
      if (macB) { setMacBalanca(macB); await conectarBleBalanca(macB, svc); }
      if (macR) { setMacRfid(macR); await conectarBleRfid(macR, svc); }
      if (baud) setBalancaBaud(Number(baud) as any);
    });

    return () => { svc.limpar().catch(() => { }); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const conectarBleBalanca = useCallback(async (mac: string, svc?: any) => {
    const service = svc ?? bleService.current;
    if (!service || !mac) return;
    setBleBalancaConectando(true);
    try {
      const ok = await service.conectar(mac);
      if (ok) {
        await service.subscritoPeso(mac);
        setBleBalancaId(mac);
        setBalancaConectada(true);
        setMacBalanca(mac);
        await AsyncStorage.setItem(STORAGE_MAC_BALANCA, mac);
      } else {
        Alert.alert("BLE", "Não foi possível conectar à balança. Verifique se está ligada e próxima.");
      }
    } finally {
      setBleBalancaConectando(false);
    }
  }, []);

  const conectarBleRfid = useCallback(async (mac: string, svc?: any) => {
    const service = svc ?? bleService.current;
    if (!service || !mac) return;
    setBleRfidConectando(true);
    try {
      const ok = await service.conectar(mac);
      if (ok) {
        await service.subscritoChip(mac);
        setBleRfidId(mac);
        setRfidConectado(true);
        setMacRfid(mac);
        await AsyncStorage.setItem(STORAGE_MAC_RFID, mac);
      } else {
        Alert.alert("BLE", "Não foi possível conectar ao leitor RFID.");
      }
    } finally {
      setBleRfidConectando(false);
    }
  }, []);

  const desconectarBleBalanca = useCallback(async () => {
    if (bleService.current && bleBalancaId) {
      await bleService.current.desconectar(bleBalancaId);
    }
    setBleBalancaId(null);
    setBalancaConectada(false);
  }, [bleBalancaId]);

  const desconectarBleRfid = useCallback(async () => {
    if (bleService.current && bleRfidId) {
      await bleService.current.desconectar(bleRfidId);
    }
    setBleRfidId(null);
    setRfidConectado(false);
  }, [bleRfidId]);

  const enviarTara = useCallback(async () => {
    if (bleService.current && bleBalancaId) {
      await bleService.current.tara(bleBalancaId);
    }
  }, [bleBalancaId]);

  const escanearBle = useCallback(async () => {
    if (!bleService.current) return;
    setScanando(true);
    setDispositivosBle([]);
    try {
      const devs = await bleService.current.descobrirDispositivos(5000);
      setDispositivosBle(devs.map((d: any) => ({ id: d.id, nome: d.nome || d.id, rssi: d.sinSinal })));
    } finally {
      setScanando(false);
    }
  }, []);

  // Carrega lista de processos abertos
  useEffect(() => {
    if (!fazendaId) return;
    setCarregandoProcessos(true);
    BrincoService.listarProcessosMangueiro(fazendaId)
      .then((lista) => setProcessos(lista.filter((p) => p.status === "aberto" || p.status === "em_andamento")))
      .finally(() => setCarregandoProcessos(false));
  }, [fazendaId]);

  // Carrega processo pelo param (vindo da tela de processos)
  useEffect(() => {
    if (!paramProcessoId || !fazendaId) return;
    BrincoService.obterProcessoMangueiro(paramProcessoId, fazendaId).then((proc) => {
      if (proc) selecionarProcesso(proc);
    });
  }, [paramProcessoId, fazendaId]);

  const selecionarProcesso = useCallback(async (proc: ProcessoMangueiro) => {
    setProcessoSelecionado(proc);
    setShowSelecionarProcesso(false);

    // Carrega as GTAs do processo
    const gtaList = await Promise.all(
      (proc.gtaIds ?? []).map((id) => BrincoService.obterGta(id, fazendaId))
    );
    setGtasProcesso(gtaList.filter(Boolean) as GTA[]);

    // Para entrada: carrega pedido de brincos e pré-visualiza o próximo brinco
    if (proc.tipo === "entrada" && proc.pedidoBrincoId) {
      const pedidos = await BrincoService.listarPedidos(fazendaId);
      const ped = pedidos.find((p) => p.id === proc.pedidoBrincoId) ?? null;
      setPedidoBrinco(ped);
      if (ped) {
        const nb = brincoByIndex(ped.brincoInicial, ped.proximoIndice);
        setProximoBrinco({ brinco: nb, controle: controleFromBrinco(nb) });
      }
    } else {
      setPedidoBrinco(null);
      setProximoBrinco(null);
    }

    // Pré-preenche sexo com base nas GTAs
    const primeiraGta = gtaList.find(Boolean) as GTA | undefined;
    if (primeiraGta?.animais?.length) {
      const sexoGta = primeiraGta.animais[0].sexo;
      if (sexoGta === "M" || sexoGta === "F") setSexoAnimal(sexoGta);
    }
  }, [fazendaId]);

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
      const dev = await serialService.requestPort("balanca", balancaBaud);
      if (!dev) return;
      setDispositivos((prev) => [
        ...prev.filter((d) => d.tipo !== "balanca"),
        { id: dev.id, label: dev.label, tipo: "balanca", estado: "conectado" },
      ]);
      setBalancaConectada(true);
      setBalancaPortId(dev.id);
      serialService.onWeight(handlePesoRecebido);
      serialService.onRawLine((_, portLabel, linha) =>
        setLogBruto((prev) => [{ portLabel, linha, ts: new Date().toLocaleTimeString("pt-BR") }, ...prev.slice(0, 49)])
      );
    } catch (err: any) {
      Alert.alert("Erro", err.message ?? "Não foi possível conectar a balança.");
    }
  };

  const desconectarBalanca = async () => {
    if (balancaPortId) await serialService.disconnectPort(balancaPortId);
    setBalancaConectada(false);
    setBalancaPortId(null);
    setDispositivos((prev) => prev.filter((d) => d.tipo !== "balanca"));
    setPesoAtual(null);
    setPesoEstavel(false);
    leituras.current = [];
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
      setRfidPortId(dev.id);
      serialService.onRfid(handleChipRecebido);
    } catch (err: any) {
      Alert.alert("Erro", err.message ?? "Não foi possível conectar o leitor RFID.");
    }
  };

  const desconectarRfid = async () => {
    if (rfidPortId) await serialService.disconnectPort(rfidPortId);
    setRfidConectado(false);
    setRfidPortId(null);
    setDispositivos((prev) => prev.filter((d) => d.tipo !== "rfid"));
  };

  /** Troca os papéis das duas portas quando estão invertidas. */
  const trocarPortas = () => {
    if (balancaPortId) serialService.assignPortType(balancaPortId, "rfid");
    if (rfidPortId) serialService.assignPortType(rfidPortId, "balanca");
    const oldBalanca = balancaPortId;
    const oldRfid = rfidPortId;
    setBalancaPortId(oldRfid);
    setRfidPortId(oldBalanca);
    setDispositivos((prev) =>
      prev.map((d) => {
        if (d.id === oldBalanca) return { ...d, tipo: "rfid" as const, label: d.label.replace("Balança", "Leitor RFID") };
        if (d.id === oldRfid) return { ...d, tipo: "balanca" as const, label: d.label.replace("Leitor RFID", "Balança") };
        return d;
      })
    );
    setLogBruto([]);
  };

  /** Atribui papel (balança/rfid) a uma porta identificada como desconhecida. */
  const atribuirPorta = (portaId: string, tipo: "balanca" | "rfid") => {
    serialService.assignPortType(portaId, tipo);
    const dev = serialService.devices.find((d) => d.id === portaId);
    const label = dev?.label ?? (tipo === "balanca" ? "Balança" : "Leitor RFID");

    setDispositivos((prev) => [
      ...prev.filter((d) => d.id !== portaId && d.tipo !== tipo),
      { id: portaId, label, tipo, estado: "conectado" },
    ]);
    setPortasParaIdentificar((prev) => prev.filter((p) => p.id !== portaId));

    if (tipo === "balanca") setBalancaConectada(true);
    else setRfidConectado(true);
  };

  // Tenta reconectar portas já concedidas ao reabrir a página (web)
  useEffect(() => {
    if (!isWeb || !serialService.isSupported) return;

    // Log de diagnóstico de dados brutos
    const unsubRaw = serialService.onRawLine((portId, portLabel, linha) => {
      setLogBruto((prev) => [
        { portLabel, linha, ts: new Date().toLocaleTimeString("pt-BR") },
        ...prev.slice(0, 49), // mantém últimas 50 linhas
      ]);
    });

    serialService.reconnectGranted(9600).then((devs) => {
      if (devs.length === 0) return;

      serialService.onWeight(handlePesoRecebido);
      serialService.onRfid(handleChipRecebido);

      const desconhecidos = devs.filter((d) => d.type === "desconhecido");
      const identificados = devs.filter((d) => d.type !== "desconhecido");

      identificados.forEach((d) => {
        setDispositivos((prev) => [...prev, { id: d.id, label: d.label, tipo: d.type as any, estado: "conectado" }]);
        if (d.type === "balanca") setBalancaConectada(true);
        if (d.type === "rfid") setRfidConectado(true);
      });

      if (desconhecidos.length > 0) {
        setPortasParaIdentificar(
          desconhecidos.map((d) => ({ id: d.id, label: d.label, tipo: "rfid" as const, estado: "conectado" as const }))
        );
      }
    });

    return () => { unsubRaw(); serialService.disconnectAll(); };
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

    // Fluxo especial para processo de entrada
    if (processoSelecionado?.tipo === "entrada") {
      await _persistirEntrada();
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

  /** Salva pesagem em processo de entrada: reserva brinco, cria bovino, registra pesagem */
  const _persistirEntrada = async () => {
    if (!processoSelecionado || !pedidoBrinco) {
      Alert.alert("Erro", "Processo de entrada sem pedido de brincos configurado.");
      return;
    }
    setSalvando(true);
    try {
      const reserva = await BrincoService.reservarBrinco(pedidoBrinco.id!, fazendaId);
      if (!reserva) {
        Alert.alert("Erro", "Não há mais brincos disponíveis neste pedido.");
        return;
      }

      const { brinco, controle } = reserva;
      const idNascimento = idadeMeses
        ? new Date(Date.now() - Number(idadeMeses) * 30 * 24 * 3600 * 1000).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0];

      const bovino: Bovino = {
        id: brinco,
        chipId: chipParaSalvar ?? brinco,
        nome: `${racaAnimal} ${controle}`,
        categoria: categoriaAnimal,
        raca: racaAnimal,
        sexo: sexoAnimal,
        dataNascimento: idNascimento,
        pesoEntrada: pesoParaSalvar ?? undefined,
        farmedaId: fazendaId,
        ativo: true,
        dataEntrada: new Date().toISOString(),
        pelagem: corAnimal || undefined,
        sisbov: { numeroInscricao: brinco, certificado: false },
        metadados: {
          controle,
          processoId: processoSelecionado.id,
          gtaIds: processoSelecionado.gtaIds,
          chipRfid: chipParaSalvar,
          origem: gtasProcesso[0]?.procFazenda,
        },
      };

      await PesagemFirestoreService.salvarBovino(bovino, fazendaId);

      if (pesoParaSalvar && pesoParaSalvar > 0) {
        await PesagemFirestoreService.registrarPesagemRapida(
          brinco,
          chipParaSalvar ?? brinco,
          pesoParaSalvar,
          fazendaId,
          userProfile?.uid ?? "sistema",
          inputObs || undefined
        );
      }

      await BrincoService.incrementarManejados(processoSelecionado.id!, fazendaId);

      // Atualiza processo local e pré-visualiza próximo brinco
      const procAtualizado = await BrincoService.obterProcessoMangueiro(processoSelecionado.id!, fazendaId);
      if (procAtualizado) setProcessoSelecionado(procAtualizado);

      const pedidosAtt = await BrincoService.listarPedidos(fazendaId);
      const pedAtt = pedidosAtt.find((p) => p.id === pedidoBrinco.id) ?? null;
      setPedidoBrinco(pedAtt);
      if (pedAtt) {
        const nb = brincoByIndex(pedAtt.brincoInicial, pedAtt.proximoIndice);
        setProximoBrinco({ brinco: nb, controle: controleFromBrinco(nb) });
      }

      Alert.alert("Salvo!", `Animal ${brinco} cadastrado com ${pesoParaSalvar?.toFixed(1)} kg.`);
      setPesagemSalva(true);
      leituras.current = [];
      setTimeout(() => setPesagemSalva(false), 2500);
    } catch (err) {
      console.error(err);
      Alert.alert("Erro", "Não foi possível salvar o animal/pesagem.");
    } finally {
      setSalvando(false);
    }
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

          {/* Tabs */}
          <View style={styles.tabsRow}>
            {(["pesagem", "config"] as const).map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.tab, abaAtiva === t && { borderBottomColor: primaryColor, borderBottomWidth: 2 }]}
                onPress={() => setAbaAtiva(t)}
              >
                <Feather
                  name={t === "pesagem" ? "activity" : "settings"}
                  size={14}
                  color={abaAtiva === t ? primaryColor : "#999"}
                />
                <Text style={[styles.tabText, abaAtiva === t && { color: primaryColor, fontWeight: "700" }]}>
                  {t === "pesagem" ? "Pesagem" : "Configuração"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ════════════════════ ABA CONFIGURAÇÃO ════════════════════ */}
          {abaAtiva === "config" && (
            <View>
              {/* BLE — dispositivos móveis */}
              {!isWeb && (
                <View style={styles.configSection}>
                  <Text style={[styles.configTitulo, { color: primaryColor }]}>
                    Bluetooth BLE (Android)
                  </Text>

                  {/* Balança BPB 085 */}
                  <View style={styles.configCard}>
                    <View style={styles.configCardHeader}>
                      <View style={[styles.configIcone, { backgroundColor: balancaConectada ? "#E8F5E9" : "#F5F5F5" }]}>
                        <Feather name="activity" size={18} color={balancaConectada ? "#2E7D32" : "#9E9E9E"} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.configNome}>Balança BPB 085</Text>
                        <Text style={[styles.configStatus, { color: balancaConectada ? "#2E7D32" : "#999" }]}>
                          {balancaConectada ? "● Conectada" : "○ Desconectada"}
                        </Text>
                      </View>
                    </View>
                    <TextInput
                      style={styles.configInput}
                      value={macBalanca}
                      onChangeText={setMacBalanca}
                      placeholder="MAC address (ex: AA:BB:CC:DD:EE:FF)"
                      placeholderTextColor="#bbb"
                      autoCapitalize="characters"
                    />
                    <View style={styles.configBotoesRow}>
                      {balancaConectada ? (
                        <>
                          <TouchableOpacity style={[styles.configBtn, { backgroundColor: "#FFF3E0", borderColor: "#FF9800" }]} onPress={enviarTara}>
                            <Feather name="minus-circle" size={14} color="#E65100" />
                            <Text style={[styles.configBtnText, { color: "#E65100" }]}>Tara</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.configBtn, { backgroundColor: "#FFEBEE", borderColor: "#EF9A9A" }]} onPress={desconectarBleBalanca}>
                            <Feather name="wifi-off" size={14} color="#C62828" />
                            <Text style={[styles.configBtnText, { color: "#C62828" }]}>Desconectar</Text>
                          </TouchableOpacity>
                        </>
                      ) : (
                        <TouchableOpacity
                          style={[styles.configBtn, { backgroundColor: primaryColor + "15", borderColor: primaryColor }, bleBalancaConectando && { opacity: 0.6 }]}
                          onPress={() => conectarBleBalanca(macBalanca)}
                          disabled={bleBalancaConectando || !macBalanca}
                        >
                          {bleBalancaConectando
                            ? <ActivityIndicator size="small" color={primaryColor} />
                            : <Feather name="wifi" size={14} color={primaryColor} />}
                          <Text style={[styles.configBtnText, { color: primaryColor }]}>
                            {bleBalancaConectando ? "Conectando..." : "Conectar"}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {/* Leitor RFID */}
                  <View style={styles.configCard}>
                    <View style={styles.configCardHeader}>
                      <View style={[styles.configIcone, { backgroundColor: rfidConectado ? "#E8F5E9" : "#F5F5F5" }]}>
                        <Feather name="radio" size={18} color={rfidConectado ? "#2E7D32" : "#9E9E9E"} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.configNome}>Leitor RFID XRS2i</Text>
                        <Text style={[styles.configStatus, { color: rfidConectado ? "#2E7D32" : "#999" }]}>
                          {rfidConectado ? "● Conectado" : "○ Desconectado"}
                        </Text>
                      </View>
                    </View>
                    <TextInput
                      style={styles.configInput}
                      value={macRfid}
                      onChangeText={setMacRfid}
                      placeholder="MAC address (ex: AA:BB:CC:DD:EE:FF)"
                      placeholderTextColor="#bbb"
                      autoCapitalize="characters"
                    />
                    <View style={styles.configBotoesRow}>
                      {rfidConectado ? (
                        <TouchableOpacity style={[styles.configBtn, { backgroundColor: "#FFEBEE", borderColor: "#EF9A9A" }]} onPress={desconectarBleRfid}>
                          <Feather name="wifi-off" size={14} color="#C62828" />
                          <Text style={[styles.configBtnText, { color: "#C62828" }]}>Desconectar</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={[styles.configBtn, { backgroundColor: primaryColor + "15", borderColor: primaryColor }, bleRfidConectando && { opacity: 0.6 }]}
                          onPress={() => conectarBleRfid(macRfid)}
                          disabled={bleRfidConectando || !macRfid}
                        >
                          {bleRfidConectando
                            ? <ActivityIndicator size="small" color={primaryColor} />
                            : <Feather name="wifi" size={14} color={primaryColor} />}
                          <Text style={[styles.configBtnText, { color: primaryColor }]}>
                            {bleRfidConectando ? "Conectando..." : "Conectar"}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {/* Varredura BLE */}
                  <TouchableOpacity
                    style={[styles.btnScanBle, { borderColor: primaryColor }, scanando && { opacity: 0.6 }]}
                    onPress={escanearBle}
                    disabled={scanando}
                  >
                    {scanando
                      ? <ActivityIndicator size="small" color={primaryColor} />
                      : <Feather name="bluetooth" size={16} color={primaryColor} />}
                    <Text style={[styles.btnScanBleText, { color: primaryColor }]}>
                      {scanando ? "Varrendo (5s)..." : "Varrer dispositivos BLE"}
                    </Text>
                  </TouchableOpacity>

                  {/* Lista de dispositivos encontrados */}
                  {dispositivosBle.length > 0 && (
                    <View style={styles.bleList}>
                      <Text style={styles.bleListTitulo}>Dispositivos encontrados:</Text>
                      {dispositivosBle.map((dev) => (
                        <View key={dev.id} style={styles.bleItem}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.bleItemNome}>{dev.nome || "Sem nome"}</Text>
                            <Text style={styles.bleItemMac}>{dev.id}</Text>
                            {dev.rssi != null && (
                              <Text style={styles.bleItemRssi}>Sinal: {dev.rssi} dBm</Text>
                            )}
                          </View>
                          <View style={styles.bleItemBtns}>
                            <TouchableOpacity
                              style={[styles.bleAtribuirBtn, { backgroundColor: "#E3F2FD" }]}
                              onPress={() => conectarBleBalanca(dev.id)}
                            >
                              <Text style={[styles.bleAtribuirText, { color: "#1565C0" }]}>⚖ Balança</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.bleAtribuirBtn, { backgroundColor: "#E8F5E9" }]}
                              onPress={() => conectarBleRfid(dev.id)}
                            >
                              <Text style={[styles.bleAtribuirText, { color: "#2E7D32" }]}>📡 RFID</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                  <View style={[styles.configInfo, { borderColor: primaryColor + "30", backgroundColor: primaryColor + "08" }]}>
                    <Feather name="info" size={13} color={primaryColor} />
                    <Text style={[styles.configInfoText, { color: primaryColor }]}>
                      A balança BPB 085 usa BLE UART (Nordic). O app envia ';peso' periodicamente e processa a resposta '+XXXX.X;Z;1;'. Pareie no Bluetooth do celular antes de conectar aqui.
                    </Text>
                  </View>
                </View>
              )}

              {/* Serial — web/PC */}
              {isWeb && (
                <View style={styles.configSection}>
                  <Text style={[styles.configTitulo, { color: primaryColor }]}>
                    Porta Serial via Bluetooth (PC / Web)
                  </Text>
                  <Text style={styles.configDica}>
                    Pareie a balança e o RFID no Bluetooth do Windows, depois conecte pelas portas COM que aparecerem abaixo.
                  </Text>

                  {/* Baud rate */}
                  <Text style={styles.configLabel}>Baud rate da balança</Text>
                  <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
                    {([4800, 9600, 19200] as const).map((b) => (
                      <TouchableOpacity
                        key={b}
                        style={[styles.baudChip, balancaBaud === b && styles.baudChipActive]}
                        onPress={async () => {
                          setBalancaBaud(b);
                          await AsyncStorage.setItem(STORAGE_BAUD, String(b));
                        }}
                      >
                        <Text style={[styles.baudChipText, balancaBaud === b && styles.baudChipTextActive]}>{b}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.configDica}>
                    Vá para a aba Pesagem para conectar as portas seriais e identificar cada equipamento.
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ════════════════════ ABA PESAGEM ════════════════════ */}
          {abaAtiva === "pesagem" && (<>

            {/* Seleção de Processo */}
            <TouchableOpacity
              style={[
                styles.processoPanel,
                processoSelecionado && { borderColor: TIPO_COR[processoSelecionado.tipo] ?? primaryColor, backgroundColor: (TIPO_COR[processoSelecionado.tipo] ?? primaryColor) + "0D" },
              ]}
              onPress={() => setShowSelecionarProcesso(true)}
            >
              <View style={{ flex: 1 }}>
                {processoSelecionado ? (
                  <>
                    <Text style={[styles.processoLabel, { color: TIPO_COR[processoSelecionado.tipo] ?? primaryColor }]}>
                      {TIPO_LABEL[processoSelecionado.tipo] ?? processoSelecionado.tipo}
                    </Text>
                    <Text style={styles.processoNome} numberOfLines={1}>{processoSelecionado.nome}</Text>
                    <Text style={styles.processoProgresso}>
                      {processoSelecionado.animaisManejados} / {processoSelecionado.totalAnimaisPrevisto} animais · {processoSelecionado.gtaIds.length} GTA(s)
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.processoLabel}>Nenhum processo selecionado</Text>
                    <Text style={styles.processoNome}>Toque para selecionar um processo ativo</Text>
                  </>
                )}
              </View>
              <Feather name="chevron-down" size={18} color={processoSelecionado ? TIPO_COR[processoSelecionado.tipo] : "#999"} />
            </TouchableOpacity>

            {/* Painel de conexão de dispositivos */}
            <View style={styles.conexaoPanel}>
              <Text style={[styles.secaoTitulo, { color: primaryColor }]}>
                {isWeb ? "Conexão via Porta Serial (Bluetooth)" : "Conexão Bluetooth"}
              </Text>
              <Text style={styles.conexaoHint}>
                {isWeb
                  ? "Use sempre a porta de Entrada (não Saída). Ex: EASY → COM3, XRS2i → COM7."
                  : "Certifique-se que Bluetooth está ativo no celular."}
              </Text>

              <View style={styles.dispositivosRow}>
                {/* Balança */}
                <View style={[styles.dispositivoCard, balancaConectada && styles.dispositivoOk]}>
                  <Feather name="activity" size={24} color={balancaConectada ? "#2E7D32" : "#9E9E9E"} />
                  <Text style={[styles.dispositivoLabel, balancaConectada && { color: "#2E7D32" }]}>
                    Balança
                  </Text>
                  <Text style={styles.dispositivoStatus}>
                    {balancaConectada ? "Conectada" : "Desconectada"}
                  </Text>
                  {isWeb && !balancaConectada && (
                    <>
                      {/* Seleção de baud rate antes de conectar */}
                      <View style={styles.baudRow}>
                        {([4800, 9600, 19200] as const).map((b) => (
                          <TouchableOpacity
                            key={b}
                            style={[styles.baudChip, balancaBaud === b && styles.baudChipActive]}
                            onPress={() => setBalancaBaud(b)}
                          >
                            <Text style={[styles.baudChipText, balancaBaud === b && styles.baudChipTextActive]}>
                              {b}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <TouchableOpacity
                        style={[styles.btnConectar, { borderColor: primaryColor }]}
                        onPress={conectarSerialBalanca}
                      >
                        <Text style={[styles.btnConectarText, { color: primaryColor }]}>Conectar</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {isWeb && balancaConectada && (
                    <TouchableOpacity style={styles.btnDesconectar} onPress={desconectarBalanca}>
                      <Text style={styles.btnDesconectarText}>Desconectar</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Leitor RFID */}
                <View style={[styles.dispositivoCard, rfidConectado && styles.dispositivoOk]}>
                  <Feather name="radio" size={24} color={rfidConectado ? "#2E7D32" : "#9E9E9E"} />
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
                  {isWeb && rfidConectado && (
                    <TouchableOpacity style={styles.btnDesconectar} onPress={desconectarRfid}>
                      <Text style={styles.btnDesconectarText}>Desconectar</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Botão Trocar Portas — aparece quando ambas estão conectadas */}
              {isWeb && balancaConectada && rfidConectado && (
                <TouchableOpacity style={styles.btnTrocar} onPress={trocarPortas}>
                  <Feather name="repeat" size={14} color="#E65100" />
                  <Text style={styles.btnTrocarText}>Portas invertidas? Trocar balança ↔ RFID</Text>
                </TouchableOpacity>
              )}

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

              {/* Dica de identificação de portas no Windows */}
              {isWeb && (balancaConectada || rfidConectado || portasParaIdentificar.length > 0) && (
                <Text style={styles.portaHint}>
                  💡 Para saber qual porta é qual: no Windows abra o{" "}
                  <Text style={{ fontWeight: "700" }}>Gerenciador de Dispositivos → Portas (COM e LPT)</Text>
                  {" "}e ligue/desligue cada equipamento para ver qual COM aparece/desaparece.
                </Text>
              )}
            </View>

            {/* ── Painel de identificação de portas desconhecidas ─────────────── */}
            {isWeb && portasParaIdentificar.length > 0 && (
              <View style={styles.identificacaoPanel}>
                <View style={styles.identificacaoHeader}>
                  <Feather name="alert-circle" size={18} color="#E65100" />
                  <Text style={styles.identificacaoTitulo}>
                    {portasParaIdentificar.length} porta{portasParaIdentificar.length > 1 ? "s" : ""} reconectada{portasParaIdentificar.length > 1 ? "s" : ""} — identifique cada equipamento
                  </Text>
                </View>
                <Text style={styles.identificacaoSub}>
                  Clique no botão correto para cada porta abaixo. Se não souber, use o Gerenciador de Dispositivos do Windows para descobrir qual COM é qual.
                </Text>
                {portasParaIdentificar.map((porta) => (
                  <View key={porta.id} style={styles.portaCard}>
                    <View style={styles.portaCardHeader}>
                      <Feather name="cpu" size={16} color="#555" />
                      <Text style={styles.portaCardLabel}>{porta.label}</Text>
                    </View>
                    <Text style={styles.portaCardSub}>O que é esta porta?</Text>
                    <View style={styles.portaCardBtns}>
                      <TouchableOpacity
                        style={[styles.portaBtn, { borderColor: "#1565C0", backgroundColor: "#E3F2FD" }]}
                        onPress={() => atribuirPorta(porta.id, "balanca")}
                        disabled={balancaConectada}
                      >
                        <Feather name="activity" size={14} color={balancaConectada ? "#9E9E9E" : "#1565C0"} />
                        <Text style={[styles.portaBtnText, { color: balancaConectada ? "#9E9E9E" : "#1565C0" }]}>
                          {balancaConectada ? "Balança já atribuída" : "É a Balança"}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.portaBtn, { borderColor: "#1B5E20", backgroundColor: "#E8F5E9" }]}
                        onPress={() => atribuirPorta(porta.id, "rfid")}
                        disabled={rfidConectado}
                      >
                        <Feather name="radio" size={14} color={rfidConectado ? "#9E9E9E" : "#1B5E20"} />
                        <Text style={[styles.portaBtnText, { color: rfidConectado ? "#9E9E9E" : "#1B5E20" }]}>
                          {rfidConectado ? "RFID já atribuído" : "É o Leitor RFID"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* ── Log de dados brutos (diagnóstico da balança) ───────────── */}
            {isWeb && logBruto.length > 0 && (
              <View style={styles.logPanel}>
                <TouchableOpacity
                  style={styles.logHeader}
                  onPress={() => setMostrarLog((v) => !v)}
                >
                  <Feather name="terminal" size={14} color="#546E7A" />
                  <Text style={styles.logHeaderText}>
                    Dados brutos recebidos ({logBruto.length})
                  </Text>
                  <Feather name={mostrarLog ? "chevron-up" : "chevron-down"} size={14} color="#546E7A" />
                </TouchableOpacity>
                {mostrarLog && (
                  <ScrollView style={styles.logScroll} nestedScrollEnabled>
                    {logBruto.map((entry, i) => (
                      <View key={i} style={styles.logEntry}>
                        <Text style={styles.logTs}>{entry.ts} [{entry.portLabel}]</Text>
                        <Text style={styles.logLinha} selectable>{JSON.stringify(entry.linha)}</Text>
                      </View>
                    ))}
                  </ScrollView>
                )}
              </View>
            )}

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

            {/* Painel de dados do animal para processo de ENTRADA */}
            {processoSelecionado?.tipo === "entrada" && (
              <View style={[styles.entradaPanel, { borderColor: "#009688" }]}>
                <Text style={[styles.entradaTitulo, { color: "#009688" }]}>Dados do Animal (Entrada)</Text>

                {/* Próximo brinco */}
                {proximoBrinco && (
                  <View style={styles.brincoBox}>
                    <Feather name="tag" size={14} color="#009688" />
                    <Text style={styles.brincoLabel}>Próximo brinco:</Text>
                    <Text style={styles.brincoNumero}>{proximoBrinco.brinco}</Text>
                    <Text style={styles.brincoControle}>Ctrl: {proximoBrinco.controle}</Text>
                  </View>
                )}

                {/* GTAs: info de origem */}
                {gtasProcesso.length > 0 && (
                  <View style={styles.gtaInfoBox}>
                    <Text style={styles.gtaInfoLabel}>Origem (GTA):</Text>
                    <Text style={styles.gtaInfoValor}>
                      {gtasProcesso[0].procFazenda || gtasProcesso[0].procNome} · {gtasProcesso[0].procMunicipio}/{gtasProcesso[0].procUf}
                    </Text>
                    <Text style={styles.gtaInfoValor}>
                      Total previsto: {gtasProcesso.reduce((a, g) => a + g.total, 0)} · {gtasProcesso.reduce((a, g) => a + g.totalMachos, 0)}M / {gtasProcesso.reduce((a, g) => a + g.totalFemeas, 0)}F
                    </Text>
                  </View>
                )}

                {/* Sexo */}
                <Text style={styles.campoLabel}>Sexo *</Text>
                <View style={styles.sexoRow}>
                  {(["M", "F"] as const).map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.sexoChip, sexoAnimal === s && { backgroundColor: "#009688", borderColor: "#009688" }]}
                      onPress={() => setSexoAnimal(s)}
                    >
                      <Text style={[styles.sexoChipText, sexoAnimal === s && { color: "#fff" }]}>
                        {s === "M" ? "♂ Macho" : "♀ Fêmea"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Raça */}
                <Text style={styles.campoLabel}>Raça *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {RACAS_BOVINOS.map((r) => (
                      <TouchableOpacity
                        key={r}
                        style={[styles.racaChip, racaAnimal === r && { backgroundColor: "#00968822", borderColor: "#009688" }]}
                        onPress={() => setRacaAnimal(r)}
                      >
                        <Text style={[styles.racaChipText, racaAnimal === r && { color: "#009688", fontWeight: "700" }]}>{r}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                {/* Categoria */}
                <Text style={styles.campoLabel}>Categoria *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {CATEGORIAS_BOVINO.map((c) => (
                      <TouchableOpacity
                        key={c.value}
                        style={[styles.racaChip, categoriaAnimal === c.value && { backgroundColor: "#00968822", borderColor: "#009688" }]}
                        onPress={() => setCategoriaAnimal(c.value)}
                      >
                        <Text style={[styles.racaChipText, categoriaAnimal === c.value && { color: "#009688", fontWeight: "700" }]}>{c.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                {/* Cor/Pelagem e Idade */}
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.campoLabel}>Cor / Pelagem</Text>
                    <TextInput
                      style={styles.input}
                      value={corAnimal}
                      onChangeText={setCorAnimal}
                      placeholder="Ex: Vermelho, Preto..."
                      placeholderTextColor="#999"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.campoLabel}>Idade (meses)</Text>
                    <TextInput
                      style={styles.input}
                      value={idadeMeses}
                      onChangeText={setIdadeMeses}
                      placeholder="Ex: 18"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                    />
                  </View>
                </View>
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
          </>)}
        </View>
      </ScrollView>

      {/* Modal: Selecionar Processo */}
      <Modal visible={showSelecionarProcesso} animationType="slide" transparent onRequestClose={() => setShowSelecionarProcesso(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitulo}>Selecionar Processo</Text>
              <TouchableOpacity onPress={() => setShowSelecionarProcesso(false)}>
                <Feather name="x" size={22} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {carregandoProcessos ? (
                <ActivityIndicator color={primaryColor} style={{ marginVertical: 40 }} />
              ) : processos.length === 0 ? (
                <View style={{ alignItems: "center", paddingVertical: 40 }}>
                  <Feather name="inbox" size={40} color="#ccc" />
                  <Text style={{ color: "#999", marginTop: 12, fontSize: 14 }}>Nenhum processo aberto.</Text>
                  <Text style={{ color: "#bbb", fontSize: 12, marginTop: 4 }}>Crie um processo na aba Processos.</Text>
                </View>
              ) : (
                processos.map((proc) => {
                  const cor = TIPO_COR[proc.tipo] ?? primaryColor;
                  return (
                    <TouchableOpacity
                      key={proc.id}
                      style={[styles.processoOpcao, processoSelecionado?.id === proc.id && { borderColor: cor, backgroundColor: cor + "0D" }]}
                      onPress={() => selecionarProcesso(proc)}
                    >
                      <View style={[styles.processoOpcaoIcone, { backgroundColor: cor + "18" }]}>
                        <Feather name={proc.tipo === "entrada" ? "log-in" : proc.tipo === "saida" ? "log-out" : "shuffle"} size={18} color={cor} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.processoOpcaoNome} numberOfLines={2}>{proc.nome}</Text>
                        <Text style={[styles.processoOpcaoTipo, { color: cor }]}>{TIPO_LABEL[proc.tipo]}</Text>
                        <Text style={styles.processoOpcaoProgresso}>
                          {proc.animaisManejados}/{proc.totalAnimaisPrevisto} animais · {proc.gtaIds.length} GTA(s)
                        </Text>
                      </View>
                      {processoSelecionado?.id === proc.id && <Feather name="check-circle" size={18} color={cor} />}
                    </TouchableOpacity>
                  );
                })
              )}
              <TouchableOpacity
                style={[styles.processoOpcao, { borderColor: "#E0E0E0", justifyContent: "center" }]}
                onPress={() => { setShowSelecionarProcesso(false); setProcessoSelecionado(null); }}
              >
                <Text style={{ color: "#999", fontSize: 14 }}>Sem processo (pesagem avulsa)</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </DrawerSceneWrapper >
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
    boxShadow: "0px 2px 6px rgba(0,0,0,0.06)",
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
  btnDesconectar: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#EF9A9A",
    backgroundColor: "#FFEBEE",
  },
  btnDesconectarText: { fontSize: 11, color: "#C62828", fontWeight: "700" },
  // Seletor de baud rate da balança
  baudRow: { flexDirection: "row", gap: 4, marginTop: 6, marginBottom: 4 },
  baudChip: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
    borderWidth: 1, borderColor: "#E0E0E0", backgroundColor: "#F5F5F5",
  },
  baudChipActive: { backgroundColor: "#1565C0", borderColor: "#1565C0" },
  baudChipText: { fontSize: 10, color: "#555" },
  baudChipTextActive: { color: "#fff", fontWeight: "700" },
  // Botão trocar portas
  btnTrocar: {
    flexDirection: "row", alignItems: "center", gap: 6,
    alignSelf: "center", marginTop: 8,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, borderColor: "#FFCC80",
    backgroundColor: "#FFF3E0",
  },
  btnTrocarText: { fontSize: 12, fontWeight: "700", color: "#E65100" },

  modoManualBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-end",
    paddingVertical: 4,
  },
  modoManualText: { fontSize: 12, fontWeight: "600" },
  portaHint: {
    fontSize: 11,
    color: "#616161",
    marginTop: 8,
    lineHeight: 16,
    fontStyle: "italic",
  },

  // Painel de identificação de portas
  identificacaoPanel: {
    backgroundColor: "#FFF3E0",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FFB74D",
    padding: 14,
    marginBottom: 14,
    gap: 10,
  } as any,
  identificacaoHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  identificacaoTitulo: { fontSize: 14, fontWeight: "700", color: "#E65100", flex: 1 },
  identificacaoSub: { fontSize: 12, color: "#616161" },
  portaCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#FFE0B2",
    gap: 8,
  },
  portaCardHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  portaCardLabel: { fontSize: 13, fontWeight: "700", color: "#333" },
  portaCardSub: { fontSize: 12, color: "#757575" },
  portaCardBtns: { flexDirection: "row", gap: 10 },
  portaBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5,
  },
  portaBtnText: { fontSize: 12, fontWeight: "700" },

  // Log de diagnóstico
  logPanel: {
    backgroundColor: "#ECEFF1",
    borderRadius: 10,
    marginBottom: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#CFD8DC",
  },
  logHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
  },
  logHeaderText: { flex: 1, fontSize: 12, fontWeight: "700", color: "#546E7A" },
  logScroll: { maxHeight: 200, backgroundColor: "#263238" },
  logEntry: { paddingHorizontal: 10, paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: "#37474F" },
  logTs: { fontSize: 9, color: "#78909C" },
  logLinha: { fontSize: 11, color: "#A5D6A7", fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },

  // Leitura
  leituraPanel: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    boxShadow: "0px 2px 6px rgba(0,0,0,0.06)",
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
    boxShadow: "0px 2px 6px rgba(0,0,0,0.06)",
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

  // Tabs
  tabsRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#E0E0E0", marginBottom: 16 },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabText: { fontSize: 14, color: "#999" },

  // Config
  configSection: { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 14, gap: 12 } as any,
  configTitulo: { fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  configLabel: { fontSize: 12, fontWeight: "600", color: "#555", marginBottom: 6 },
  configDica: { fontSize: 12, color: "#888", lineHeight: 17 },
  configCard: { borderWidth: 1, borderColor: "#E0E0E0", borderRadius: 12, padding: 14, gap: 10 },
  configCardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  configIcone: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  configNome: { fontSize: 14, fontWeight: "700", color: "#1a1a1a" },
  configStatus: { fontSize: 12, marginTop: 2 },
  configInput: { backgroundColor: "#F8F8F8", borderRadius: 8, borderWidth: 1, borderColor: "#E0E0E0", paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: "#1a1a1a", fontFamily: Platform.OS === "web" ? "monospace" : undefined },
  configBotoesRow: { flexDirection: "row", gap: 8 },
  configBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 8, borderWidth: 1 },
  configBtnText: { fontSize: 13, fontWeight: "600" },
  configInfo: { flexDirection: "row", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, alignItems: "flex-start" },
  configInfoText: { fontSize: 12, flex: 1, lineHeight: 17 },

  btnScanBle: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5 },
  btnScanBleText: { fontSize: 14, fontWeight: "600" },

  bleList: { borderWidth: 1, borderColor: "#E0E0E0", borderRadius: 10, overflow: "hidden" },
  bleListTitulo: { fontSize: 12, fontWeight: "700", color: "#666", padding: 10, backgroundColor: "#F8F8F8", textTransform: "uppercase" },
  bleItem: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: "#F0F0F0" },
  bleItemNome: { fontSize: 14, fontWeight: "700", color: "#1a1a1a" },
  bleItemMac: { fontSize: 11, color: "#888", fontFamily: Platform.OS === "web" ? "monospace" : undefined },
  bleItemRssi: { fontSize: 11, color: "#aaa" },
  bleItemBtns: { gap: 6 },
  bleAtribuirBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  bleAtribuirText: { fontSize: 12, fontWeight: "700" },

  // Processo
  processoPanel: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: "#E0E0E0", backgroundColor: "#fff", marginBottom: 14 },
  processoLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, color: "#999", marginBottom: 2 },
  processoNome: { fontSize: 14, fontWeight: "700", color: "#1a1a1a" },
  processoProgresso: { fontSize: 11, color: "#888", marginTop: 2 },

  // Painel de entrada
  entradaPanel: { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1.5, borderColor: "#009688" },
  entradaTitulo: { fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 },
  brincoBox: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#E0F2F1", padding: 10, borderRadius: 10, marginBottom: 12, flexWrap: "wrap" },
  brincoLabel: { fontSize: 12, color: "#555", fontWeight: "600" },
  brincoNumero: { fontSize: 14, fontWeight: "900", color: "#00695C", letterSpacing: 1 },
  brincoControle: { fontSize: 11, color: "#888" },
  gtaInfoBox: { backgroundColor: "#F1F8E9", padding: 10, borderRadius: 10, marginBottom: 12 },
  gtaInfoLabel: { fontSize: 11, fontWeight: "700", color: "#558B2F", marginBottom: 4 },
  gtaInfoValor: { fontSize: 12, color: "#444" },
  campoLabel: { fontSize: 12, fontWeight: "600", color: "#555", marginBottom: 6 },
  sexoRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  sexoChip: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: "#E0E0E0", alignItems: "center" },
  sexoChipText: { fontSize: 14, fontWeight: "600", color: "#555" },
  racaChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "#E0E0E0", backgroundColor: "#F8F8F8" },
  racaChipText: { fontSize: 13, color: "#555" },

  // Modal processo
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContainer: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "80%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitulo: { fontSize: 18, fontWeight: "700", color: "#1a1a1a" },
  processoOpcao: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: "#E0E0E0", marginBottom: 10 },
  processoOpcaoIcone: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  processoOpcaoNome: { fontSize: 14, fontWeight: "700", color: "#1a1a1a" },
  processoOpcaoTipo: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", marginTop: 2 },
  processoOpcaoProgresso: { fontSize: 11, color: "#888", marginTop: 2 },

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
    boxShadow: "0px 3px 8px rgba(0,0,0,0.12)",
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
