/**
 * Entrega de arquivo gerado ao usuário, nos dois ambientes.
 *
 * No navegador vira download. No aparelho, grava em arquivo temporário e abre
 * a tela de compartilhamento — é de lá que o operador manda a planilha por
 * e-mail ou WhatsApp para a certificadora, sem passar pelo computador.
 */
import { Platform } from "react-native";


export async function salvarArquivo(
  nome: string,
  bytes: Uint8Array,
  tipoMime: string
): Promise<void> {
  if (Platform.OS === "web") {
    // `bytes.buffer` pode ser um ArrayBuffer maior que o conteúdo; a cópia
    // garante que o download não leve bytes de outra coisa junto.
    const blob = new Blob([new Uint8Array(bytes)], { type: tipoMime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = nome;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Espera o download começar antes de invalidar a URL
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return;
  }

  const { File, Paths } = await import("expo-file-system");
  const Sharing = await import("expo-sharing");

  const arquivo = new File(Paths.cache, nome);
  if (arquivo.exists) arquivo.delete();
  arquivo.create();
  // Grava os bytes crus: xlsx e zip são binários, e passar por string
  // corromperia o conteúdo.
  arquivo.write(bytes);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(arquivo.uri, { mimeType: tipoMime, dialogTitle: nome });
  }
}
