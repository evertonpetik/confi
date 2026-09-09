/**
 * Serviço de comunicação via Web Serial API (PC/Browser)
 * Conecta a balanças e leitores RFID pela porta serial virtual
 * gerada ao parear um dispositivo Bluetooth (SPP - Serial Port Profile)
 *
 * Suportado em: Chrome, Edge, Opera (não suportado em Firefox/Safari)
 *
 * IMPORTANTE — protocolo da balança HD Easy BPB 085 (mesma lógica do projeto "pesagem"):
 * a balança NÃO transmite peso espontaneamente. É preciso escrever ";peso\r\n" na porta
 * e ela responde com um frame como "+0092.0;E;" (peso presente, estável) ou
 * "+0000.0;Z;" (plataforma zerada). Por isso há um polling por porta de balança.
 * O leitor de chip XRS2i, ao contrário, transmite sozinho o EID ao ler um brinco.
 */

export interface SerialDevice {
  id: string;
  label: string;       // ex: "Porta 1 (VID:0403)"
  portIndex: number;   // ordem de concessão (1-based)
  type: "balanca" | "rfid" | "desconhecido";
  connected: boolean;
  baudRate: number;
}

export interface SerialReading {
  raw: string;
  timestamp: string;
  source: "balanca" | "rfid";
}

/** Peso já interpretado. `estavel` é null quando o equipamento não informa o flag. */
export interface LeituraPesoSerial {
  peso: number;
  estavel: boolean | null;
}

type SerialListener = (reading: SerialReading) => void;
type WeightListener = (peso: number, estavel: boolean | null) => void;

/** Comando de consulta de peso da BPB 085 / ACR HD Easy. */
export const COMANDO_PESO = ";peso\r\n";
/** Intervalo de polling do peso (ms) — a balança só responde quando consultada. */
export const POLLING_PESO_MS = 700;
/** Janela de auto-detecção da balança em portas de papel ainda desconhecido (ms). */
export const DETECCAO_PESO_MS = 15000;

/**
 * Tipagem mínima da Web Serial API — o lib.dom do TS usado aqui ainda não a declara.
 */
interface SerialPort {
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  open(options: {
    baudRate: number;
    dataBits?: number;
    stopBits?: number;
    parity?: "none" | "even" | "odd";
  }): Promise<void>;
  close(): Promise<void>;
  getInfo?(): { usbVendorId?: number; usbProductId?: number };
}

const isWebSerialSupported = (): boolean =>
  typeof navigator !== "undefined" && "serial" in navigator;

// Parsers de protocolo para os equipamentos mais comuns do mercado
function parseWeightLine(line: string): LeituraPesoSerial | null {
  // Protocolo BPB 085 / ACR HD Easy (resposta ao comando ";peso"):
  //   "+0092.0;E;"     peso presente, estável
  //   "+0000.0;Z;"     plataforma zerada
  //   "+0350.5;I;1;"   instável (animal se movendo)
  // O flag de estabilidade vem do próprio equipamento: I/U = instável.
  const bpb = line.trim().match(/^\+?(-?\d+(?:[.,]\d+)?);([A-Za-z])/);
  if (bpb) {
    const peso = parseFloat(bpb[1].replace(",", "."));
    if (isNaN(peso)) return null;
    const flag = bpb[2].toUpperCase();
    return { peso, estavel: flag !== "I" && flag !== "U" };
  }

  // Fallback genérico para outros modelos, sem flag de estabilidade:
  // Rumax / Líder:    "P:0450.5"
  // Toledo:           "  450.5  S"
  // AND (FX-i):       "ST,GS,+00450.00  kg"
  // Peso inteiro:     "450"  /  "  0450 "
  const clean = line.trim().replace(/[^0-9.,+\-]/g, " ").trim();
  // Tenta primeiro número com decimal, depois inteiro >= 10
  const matchDec = clean.match(/[+\-]?\s*(\d+[.,]\d+)/);
  if (matchDec) {
    const val = parseFloat(matchDec[1].replace(",", "."));
    return isNaN(val) || val <= 0 ? null : { peso: val, estavel: null };
  }
  const matchInt = clean.match(/\b(\d{2,6})\b/); // 10–999999 kg
  if (matchInt) {
    const val = parseInt(matchInt[1], 10);
    return val >= 10 && val <= 9999 ? { peso: val, estavel: null } : null;
  }
  return null;
}

function parseRfidLine(line: string): string | null {
  // XRS2i / Agrident AWR250: "900000123456789\r"
  // ISO 11784: 15 dígitos decimais
  const clean = line.trim().replace(/\s/g, "");
  if (/^\d{15}$/.test(clean)) return clean;
  // Alguns leitores enviam HEX: converte para decimal 15d
  if (/^[0-9A-Fa-f]{15}$/.test(clean)) {
    return BigInt(`0x${clean}`).toString().padStart(15, "0").slice(-15);
  }
  return null;
}

class SerialService {
  private ports: Map<string, SerialPort> = new Map();
  private readers: Map<string, ReadableStreamDefaultReader<string>> = new Map();
  private writers: Map<string, WritableStreamDefaultWriter<Uint8Array>> = new Map();
  private readLoops: Map<string, boolean> = new Map();
  private pollings: Map<string, ReturnType<typeof setInterval>> = new Map();
  private listeners: SerialListener[] = [];
  private weightListeners: WeightListener[] = [];
  private rfidListeners: ((chip: string) => void)[] = [];
  private rawListeners: ((portId: string, portLabel: string, line: string) => void)[] = [];
  private connectedDevices: SerialDevice[] = [];

  get isSupported(): boolean {
    return isWebSerialSupported();
  }

  get devices(): SerialDevice[] {
    return [...this.connectedDevices];
  }

  onReading(fn: SerialListener): () => void {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter((l) => l !== fn); };
  }

  /** Recebe cada linha crua recebida de qualquer porta — útil para diagnóstico. */
  onRawLine(fn: (portId: string, portLabel: string, line: string) => void): () => void {
    this.rawListeners.push(fn);
    return () => { this.rawListeners = this.rawListeners.filter((l) => l !== fn); };
  }

  onWeight(fn: WeightListener): () => void {
    this.weightListeners.push(fn);
    return () => { this.weightListeners = this.weightListeners.filter((l) => l !== fn); };
  }

  onRfid(fn: (chip: string) => void): () => void {
    this.rfidListeners.push(fn);
    return () => { this.rfidListeners = this.rfidListeners.filter((l) => l !== fn); };
  }

  /**
   * Solicita ao usuário selecionar uma porta serial (abre popup do browser)
   * Usar para balança: baudRate 9600 é o padrão ACR HD Easy
   */
  async requestPort(
    type: "balanca" | "rfid",
    baudRate: number = 9600
  ): Promise<SerialDevice | null> {
    if (!isWebSerialSupported()) {
      throw new Error(
        "Web Serial API não disponível. Use Chrome ou Edge no PC."
      );
    }

    try {
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate, dataBits: 8, stopBits: 1, parity: "none" });

      const id = `port_${Date.now()}`;
      this.ports.set(id, port);

      const info = (port as any).getInfo?.() ?? {};
      const vidHex = info.usbVendorId ? ` VID:${info.usbVendorId.toString(16).toUpperCase().padStart(4, '0')}` : "";
      const portIndex = this.connectedDevices.length + 1;
      const typeLabel = type === "balanca" ? "Balança" : type === "rfid" ? "Leitor RFID" : "Dispositivo Serial";

      const device: SerialDevice = {
        id,
        label: `${typeLabel} — Porta ${portIndex}${vidHex}`,
        portIndex,
        type,
        connected: true,
        baudRate,
      };
      this.connectedDevices.push(device);

      this.startReadLoop(id, port, type);
      // Balança é passiva: inicia o polling de ";peso" imediatamente
      if (type === "balanca") this.startWeightPolling(id);
      return device;
    } catch (err: any) {
      if (err?.name === "NotFoundError") return null; // Usuário cancelou
      throw err;
    }
  }

  /**
   * Conecta a portas já concedidas anteriormente (após recarregar página)
   */
  async reconnectGranted(baudRate: number = 9600): Promise<SerialDevice[]> {
    if (!isWebSerialSupported()) return [];
    const granted: SerialPort[] = await (navigator as any).serial.getPorts();
    const connected: SerialDevice[] = [];

    for (const port of granted) {
      try {
        await port.open({ baudRate, dataBits: 8, stopBits: 1, parity: "none" });
        const id = `port_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        this.ports.set(id, port);

        const info = (port as any).getInfo?.() ?? {};
        const vidHex = info.usbVendorId ? ` VID:${info.usbVendorId.toString(16).toUpperCase().padStart(4, '0')}` : "";
        const portIndex = this.connectedDevices.length + 1;

        const device: SerialDevice = {
          id,
          label: `Porta ${portIndex}${vidHex}`,
          portIndex,
          type: "desconhecido",
          connected: true,
          baudRate,
        };
        this.connectedDevices.push(device);
        this.startReadLoop(id, port, "desconhecido");
        // Papel ainda desconhecido: consulta o peso para descobrir qual porta é a balança
        // (só ela responde a ";peso"). Janela curta, para não ficar escrevendo
        // indefinidamente numa porta que pode ser o leitor RFID — ao identificar o papel,
        // assignPortType religa o polling só na balança.
        this.startWeightPolling(id);
        setTimeout(() => {
          const atual = this.connectedDevices.find((d) => d.id === id);
          if (atual?.type === "desconhecido") this.stopWeightPolling(id);
        }, DETECCAO_PESO_MS);
        connected.push(device);
      } catch {
        // Porta ocupada ou desconectada - ignora
      }
    }
    return connected;
  }

  /** Escreve texto cru na porta (ex.: ";peso\r\n", ";tara\r\n"). */
  async write(id: string, data: string): Promise<void> {
    const port = this.ports.get(id);
    if (!port?.writable) return;

    const writer = this.writers.get(id) ?? port.writable.getWriter();
    this.writers.set(id, writer);
    await writer.write(new TextEncoder().encode(data));
  }

  /**
   * Inicia o polling de ";peso" na porta — a BPB 085 só responde quando consultada.
   * Mesma lógica do projeto "pesagem" (setInterval consultando a balança).
   */
  startWeightPolling(id: string, intervaloMs: number = POLLING_PESO_MS): void {
    this.stopWeightPolling(id);
    // Primeira consulta imediata, para o peso aparecer sem esperar o intervalo
    this.write(id, COMANDO_PESO).catch(() => { });
    const intervalId = setInterval(() => {
      this.write(id, COMANDO_PESO).catch(() => { });
    }, intervaloMs);
    this.pollings.set(id, intervalId);
  }

  stopWeightPolling(id: string): void {
    const intervalId = this.pollings.get(id);
    if (intervalId) {
      clearInterval(intervalId);
      this.pollings.delete(id);
    }
  }

  /** Envia comando de tara para a balança. */
  async tara(id: string): Promise<void> {
    await this.write(id, ";tara\r\n");
  }

  private async startReadLoop(
    id: string,
    port: SerialPort,
    _type: "balanca" | "rfid" | "desconhecido"
  ): Promise<void> {
    this.readLoops.set(id, true);
    const textDecoder = new TextDecoderStream();
    // Cast: o writable do TextDecoderStream é WritableStream<BufferSource>, compatível na prática
    port.readable!.pipeTo(textDecoder.writable as WritableStream<Uint8Array>).catch(() => { });
    const reader = textDecoder.readable.getReader();
    this.readers.set(id, reader);

    let buffer = "";

    try {
      while (this.readLoops.get(id)) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += value;
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;

          const device = this.connectedDevices.find((d) => d.id === id);
          // Papel atual da porta (pode ter mudado via assignPortType após a conexão)
          const tipo = device?.type ?? "desconhecido";

          // Dispara linha bruta para diagnóstico antes de qualquer parsing
          this.rawListeners.forEach((l) => l(id, device?.label ?? id, line));

          const reading: SerialReading = {
            raw: line,
            timestamp: new Date().toISOString(),
            source: tipo === "rfid" ? "rfid" : "balanca",
          };

          this.listeners.forEach((l) => l(reading));

          // Cada porta só é interpretada pelo protocolo do seu papel;
          // enquanto o papel é desconhecido, tenta os dois.
          if (tipo !== "rfid") {
            const leitura = parseWeightLine(line);
            if (leitura) {
              this.weightListeners.forEach((l) => l(leitura.peso, leitura.estavel));
            }
          }

          if (tipo !== "balanca") {
            const chip = parseRfidLine(line);
            if (chip !== null) {
              this.rfidListeners.forEach((l) => l(chip));
            }
          }
        }
      }
    } catch {
      // Porta fechada ou erro de leitura
    } finally {
      try { reader.releaseLock(); } catch { /* já liberado */ }
      this.disconnectPort(id);
    }
  }

  async disconnectPort(id: string): Promise<void> {
    this.readLoops.set(id, false);
    this.stopWeightPolling(id);

    try {
      const reader = this.readers.get(id);
      reader?.cancel();
    } catch { /* já fechado */ }

    try {
      const writer = this.writers.get(id);
      if (writer) {
        await writer.close().catch(() => { });
        writer.releaseLock();
      }
    } catch { /* já fechado */ }

    try {
      const port = this.ports.get(id);
      await port?.close();
    } catch { /* já fechado */ }

    this.ports.delete(id);
    this.readers.delete(id);
    this.writers.delete(id);
    this.readLoops.delete(id);
    this.connectedDevices = this.connectedDevices.filter((d) => d.id !== id);
  }

  async disconnectAll(): Promise<void> {
    const ids = Array.from(this.ports.keys());
    await Promise.all(ids.map((id) => this.disconnectPort(id)));
  }

  /** Reatribui o papel de um dispositivo já conectado (balança ↔ rfid). */
  assignPortType(id: string, type: "balanca" | "rfid"): void {
    const device = this.connectedDevices.find((d) => d.id === id);
    if (!device) return;
    device.type = type;
    const typeLabel = type === "balanca" ? "Balança" : "Leitor RFID";
    device.label = device.label.replace(/^[^—]+—?\s*/, `${typeLabel} — `);

    // O polling só faz sentido na porta da balança
    if (type === "balanca") this.startWeightPolling(id);
    else this.stopWeightPolling(id);
  }
}

export const serialService = new SerialService();
export default serialService;
