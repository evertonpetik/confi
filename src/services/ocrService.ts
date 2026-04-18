import TextRecognition from "@react-native-ml-kit/text-recognition";

export type OCRResult = {
  rawText: string;
  extractedValue: number | null;
  confidence: "high" | "low" | "none";
};

export async function recognizeFuelPumpValue(
  imageUri: string
): Promise<OCRResult> {
  try {
    const result = await TextRecognition.recognize(imageUri);
    const rawText = result.text;

    // Strategy: look for patterns like "0034 LITROS" or numbers near "LITROS"/"LT"
    const litrosPatterns = [
      /(\d+[\.,]?\d*)\s*(?:LITROS|litros|LTS|lts|LT|lt|L)\b/i,
      /\b(?:LITROS|litros|LTS|lts)\s*(\d+[\.,]?\d*)/i,
    ];

    for (const pattern of litrosPatterns) {
      const match = rawText.match(pattern);
      if (match) {
        const value = parseFloat(match[1].replace(",", "."));
        if (!isNaN(value) && value > 0 && value < 100000) {
          return { rawText, extractedValue: value, confidence: "high" };
        }
      }
    }

    // Fallback: find numbers and pick the most likely fuel quantity
    // Exclude very large numbers (likely total counter) and very small ones
    const numbers = rawText.match(/\d+[\.,]?\d*/g);
    if (numbers) {
      const parsed = numbers
        .map((n) => parseFloat(n.replace(",", ".")))
        .filter((n) => !isNaN(n) && n > 0 && n < 10000);

      // Prefer smaller numbers (current fill) over large ones (total counter)
      const sorted = parsed.sort((a, b) => a - b);
      if (sorted.length > 0) {
        return { rawText, extractedValue: sorted[0], confidence: "low" };
      }
    }

    return { rawText, extractedValue: null, confidence: "none" };
  } catch (err) {
    console.error("OCR fuel pump error:", err);
    return { rawText: "", extractedValue: null, confidence: "none" };
  }
}

export async function recognizeMeterValue(
  imageUri: string
): Promise<OCRResult> {
  try {
    const result = await TextRecognition.recognize(imageUri);
    const rawText = result.text;

    // Strategy: look for patterns like "01903.0h", "12345 km"
    const meterPatterns = [
      /(\d+[\.,]\d+)\s*(?:km|KM|h|H|hrs|HRS)\b/i,
      /(\d{3,7}[\.,]\d{0,1})\s*(?:km|KM|h|H|hrs|HRS)?\b/,
    ];

    for (const pattern of meterPatterns) {
      const match = rawText.match(pattern);
      if (match) {
        const value = parseFloat(match[1].replace(",", "."));
        if (!isNaN(value) && value > 0) {
          return { rawText, extractedValue: value, confidence: "high" };
        }
      }
    }

    // Fallback: largest number with 3-7 digits (likely odometer/hour meter)
    const numbers = rawText.match(/\d{3,7}[\.,]?\d{0,1}/g);
    if (numbers) {
      const parsed = numbers
        .map((n) => parseFloat(n.replace(",", ".")))
        .filter((n) => !isNaN(n) && n > 0)
        .sort((a, b) => b - a);
      if (parsed.length > 0) {
        return { rawText, extractedValue: parsed[0], confidence: "low" };
      }
    }

    return { rawText, extractedValue: null, confidence: "none" };
  } catch (err) {
    console.error("OCR meter error:", err);
    return { rawText: "", extractedValue: null, confidence: "none" };
  }
}
