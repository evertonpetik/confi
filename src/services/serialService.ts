/**
 * Stub nativo do serialService
 * No Android/iOS, a comunicação é feita diretamente via BLE (bluetoothService.ts)
 * Este arquivo existe para que imports de serialService.ts não quebrem no bundle nativo
 */

export interface SerialDevice {
  id: string;
  label: string;
  type: "balanca" | "rfid" | "desconhecido";
  connected: boolean;
  baudRate: number;
}

export interface SerialReading {
  raw: string;
  timestamp: string;
  source: "balanca" | "rfid";
}

export interface LeituraPesoSerial {
  peso: number;
  estavel: boolean | null;
}

type SerialListener = (reading: SerialReading) => void;
type WeightListener = (peso: number, estavel: boolean | null) => void;

export const COMANDO_PESO = ";peso\r\n";
export const POLLING_PESO_MS = 700;

const noop = () => () => { };

const serialService = {
  isSupported: false as const,
  devices: [] as SerialDevice[],
  onReading: noop as (fn: SerialListener) => () => void,
  onRawLine: noop as (fn: (portId: string, portLabel: string, line: string) => void) => () => void,
  onWeight: noop as (fn: WeightListener) => () => void,
  onRfid: noop as (fn: (chip: string) => void) => () => void,
  requestPort: async (
    _type: "balanca" | "rfid",
    _baudRate?: number
  ) => null as SerialDevice | null,
  reconnectGranted: async (_baudRate?: number) => [] as SerialDevice[],
  write: async (_id: string, _data: string) => { },
  startWeightPolling: (_id: string, _intervaloMs?: number) => { },
  stopWeightPolling: (_id: string) => { },
  tara: async (_id: string) => { },
  assignPortType: (_id: string, _type: "balanca" | "rfid") => { },
  disconnectPort: async (_id: string) => { },
  disconnectAll: async () => { },
};

export { serialService };
export default serialService;
