/**
 * Avisos e confirmações que funcionam no navegador e no aparelho.
 *
 * O `Alert` do react-native-web é literalmente `static alert() {}` — um método
 * vazio. Isso tem duas consequências ruins no navegador: erros somem sem o
 * operador ver, e — pior — uma confirmação com botões nunca chama o `onPress`,
 * então a ação é cancelada em silêncio. Travas como a de embarque de animal de
 * terceiro simplesmente não apareciam.
 */
import { Alert, Platform } from "react-native";

export interface BotaoAlerta {
  text: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
}

const isWeb = Platform.OS === "web";

/** Aviso simples, sem decisão a tomar. */
export function avisar(titulo: string, mensagem?: string): void {
  if (!isWeb) {
    Alert.alert(titulo, mensagem);
    return;
  }
  window.alert(mensagem ? `${titulo}\n\n${mensagem}` : titulo);
}

/**
 * Confirmação com botões.
 *
 * No navegador vira um `confirm`: o botão de ação é o "OK" e o de cancelar é
 * o "Cancelar". Com mais de dois botões, usa o último como ação — é a
 * convenção dos nossos diálogos, onde o destrutivo vem por último.
 */
export function confirmar(titulo: string, mensagem: string, botoes: BotaoAlerta[]): void {
  if (!isWeb) {
    Alert.alert(titulo, mensagem, botoes);
    return;
  }

  const cancelar = botoes.find((b) => b.style === "cancel");
  const acao = botoes.filter((b) => b.style !== "cancel").pop() ?? botoes[botoes.length - 1];

  const rotulos = `\n\n[OK] ${acao?.text ?? "Confirmar"}` + (cancelar ? `\n[Cancelar] ${cancelar.text}` : "");
  const aceitou = window.confirm(`${titulo}\n\n${mensagem}${rotulos}`);

  if (aceitou) acao?.onPress?.();
  else cancelar?.onPress?.();
}

/**
 * Ponte para o código que já chama `Alert.alert(...)`.
 * Escolhe entre aviso e confirmação pela presença de botões.
 */
export const Aviso = {
  alert(titulo: string, mensagem?: string, botoes?: BotaoAlerta[]) {
    if (botoes && botoes.length > 0) confirmar(titulo, mensagem ?? "", botoes);
    else avisar(titulo, mensagem);
  },
};

export default Aviso;
