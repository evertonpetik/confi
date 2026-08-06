import { GTA } from "./weighing.types";

/** Stub nativo — no Android/iOS o usuário preenche a GTA manualmente */
export async function parseGtaFromFile(_file: unknown): Promise<Partial<GTA>> {
  return {};
}
