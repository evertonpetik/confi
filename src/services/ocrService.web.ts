export type OCRResult = {
  rawText: string;
  extractedValue: number | null;
  confidence: "high" | "low" | "none";
};

export async function recognizeFuelPumpValue(
  _imageUri: string
): Promise<OCRResult> {
  return { rawText: "", extractedValue: null, confidence: "none" };
}

export async function recognizeMeterValue(
  _imageUri: string
): Promise<OCRResult> {
  return { rawText: "", extractedValue: null, confidence: "none" };
}
