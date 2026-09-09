import { Platform } from "react-native";
import { BleManager, Characteristic, Device } from "react-native-ble-plx";
import {
  DispositivoBluetooth,
  ErroBluetooth,
  LeituraChip,
  LeituraPeso,
  StatusPeso,
} from "./weighing.types";

// ─── UUIDs Nordic UART Service (NUS) — mesmo usado pela BPB 085 e pelo XRS2i ──
const NUS_SERVICE = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const NUS_TX_WRITE = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"; // app escreve → balança
const NUS_RX_NOTIFY = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"; // balança envia → app

// Intervalo de polling de peso (ms) — BPB 085 não envia espontaneamente
const POLLING_INTERVALO_MS = 700;

/**
 * Serviço de gerenciamento de dispositivos Bluetooth
 * Responsável por: descoberta, conexão, leitura de dados
 * Suporta: Balança ACR HD Easy, Leitor RFID XRS2i
 */
export class BluetoothService {
  private bleManager: BleManager | undefined;
  private dispositivosConectados: Map<string, Device> = new Map();
  private subscricoes: Map<string, any> = new Map();
  private txCharacteristics: Map<string, Characteristic> = new Map(); // TX write por device
  private pollingIntervals: Map<string, ReturnType<typeof setInterval>> = new Map();
  private buffersPeso: Map<string, string> = new Map();
  private buffersChip: Map<string, string> = new Map();
  private listeners: {
    onPeso?: (leitura: LeituraPeso) => void;
    onChip?: (leitura: LeituraChip) => void;
    onErro?: (erro: ErroBluetooth) => void;
    onDispositivoConectado?: (dispositivo: DispositivoBluetooth) => void;
    onDispositivoDesconectado?: (dispositivo: DispositivoBluetooth) => void;
  } = {};

  constructor() {
    if (Platform.OS !== "web") {
      this.bleManager = new BleManager();
      this.inicializarListeners();
    }
  }

  /**
   * Inicializa listeners para eventos do BleManager
   */
  private inicializarListeners(): void {
    if (!this.bleManager) return;
    this.bleManager.onStateChange((state) => {
      console.log(`[BLE] Estado: ${state}`);
      if (state === "PoweredOff") {
        this.emitirErro({
          codigo: "BLE_POWERED_OFF",
          mensagem: "Bluetooth desligado. Ative Bluetooth para continuar.",
          timestamp: new Date().toISOString(),
          recuperavel: true,
        });
      }
    }, true);
  }

  /**
   * Registra listeners para eventos de pesagem
   */
  public registrarListener(
    tipo: "peso" | "chip" | "erro" | "conectado" | "desconectado",
    callback: any
  ): void {
    switch (tipo) {
      case "peso":
        this.listeners.onPeso = callback;
        break;
      case "chip":
        this.listeners.onChip = callback;
        break;
      case "erro":
        this.listeners.onErro = callback;
        break;
      case "conectado":
        this.listeners.onDispositivoConectado = callback;
        break;
      case "desconectado":
        this.listeners.onDispositivoDesconectado = callback;
        break;
    }
  }

  /**
   * Descobre dispositivos Bluetooth disponíveis
   */
  public async descobrirDispositivos(
    duracao: number = 10000
  ): Promise<DispositivoBluetooth[]> {
    if (!this.bleManager) return [];
    try {
      console.log("[BLE] Iniciando descoberta de dispositivos...");

      const deviceMap = new Map<string, Device>();

      // Inicia varredura e coleta dispositivos via callback
      this.bleManager.startDeviceScan(null, null, (error, device) => {
        if (error) {
          console.error("[BLE] Erro na varredura:", error.message);
          return;
        }
        if (device && !deviceMap.has(device.id)) {
          deviceMap.set(device.id, device);
          console.log(`[BLE] Dispositivo encontrado: ${device.name} (${device.id})`);
        }
      });

      // Aguarda duração especificada
      await new Promise((resolve) => setTimeout(resolve, duracao));

      // Para varredura
      await this.bleManager.stopDeviceScan();

      // Converte para formato de retorno
      const dispositivos: DispositivoBluetooth[] = Array.from(
        deviceMap.values()
      ).map((device) => ({
        id: device.id,
        nome: device.name || "Dispositivo desconhecido",
        tipo: this.identificarTipoDispositivo(device.name || ""),
        modelo: device.name || "Desconhecido",
        conectado: false,
        ultimaConexao: undefined,
        sinSinal: device.rssi ?? undefined,
      }));

      console.log(`[BLE] Descoberta concluída. ${dispositivos.length} dispositivos encontrados.`);
      return dispositivos;
    } catch (error) {
      this.emitirErro({
        codigo: "BLE_DISCOVERY_ERROR",
        mensagem: `Erro ao descobrir dispositivos: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date().toISOString(),
        recuperavel: true,
      });
      return [];
    }
  }

  /**
   * Identifica tipo de dispositivo pelo nome
   */
  private identificarTipoDispositivo(
    nome: string
  ): "balanca" | "leitor_rfid" | "outro" {
    const nameLower = nome.toLowerCase();
    if (nameLower.includes("acr") || nameLower.includes("balance") || nameLower.includes("peso")) {
      return "balanca";
    }
    if (nameLower.includes("xrs") || nameLower.includes("rfid") || nameLower.includes("chip")) {
      return "leitor_rfid";
    }
    return "outro";
  }

  /**
   * Conecta a um dispositivo Bluetooth
   */
  public async conectar(
    dispositivoId: string,
    timeout: number = 10000
  ): Promise<boolean> {
    // No web não existe BleManager — a conexão é feita via porta serial (serialService.web.ts)
    if (!this.bleManager) {
      this.emitirErro({
        codigo: "BLE_NAO_DISPONIVEL",
        mensagem: "Bluetooth BLE não disponível nesta plataforma.",
        timestamp: new Date().toISOString(),
        dispositivo: dispositivoId,
        recuperavel: false,
      });
      return false;
    }

    try {
      console.log(`[BLE] Conectando ao dispositivo: ${dispositivoId}`);

      // Tenta conectar diretamente por ID — connectToDevice já resolve a conexão,
      // não é preciso (nem correto) checar connectedDevices() antes, pois esse
      // método só retorna dispositivos já conectados no nível do SO.
      await this.bleManager.connectToDevice(dispositivoId, {
        autoConnect: false,
        timeout,
      });

      console.log(`[BLE] Conectado ao dispositivo: ${dispositivoId}`);

      // Descobre serviços
      const device_info = await this.bleManager.discoverAllServicesAndCharacteristicsForDevice(
        dispositivoId
      );

      this.dispositivosConectados.set(dispositivoId, device_info);

      const tipo = this.identificarTipoDispositivo(device_info.name || "");
      this.listeners.onDispositivoConectado?.({
        id: dispositivoId,
        nome: device_info.name || "Desconhecido",
        tipo,
        modelo: device_info.name || "Desconhecido",
        conectado: true,
        ultimaConexao: new Date().toISOString(),
        sinSinal: device_info.rssi ?? undefined,
      });

      return true;
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : String(error);
      this.emitirErro({
        codigo: "BLE_CONNECTION_ERROR",
        mensagem: `Erro ao conectar: ${mensagem}`,
        timestamp: new Date().toISOString(),
        dispositivo: dispositivoId,
        recuperavel: true,
      });
      return false;
    }
  }

  /**
   * Desconecta de um dispositivo
   */
  public async desconectar(dispositivoId: string): Promise<boolean> {
    try {
      console.log(`[BLE] Desconectando do dispositivo: ${dispositivoId}`);

      // Para polling de peso se ativo
      const polling = this.pollingIntervals.get(dispositivoId);
      if (polling) {
        clearInterval(polling);
        this.pollingIntervals.delete(dispositivoId);
      }

      // Remove TX characteristic
      this.txCharacteristics.delete(dispositivoId);

      // Limpa buffers de linha
      this.buffersPeso.delete(dispositivoId);
      this.buffersChip.delete(dispositivoId);

      // Remove subscrições
      const subscricao = this.subscricoes.get(dispositivoId);
      if (subscricao) {
        subscricao.remove();
        this.subscricoes.delete(dispositivoId);
      }

      // Desconecta (no web não há BleManager; a limpeza local acima ainda vale)
      await this.bleManager?.cancelDeviceConnection(dispositivoId);

      this.dispositivosConectados.delete(dispositivoId);

      this.listeners.onDispositivoDesconectado?.({
        id: dispositivoId,
        nome: "Desconectado",
        tipo: "outro",
        modelo: "Desconhecido",
        conectado: false,
        ultimaConexao: new Date().toISOString(),
      });

      console.log(`[BLE] Desconectado do dispositivo: ${dispositivoId}`);
      return true;
    } catch (error) {
      console.error("[BLE] Erro ao desconectar:", error);
      return false;
    }
  }

  /**
   * Subscreve às notificações de peso da BPB 085 (NUS UART).
   * IMPORTANTE: a BPB 085 não envia peso espontaneamente.
   * É preciso escrever ';peso' na TX e ela responde na RX.
   * Resposta: '+0000.0;Z;1;'  (+ peso em kg ; status Z/U/O ; ok 1)
   */
  public async subscritoPeso(dispositivoId: string): Promise<boolean> {
    try {
      console.log(`[BLE] Iniciando subscrição de peso (BPB085): ${dispositivoId}`);

      const device = this.dispositivosConectados.get(dispositivoId);
      if (!device) throw new Error(`Dispositivo ${dispositivoId} não conectado`);

      const services = await device.services();

      // Prefere o NUS padrão; fallback no primeiro serviço não-genérico
      const service =
        services.find((s) => s.uuid.toLowerCase() === NUS_SERVICE) ??
        services.find((s) => !s.uuid.startsWith("0000"));

      if (!service) throw new Error("Serviço UART não encontrado no dispositivo");

      const chars = await service.characteristics();

      // RX — recebe dados do dispositivo
      const rxChar =
        chars.find((c) => c.uuid.toLowerCase() === NUS_RX_NOTIFY) ??
        chars.find((c) => c.isNotifiable);

      // TX — envia comandos para o dispositivo
      const txChar =
        chars.find((c) => c.uuid.toLowerCase() === NUS_TX_WRITE) ??
        chars.find((c) => c.isWritableWithResponse || c.isWritableWithoutResponse);

      if (!rxChar) throw new Error("Característica RX (notify) não encontrada");
      if (!txChar) {
        console.warn("[BLE] Característica TX não encontrada — balança passiva");
      } else {
        this.txCharacteristics.set(dispositivoId, txChar);
        console.log(`[BLE] TX armazenado: ${txChar.uuid}`);
      }

      // Subscreve notificações da RX
      const subscription = rxChar.monitor((error, char) => {
        if (error) {
          this.emitirErro({
            codigo: "BLE_MONITOR_ERROR",
            mensagem: `Erro ao monitorar peso: ${error.message}`,
            timestamp: new Date().toISOString(),
            dispositivo: dispositivoId,
            recuperavel: true,
          });
          return;
        }
        if (char?.value) this.processarDadosPeso(char.value, dispositivoId);
      });

      this.subscricoes.set(dispositivoId, subscription);

      // Polling: envia ';peso' periodicamente para a BPB 085
      if (txChar) {
        const intervalId = setInterval(async () => {
          try {
            await this.enviarComando(dispositivoId, ";peso");
          } catch {
            // Dispositivo pode ter desconectado; o monitor notificará erro
          }
        }, POLLING_INTERVALO_MS);
        this.pollingIntervals.set(dispositivoId, intervalId);
        // Primeira leitura imediata
        this.enviarComando(dispositivoId, ";peso").catch(() => { });
      }

      console.log(`[BLE] Subscrição de peso BPB085 iniciada`);
      return true;
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : String(error);
      this.emitirErro({
        codigo: "BLE_SUBSCRIBE_ERROR",
        mensagem: `Erro ao subscribir a peso: ${mensagem}`,
        timestamp: new Date().toISOString(),
        dispositivo: dispositivoId,
        recuperavel: false,
      });
      return false;
    }
  }

  /**
   * Escreve um comando texto na característica TX do dispositivo.
   * O texto é codificado em base64 antes de ser enviado.
   */
  public async enviarComando(dispositivoId: string, comando: string): Promise<void> {
    const txChar = this.txCharacteristics.get(dispositivoId);
    if (!txChar) return;
    const encoded = Buffer.from(comando + "\n").toString("base64");
    if (txChar.isWritableWithResponse) {
      await txChar.writeWithResponse(encoded);
    } else {
      await txChar.writeWithoutResponse(encoded);
    }
  }

  /** Envia comando de tara para a BPB 085 */
  public async tara(dispositivoId: string): Promise<void> {
    await this.enviarComando(dispositivoId, ";tara");
  }

  /** Consulta nível de bateria da BPB 085 */
  public async batt(dispositivoId: string): Promise<void> {
    await this.enviarComando(dispositivoId, ";batt");
  }

  /**
   * Subscreve às notificações de chip do leitor RFID XRS2i
   */
  public async subscritoChip(dispositivoId: string): Promise<boolean> {
    try {
      console.log(`[BLE] Iniciando subscrição de chip: ${dispositivoId}`);

      const device = this.dispositivosConectados.get(dispositivoId);
      if (!device) {
        throw new Error(`Dispositivo ${dispositivoId} não conectado`);
      }

      const services = await device.services();

      // Procura por serviço UART ou genérico
      let service = services.find((s) => s.uuid.toLowerCase() === NUS_SERVICE);

      if (!service) {
        service = services.find((s) => !s.uuid.startsWith("0000"));
      }

      if (!service) {
        throw new Error("Serviço de dados não encontrado no dispositivo");
      }

      const characteristics = await service.characteristics();

      let characteristic = characteristics.find(
        (c) => c.uuid.toLowerCase() === NUS_RX_NOTIFY
      );

      if (!characteristic) {
        characteristic = characteristics.find(
          (c) => c.isNotifiable || c.uuid.includes("0003")
        );
      }

      if (!characteristic) {
        throw new Error("Característica de notificação não encontrada");
      }

      // Subscreve a notificações
      const subscription = characteristic.monitor((error, char) => {
        if (error) {
          this.emitirErro({
            codigo: "BLE_CHIP_ERROR",
            mensagem: `Erro ao monitorar chip: ${error.message}`,
            timestamp: new Date().toISOString(),
            dispositivo: dispositivoId,
            recuperavel: true,
          });
          return;
        }

        if (char?.value) {
          this.processarDadosChip(char.value, dispositivoId);
        }
      });

      this.subscricoes.set(dispositivoId, subscription);
      console.log(`[BLE] Subscrição de chip iniciada`);
      return true;
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : String(error);
      this.emitirErro({
        codigo: "BLE_SUBSCRIBE_CHIP_ERROR",
        mensagem: `Erro ao subscribir a chip: ${mensagem}`,
        timestamp: new Date().toISOString(),
        dispositivo: dispositivoId,
        recuperavel: false,
      });
      return false;
    }
  }

  /**
   * Processa dados brutos de peso vindo da BPB 085
   * Formato real (ASCII puro, sem STX/ETX): "+0000.0;Z;1;\r\n"
   * (+ peso em kg ; status E/Z (estável) ou I/U (instável) ; ok)
   */
  private processarDadosPeso(dataBase64: string, dispositivoId: string): void {
    try {
      // Decodifica base64 para bytes
      const bytes = Platform.OS === "android"
        ? Buffer.from(dataBase64, "base64")
        : Uint8Array.from(dataBase64.split("").map((c) => c.charCodeAt(0)));

      const chunk = String.fromCharCode(...bytes);

      // Acumula no buffer do dispositivo e extrai linhas completas (\r\n)
      const buffer = (this.buffersPeso.get(dispositivoId) ?? "") + chunk;
      const linhas = buffer.split("\r\n");
      this.buffersPeso.set(dispositivoId, linhas.pop() ?? "");

      for (const linha of linhas) {
        const match = linha.match(/^\+(-?\d+(?:\.\d+)?);([A-Za-z])/);
        if (!match) {
          if (linha.trim()) console.warn("[BLE] Peso não encontrado na linha:", linha);
          continue;
        }

        const peso = parseFloat(match[1]);
        const statusLetra = match[2].toUpperCase();
        const status =
          statusLetra === "I" || statusLetra === "U"
            ? StatusPeso.INSTAVEL
            : StatusPeso.ESTAVEL;

        const leitura: LeituraPeso = {
          peso,
          timestamp: new Date().toISOString(),
          status,
          dispositivoId,
          valido: true,
          erro: undefined,
        };

        console.log(`[BLE] Peso lido: ${peso} kg (${status})`);
        this.listeners.onPeso?.(leitura);
      }
    } catch (error) {
      console.error("[BLE] Erro ao processar dados de peso:", error);
      this.emitirErro({
        codigo: "BLE_PARSE_PESO_ERROR",
        mensagem: `Erro ao processar peso: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date().toISOString(),
        dispositivo: dispositivoId,
        recuperavel: true,
      });
    }
  }

  /**
   * Processa dados brutos de chip vindo do leitor RFID XRS2i
   * Formato real: EID decimal puro terminado em \r\n (ex.: "963000407264340\r\n")
   * Não há sinal (dBm) embutido no payload — usamos o RSSI do próprio Device BLE.
   */
  private processarDadosChip(dataBase64: string, dispositivoId: string): void {
    try {
      // Decodifica base64
      const bytes = Platform.OS === "android"
        ? Buffer.from(dataBase64, "base64")
        : Uint8Array.from(dataBase64.split("").map((c) => c.charCodeAt(0)));

      const chunk = String.fromCharCode(...bytes);

      // Acumula no buffer do dispositivo e extrai linhas completas (\r\n)
      const buffer = (this.buffersChip.get(dispositivoId) ?? "") + chunk;
      const linhas = buffer.split("\r\n");
      this.buffersChip.set(dispositivoId, linhas.pop() ?? "");

      const device = this.dispositivosConectados.get(dispositivoId);
      const sinSinal = device?.rssi ?? 0;

      for (const linha of linhas) {
        const texto = linha.trim();
        if (!texto) continue;

        const chipMatch = texto.match(/(\d{15})/);
        if (!chipMatch) {
          console.warn("[BLE] Chip não encontrado na linha:", texto);
          continue;
        }

        const chipId = chipMatch[1];

        const leitura: LeituraChip = {
          chipId,
          timestamp: new Date().toISOString(),
          sinSinal,
          dispositivoId,
          valido: this.validarChip(chipId),
          erro: undefined,
        };

        console.log(`[BLE] Chip lido: ${chipId} (sinal: ${sinSinal})`);
        this.listeners.onChip?.(leitura);
      }
    } catch (error) {
      console.error("[BLE] Erro ao processar dados de chip:", error);
      this.emitirErro({
        codigo: "BLE_PARSE_CHIP_ERROR",
        mensagem: `Erro ao processar chip: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date().toISOString(),
        dispositivo: dispositivoId,
        recuperavel: true,
      });
    }
  }

  /**
   * Valida formato do chip (15 dígitos, SISBOV)
   */
  private validarChip(chipId: string): boolean {
    return /^\d{15}$/.test(chipId);
  }

  /**
   * Limpa todos os listeners e subscrições
   */
  public async limpar(): Promise<void> {
    try {
      // Para todos os pollings
      this.pollingIntervals.forEach((id) => clearInterval(id));
      this.pollingIntervals.clear();
      this.txCharacteristics.clear();
      this.buffersPeso.clear();
      this.buffersChip.clear();

      // Remove todas as subscrições
      this.subscricoes.forEach((sub) => {
        try { sub.remove?.(); } catch { }
      });
      this.subscricoes.clear();

      // Desconecta de todos os dispositivos
      const ids = Array.from(this.dispositivosConectados.keys());
      for (const id of ids) await this.desconectar(id);

      this.dispositivosConectados.clear();
      this.listeners = {};
      console.log("[BLE] Limpeza concluída");
    } catch (error) {
      console.error("[BLE] Erro ao limpar:", error);
    }
  }

  /**
   * Emite erro para listeners
   */
  private emitirErro(erro: ErroBluetooth): void {
    this.listeners.onErro?.(erro);
  }

  /**
   * Retorna estado de conectividade de todos os dispositivos
   */
  public obterStatusDispositivos(): DispositivoBluetooth[] {
    return Array.from(this.dispositivosConectados.values()).map((device) => ({
      id: device.id,
      nome: device.name || "Desconhecido",
      tipo: this.identificarTipoDispositivo(device.name || ""),
      modelo: device.name || "Desconhecido",
      conectado: true,
      ultimaConexao: new Date().toISOString(),
      sinSinal: device.rssi ?? undefined,
    }));
  }
}

// Singleton instance
let bluetoothService: BluetoothService | null = null;

export function obterBluetoothService(): BluetoothService {
  if (!bluetoothService) {
    bluetoothService = new BluetoothService();
  }
  return bluetoothService;
}
