/**
 * Serviço de comunicação via Web Serial API (PC/Browser)
 * Conecta a balanças e leitores RFID pela porta serial virtual
 * gerada ao parear um dispositivo Bluetooth (SPP - Serial Port Profile)
 *
 * Suportado em: Chrome, Edge, Opera (não suportado em Firefox/Safari)
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

type SerialListener = (reading: SerialReading) => void;

const isWebSerialSupported = (): boolean =>
  typeof navigator !== "undefined" && "serial" in navigator;

// Parsers de protocolo para os equipamentos mais comuns do mercado
function parseWeightLine(line: string): number | null {
  // ACR HD Easy:      "+  450.5 kg"  /  "  450.5"
  // Rumax / Líder:    "P:0450.5"
  // Toledo:           "  450.5  S"  (S=stable, U=unstable)
  // AND (FX-i):       "ST,GS,+00450.00  kg"
  // Peso inteiro:     "450"  /  "  0450 "
  const clean = line.trim().replace(/[^0-9.,+\-]/g, " ").trim();
  // Tenta primeiro número com decimal, depois inteiro >= 10
  const matchDec = clean.match(/[+\-]?\s*(\d+[.,]\d+)/);
  if (matchDec) {
    const val = parseFloat(matchDec[1].replace(",", "."));
    return isNaN(val) || val <= 0 ? null : val;
  }
  const matchInt = clean.match(/\b(\d{2,6})\b/); // 10–999999 kg
  if (matchInt) {
    const val = parseInt(matchInt[1], 10);
    return val >= 10 && val <= 9999 ? val : null;
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
  private readLoops: Map<string, boolean> = new Map();
  private listeners: SerialListener[] = [];
  private weightListeners: ((peso: number) => void)[] = [];
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

  onWeight(fn: (peso: number) => void): () => void {
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
        connected.push(device);
      } catch {
        // Porta ocupada ou desconectada - ignora
      }
    }
    return connected;
  }

  private async startReadLoop(
    id: string,
    port: SerialPort,
    type: "balanca" | "rfid" | "desconhecido"
  ): Promise<void> {
    this.readLoops.set(id, true);
    const textDecoder = new TextDecoderStream();
    port.readable!.pipeTo(textDecoder.writable);
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
          // Dispara linha bruta para diagnóstico antes de qualquer parsing
          this.rawListeners.forEach((l) => l(id, device?.label ?? id, line));

          const reading: SerialReading = {
            raw: line,
            timestamp: new Date().toISOString(),
            source: type === "desconhecido" ? "balanca" : type,
          };

          this.listeners.forEach((l) => l(reading));

          // Auto-detecta tipo de dado
          const peso = parseWeightLine(line);
          if (peso !== null) {
            this.weightListeners.forEach((l) => l(peso));
          }

          const chip = parseRfidLine(line);
          if (chip !== null) {
            this.rfidListeners.forEach((l) => l(chip));
          }
        }
      }
    } catch {
      // Porta fechada ou erro de leitura
    } finally {
      reader.releaseLock();
      this.disconnectPort(id);
    }
  }

  async disconnectPort(id: string): Promise<void> {
    this.readLoops.set(id, false);
    try {
      const reader = this.readers.get(id);
      reader?.cancel();
    } catch { /* já fechado */ }

    try {
      const port = this.ports.get(id);
      await port?.close();
    } catch { /* já fechado */ }

    this.ports.delete(id);
    this.readers.delete(id);
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
  }
}

export const serialService = new SerialService();
export default serialService;
