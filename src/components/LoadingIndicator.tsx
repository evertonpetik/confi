/**
 * Indicador de carregamento com percentual.
 *
 * Substitui o `ActivityIndicator` solto nas telas: mostra o spinner e, ao lado
 * (ou abaixo), quantos % já carregaram até 100 %. O percentual vem de um
 * `Progresso` (hook `useProgresso`) — ver src/hooks/useProgresso.ts.
 *
 * Entre uma etapa e outra o número anda suavemente até o `teto` da etapa atual
 * (nunca passa da próxima etapa nem chega a 100 % antes de `concluir()`), para
 * consultas lentas não parecerem travadas. Ao concluir, vai rápido a 100 %.
 *
 * Sem `progresso` o componente se comporta como o ActivityIndicator comum
 * (sem número), para casos onde não há como medir etapas.
 *
 *   <LoadingIndicator progresso={progresso} />                       // tela/lista
 *   <LoadingIndicator progresso={progresso} size="small" inline color="#FFF" /> // botão
 */
import { useTheme } from "@/contexts/ThemeContext";
import { Progresso } from "@/hooks/useProgresso";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";

type Props = {
  progresso?: Pick<Progresso, "valor" | "teto" | "ciclo"> | null;
  size?: "small" | "large";
  color?: string;
  /** Cor do texto do percentual (padrão: a mesma do spinner). */
  textColor?: string;
  style?: StyleProp<ViewStyle>;
  /** Texto auxiliar, ex.: "Carregando animais". Fica antes do percentual. */
  texto?: string;
  /** Spinner e percentual lado a lado (para botões e linhas). Padrão: empilhados. */
  inline?: boolean;
  /** Oculta a barra fina de progresso exibida no modo grande empilhado. */
  semBarra?: boolean;
  /** Mostra só o percentual, sem o spinner (quando o spinner fica em outro lugar apertado, ex.: dentro de um círculo). */
  semSpinner?: boolean;
};

const INTERVALO_MS = 80;
/** Fração da distância até o teto percorrida a cada tick (animação assintótica). */
const SUAVIZACAO = 0.06;

export function LoadingIndicator({
  progresso,
  size = "large",
  color,
  textColor,
  style,
  texto,
  inline = false,
  semBarra = false,
  semSpinner = false,
}: Props) {
  const { primaryColor } = useTheme();
  const cor = color ?? primaryColor;
  const corTexto = textColor ?? cor;

  const valor = progresso?.valor ?? 0;
  const teto = progresso?.teto ?? 90;
  const ciclo = progresso?.ciclo ?? 0;

  const [exibido, setExibido] = useState(valor);
  const exibidoRef = useRef(valor);
  const cicloRef = useRef(ciclo);

  // Novo carregamento: zera a animação.
  useEffect(() => {
    if (cicloRef.current !== ciclo) {
      cicloRef.current = ciclo;
      exibidoRef.current = 0;
      setExibido(0);
    }
  }, [ciclo]);

  // O número nunca fica abaixo do progresso real.
  useEffect(() => {
    if (valor > exibidoRef.current) {
      exibidoRef.current = valor;
      setExibido(valor);
    }
  }, [valor]);

  // Animação suave até o teto da etapa atual (ou até 100 ao concluir).
  useEffect(() => {
    if (!progresso) return;
    if (exibidoRef.current >= 100) return;
    const alvo = valor >= 100 ? 100 : teto;
    const id = setInterval(() => {
      const atual = exibidoRef.current;
      if (atual >= alvo) return;
      const passo = valor >= 100 ? Math.max(4, (alvo - atual) * 0.4) : (alvo - atual) * SUAVIZACAO;
      const proximo = Math.min(alvo, atual + passo);
      // Evita re-render quando a diferença não muda o inteiro exibido.
      if (Math.round(proximo) !== Math.round(atual) || proximo >= alvo) {
        exibidoRef.current = proximo;
        setExibido(proximo);
      } else {
        exibidoRef.current = proximo;
      }
    }, INTERVALO_MS);
    return () => clearInterval(id);
  }, [progresso, valor, teto]);

  const pct = Math.min(100, Math.max(0, Math.round(exibido)));
  const mostrarPct = !!progresso;
  const fontePct = size === "small" ? 12 : 14;

  if (inline) {
    return (
      <View style={[styles.inline, style]}>
        {!semSpinner && <ActivityIndicator size={size} color={cor} />}
        {(texto || mostrarPct) && (
          <Text style={[styles.textoInline, { color: corTexto, fontSize: fontePct }]} numberOfLines={1}>
            {texto ? `${texto} ` : ""}
            {mostrarPct ? `${pct}%` : ""}
          </Text>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.empilhado, style]}>
      {!semSpinner && <ActivityIndicator size={size} color={cor} />}
      {(texto || mostrarPct) && (
        <Text style={[styles.textoEmpilhado, { color: corTexto, fontSize: fontePct }]}>
          {texto ? `${texto} ` : ""}
          {mostrarPct ? `${pct}%` : ""}
        </Text>
      )}
      {mostrarPct && size === "large" && !semBarra && (
        <View style={[styles.barraFundo, { backgroundColor: `${cor}33` }]}>
          <View style={[styles.barraPreenchida, { width: `${pct}%`, backgroundColor: cor }]} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  empilhado: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  inline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  textoEmpilhado: {
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  textoInline: {
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  barraFundo: {
    width: 160,
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  barraPreenchida: {
    height: "100%",
    borderRadius: 2,
  },
});
