import { Platform } from "react-native";
import type { EstimativaPesoResult } from "./aiWeightEstimation";

// Model configuration
const MODEL_INPUT_SIZE = 224;
const CONFIDENCE_MARGIN = 0.08; // ±8%

let _model: any = null;
let _modelLoading = false;
let _modelAvailable: boolean | null = null;

/**
 * Check if the TFLite model is available (only on native platforms)
 */
export function isModelAvailable(): boolean {
  if (Platform.OS === "web") return false;
  // Will be true once a .tflite file is bundled in assets/models/
  return _modelAvailable === true;
}

/**
 * Load the TFLite model. Call once at app start or before first inference.
 */
export async function loadModel(): Promise<boolean> {
  if (Platform.OS === "web") {
    _modelAvailable = false;
    return false;
  }

  if (_model) return true;
  if (_modelLoading) return false;

  _modelLoading = true;
  try {
    const { loadTensorflowModel } = require("react-native-fast-tflite");
    _model = await loadTensorflowModel(
      require("../../assets/models/cattle_weight_model.tflite")
    );
    _modelAvailable = true;
    return true;
  } catch (error) {
    console.log("Modelo TFLite nao encontrado ou erro ao carregar:", error);
    _modelAvailable = false;
    return false;
  } finally {
    _modelLoading = false;
  }
}

/**
 * Preprocess image: resize to 224x224 and convert to Float32Array RGB tensor
 */
async function preprocessImage(imageUri: string): Promise<Float32Array> {
  const { manipulateAsync, SaveFormat } = require("expo-image-manipulator");

  // Resize to model input dimensions
  const resized = await manipulateAsync(
    imageUri,
    [{ resize: { width: MODEL_INPUT_SIZE, height: MODEL_INPUT_SIZE } }],
    { base64: true, format: SaveFormat.JPEG }
  );

  if (!resized.base64) {
    throw new Error("Falha ao processar imagem para inferencia.");
  }

  // Decode base64 to raw bytes
  const binaryString = atob(resized.base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Decode JPEG to raw RGB pixels
  const rgbPixels = decodeJpegToRgb(bytes, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);

  // Normalize to [0, 1] float32
  const float32Data = new Float32Array(MODEL_INPUT_SIZE * MODEL_INPUT_SIZE * 3);
  for (let i = 0; i < rgbPixels.length; i++) {
    float32Data[i] = rgbPixels[i] / 255.0;
  }

  return float32Data;
}

/**
 * Simple JPEG to RGB decoder.
 * For production, consider using a native module for better performance.
 * This uses the canvas API on web or a minimal JPEG parser on native.
 */
function decodeJpegToRgb(
  jpegBytes: Uint8Array,
  width: number,
  height: number
): Uint8Array {
  // On native, we use a simplified approach:
  // The expo-image-manipulator already resized the image.
  // We re-encode as raw bitmap via a workaround using the base64 data.
  // For actual production use, react-native-fast-tflite supports
  // direct tensor input from camera frames via vision-camera-resize-plugin.

  // Placeholder: return a buffer of the expected size.
  // This will be replaced when the actual model is integrated,
  // using react-native-vision-camera's frame processor for real-time
  // or a native JPEG decoder module for single-shot analysis.
  const numPixels = width * height * 3;
  const rgb = new Uint8Array(numPixels);

  // Parse raw JPEG pixel data - find SOF marker to locate pixel data
  // For now, use the raw bytes as a rough approximation
  // The actual implementation will use a proper JPEG decoder
  for (let i = 0; i < numPixels && i < jpegBytes.length; i++) {
    rgb[i] = jpegBytes[i];
  }

  return rgb;
}

/**
 * Run weight estimation using the local TFLite model
 */
export async function estimarPesoOffline(
  imageUri: string
): Promise<EstimativaPesoResult> {
  if (!_model) {
    const loaded = await loadModel();
    if (!loaded) {
      throw new Error(
        "Modelo offline nao disponivel. Coloque o arquivo cattle_weight_model.tflite em assets/models/."
      );
    }
  }

  // Preprocess image
  const inputTensor = await preprocessImage(imageUri);

  // Run inference
  const output = await _model.run([inputTensor]);

  // Extract weight prediction (single float output)
  const pesoEstimado = output[0][0];

  if (typeof pesoEstimado !== "number" || isNaN(pesoEstimado) || pesoEstimado <= 0) {
    throw new Error("Resultado invalido do modelo.");
  }

  return {
    pesoEstimado: Math.round(pesoEstimado * 10) / 10,
    confiancaMin: Math.round(pesoEstimado * (1 - CONFIDENCE_MARGIN) * 10) / 10,
    confiancaMax: Math.round(pesoEstimado * (1 + CONFIDENCE_MARGIN) * 10) / 10,
    escoreCondicaoCorporal: 0,
    observacao: "Estimativa por modelo local (offline). ECC nao disponivel neste modo.",
  };
}
