/**
 * Exporta uma View renderizada como imagem PNG.
 *
 * Nativo: captura em arquivo temporário e abre a tela de compartilhar
 * (WhatsApp, e-mail…). Web: captura em data-URI e dispara o download.
 * A view precisa estar montada e com layout concluído no momento da captura.
 */
import { Platform } from "react-native";
import { captureRef } from "react-native-view-shot";
import { salvarArquivo } from "./downloadArquivo";

export async function exportarViewComoPng(
  ref: React.RefObject<any>,
  nomeArquivo: string
): Promise<void> {
  if (Platform.OS === "web") {
    const dataUri: string = await captureRef(ref, { format: "png", quality: 1, result: "data-uri" });
    const base64 = dataUri.split(",")[1] ?? "";
    const binario = atob(base64);
    const bytes = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
    await salvarArquivo(nomeArquivo, bytes, "image/png");
    return;
  }

  const uri: string = await captureRef(ref, { format: "png", quality: 1, result: "tmpfile" });
  const Sharing = await import("expo-sharing");
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: nomeArquivo });
  }
}
