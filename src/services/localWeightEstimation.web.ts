import type { EstimativaPesoResult } from "./aiWeightEstimation";

/**
 * Web stub - TFLite model is not available on web platform.
 * The real implementation is in localWeightEstimation.ts (native only).
 */

export function isModelAvailable(): boolean {
  return false;
}

export async function loadModel(): Promise<boolean> {
  return false;
}

export async function estimarPesoOffline(
  _imageUri: string
): Promise<EstimativaPesoResult> {
  throw new Error("Modelo offline nao disponivel na versao web.");
}
