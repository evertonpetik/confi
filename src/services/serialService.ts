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

type SerialListener = (reading: SerialReading) => void;

const noop = () => () => { };

const serialService = {
  isSupported: false as const,
  devices: [] as SerialDevice[],
  onReading: noop as (fn: SerialListener) => () => void,
  onWeight: noop as (fn: (peso: number) => void) => () => void,
  onRfid: noop as (fn: (chip: string) => void) => () => void,
  requestPort: async () => null as SerialDevice | null,
  reconnectGranted: async () => [] as SerialDevice[],
  disconnectPort: async (_id: string) => { },
  disconnectAll: async () => { },
};

export { serialService };
export default serialService;
