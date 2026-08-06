import { Redirect } from "expo-router";
export default function PesagemLeituraPage() {
  return <Redirect href="/(app)/pesagem-balanca" />;
}

import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useWeighing } from "../../contexts/WeighingContext";
import { Bovino } from "../../services/weighing.types";

interface TelaLeituraPesagemProps {
  bovino: Bovino;
  onPesagemConcluida: () => void;
  onCancelar: () => void;
}

/**
 * Tela de leitura em tempo real de peso e chip
 * Interface principal durante a pesagem
 */
export const TelaLeituraPesagem: React.FC<TelaLeituraPesagemProps> = ({
  bovino,
  onPesagemConcluida,
  onCancelar,
}) => {
  const {
    sessaoAtiva,
    leituraChipAtual,
    leituraPesoAtual,
    confirmarPesagem,
    cancelarPesagem,
  } = useWeighing();

  const [animacaoChip] = useState(new Animated.Value(0));
  const [animacaoPeso] = useState(new Animated.Value(0));
  const [pronto, setPronto] = useState(false);

  // Valida leitura e habilita confirmação
  useEffect(() => {
    if (leituraChipAtual?.valido && leituraPesoAtual?.status === "estavel") {
      setPronto(true);
      // Animação de sucesso
      Animated.sequence([
        Animated.timing(animacaoChip, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(animacaoPeso, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [leituraChipAtual, leituraPesoAtual]);

  const handleConfirmar = async () => {
    try {
      await confirmarPesagem();
      Alert.alert("Sucesso", "Pesagem registrada com sucesso!");
      onPesagemConcluida();
    } catch (error) {
      Alert.alert("Erro", "Não foi possível salvar a pesagem");
    }
  };

  const handleCancelar = () => {
    Alert.alert("Cancelar", "Deseja cancelar esta pesagem?", [
      { text: "Continuar", style: "cancel" },
      {
        text: "Cancelar pesagem",
        onPress: () => {
          cancelarPesagem();
          onCancelar();
        },
        style: "destructive",
      },
    ]);
  };

  const opacidadeChip = animacaoChip.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1],
  });

  const opacidadePeso = animacaoPeso.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1],
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.titulo}>Pesando...</Text>
          <Text style={styles.animal}>{bovino.nome}</Text>
          <Text style={styles.chip}>{bovino.chipId}</Text>
        </View>
        <TouchableOpacity onPress={handleCancelar} style={styles.btnFechar}>
          <Text style={styles.textoBtnFechar}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Área Principal */}
      <View style={styles.conteudo}>
        {/* Leitura do Chip */}
        <Animated.View style={[styles.cartao, { opacity: opacidadeChip }]}>
          <View style={styles.cartaoHeader}>
            <Text style={styles.cartaoTitulo}>🔷 Leitura do Chip</Text>
          </View>

          {leituraChipAtual ? (
            <View>
              <Text style={styles.chipValor}>{leituraChipAtual.chipId}</Text>
              <Text style={styles.chipStatus}>
                {leituraChipAtual.valido ? "✓ Válido" : "✗ Inválido"}
              </Text>
              <Text style={styles.chipSinal}>
                Sinal: {leituraChipAtual.sinSinal} dBm
              </Text>
            </View>
          ) : (
            <View style={styles.aguardando}>
              <ActivityIndicator size="large" color="#0066cc" />
              <Text style={styles.textoAguardando}>
                Aproxime o leitor do chip do animal...
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Leitura do Peso */}
        <Animated.View style={[styles.cartao, { opacity: opacidadePeso }]}>
          <View style={styles.cartaoHeader}>
            <Text style={styles.cartaoTitulo}>⚖ Leitura do Peso</Text>
          </View>

          {leituraPesoAtual ? (
            <View>
              <Text style={styles.pesoValor}>
                {leituraPesoAtual.peso.toFixed(2)} kg
              </Text>
              <View style={styles.statusContainer}>
                <View
                  style={[
                    styles.statusIndicador,
                    {
                      backgroundColor:
                        leituraPesoAtual.status === "estavel"
                          ? "#4caf50"
                          : "#ff9800",
                    },
                  ]}
                />
                <Text style={styles.pesoStatus}>
                  {leituraPesoAtual.status === "estavel"
                    ? "✓ Peso Estável"
                    : "Peso Instável"}
                </Text>
              </View>
              {bovino.pesoAnterior && (
                <View style={styles.comparativo}>
                  <Text style={styles.comparativoLabel}>
                    Anterior: {bovino.pesoAnterior} kg
                  </Text>
                  <Text
                    style={[
                      styles.comparativoValor,
                      {
                        color:
                          leituraPesoAtual.peso > bovino.pesoAnterior
                            ? "#4caf50"
                            : "#f44336",
                      },
                    ]}
                  >
                    {leituraPesoAtual.peso > bovino.pesoAnterior ? "+" : ""}
                    {(leituraPesoAtual.peso - bovino.pesoAnterior).toFixed(2)} kg
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.aguardando}>
              <ActivityIndicator size="large" color="#0066cc" />
              <Text style={styles.textoAguardando}>
                Coloque o animal na balança...
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Status da Sessão */}
        {sessaoAtiva && (
          <View style={styles.cartao}>
            <Text style={styles.statusSessao}>
              Etapa: <Text style={styles.statusValor}>{sessaoAtiva.etapa}</Text>
            </Text>
            {sessaoAtiva.erros.length > 0 && (
              <Text style={styles.errosTexto}>
                ⚠ {sessaoAtiva.erros.length} erro(s)
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Botões de Ação */}
      <View style={styles.acoes}>
        {pronto ? (
          <TouchableOpacity
            style={[styles.botao, styles.botaoConfirmar]}
            onPress={handleConfirmar}
          >
            <Text style={styles.textoBotao}>✓ Confirmar Pesagem</Text>
          </TouchableOpacity>
        ) : (
          <View style={[styles.botao, styles.botaoDesabilitado]}>
            <Text style={styles.textoBotaoDesabilitado}>
              Aguardando leituras...
            </Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.botao, styles.botaoCancelar]}
          onPress={handleCancelar}
        >
          <Text style={styles.textoBotao}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    backgroundColor: "#0066cc",
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 20,
    paddingHorizontal: 15,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  titulo: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 4,
  },
  animal: {
    color: "#e0e0ff",
    fontSize: 14,
    marginBottom: 2,
  },
  chip: {
    color: "#b0b0ff",
    fontSize: 12,
  },
  btnFechar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  textoBtnFechar: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
  conteudo: {
    flex: 1,
    padding: 15,
    gap: 12,
  },
  cartao: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    elevation: 2,
  },
  cartaoHeader: {
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    paddingBottom: 8,
  },
  cartaoTitulo: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  chipValor: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0066cc",
    marginBottom: 4,
  },
  chipStatus: {
    fontSize: 14,
    color: "#4caf50",
    fontWeight: "500",
    marginBottom: 4,
  },
  chipSinal: {
    fontSize: 12,
    color: "#999",
  },
  pesoValor: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
    marginBottom: 12,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 12,
  },
  statusIndicador: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  pesoStatus: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
  },
  comparativo: {
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    padding: 10,
  },
  comparativoLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  comparativoValor: {
    fontSize: 14,
    fontWeight: "bold",
  },
  aguardando: {
    alignItems: "center",
    paddingVertical: 20,
  },
  textoAguardando: {
    fontSize: 12,
    color: "#666",
    marginTop: 12,
    textAlign: "center",
  },
  statusSessao: {
    fontSize: 12,
    color: "#666",
  },
  statusValor: {
    fontWeight: "bold",
    color: "#0066cc",
  },
  errosTexto: {
    fontSize: 12,
    color: "#f44336",
    marginTop: 4,
  },
  acoes: {
    padding: 15,
    gap: 10,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  botao: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  botaoConfirmar: {
    backgroundColor: "#4caf50",
  },
  botaoCancelar: {
    backgroundColor: "#f44336",
  },
  botaoDesabilitado: {
    backgroundColor: "#ccc",
  },
  textoBotao: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  textoBotaoDesabilitado: {
    color: "#999",
    fontSize: 14,
  },
});
