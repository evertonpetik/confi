import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Platform,
  StyleSheet,
  Alert,
} from "react-native";
import { PesagemFirestoreService } from "../../services/pesagemFirestoreService";
import { Pesagem, Bovino } from "../../services/weighing.types";

interface TelaHistoricoPesagensProps {
  bovino: Bovino;
  farmedaId: string;
  onVoltarAoMenu: () => void;
}

/**
 * Tela de histórico de pesagens de um animal
 * Mostra todas as pesagens realizadas e permite análise de tendências
 */
export const TelaHistoricoPesagens: React.FC<TelaHistoricoPesagensProps> = ({
  bovino,
  farmedaId,
  onVoltarAoMenu,
}) => {
  const [pesagens, setPesagens] = useState<Pesagem[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    carregarPesagens();
  }, [bovino.id]);

  const carregarPesagens = async () => {
    try {
      setCarregando(true);
      const dados = await PesagemFirestoreService.obterPesagensAnimal(
        bovino.id || "",
        farmedaId,
        100
      );
      setPesagens(dados);
    } catch (error) {
      console.error("Erro ao carregar pesagens:", error);
      Alert.alert("Erro", "Não foi possível carregar o histórico de pesagens");
    } finally {
      setCarregando(false);
    }
  };

  const calcularEstatisticas = () => {
    if (pesagens.length === 0) {
      return {
        mediaWeight: 0,
        minWeight: 0,
        maxWeight: 0,
        ganhoTotal: 0,
        diasDesdeUltima: 0,
      };
    }

    const pesos = pesagens.map((p) => p.peso);
    const mediaWeight = pesos.reduce((a, b) => a + b, 0) / pesos.length;
    const minWeight = Math.min(...pesos);
    const maxWeight = Math.max(...pesos);

    const ganhoTotal =
      pesagens.length > 1
        ? pesagens[0].peso - pesagens[pesagens.length - 1].peso
        : 0;

    const diasDesdeUltima = pesagens.length > 0
      ? Math.floor(
          (Date.now() - new Date(pesagens[0].dataHora).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : 0;

    return { mediaWeight, minWeight, maxWeight, ganhoTotal, diasDesdeUltima };
  };

  const deletarPesagem = async (pesagemId: string) => {
    Alert.alert(
      "Deletar pesagem",
      "Tem certeza que deseja deletar esta pesagem? Esta ação não pode ser desfeita.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Deletar",
          style: "destructive",
          onPress: async () => {
            try {
              const sucesso = await PesagemFirestoreService.excluirPesagem(
                pesagemId,
                bovino.id || "",
                farmedaId
              );
              if (sucesso) {
                setPesagens((prev) =>
                  prev.filter((p) => p.id !== pesagemId)
                );
                Alert.alert("Sucesso", "Pesagem deletada");
              }
            } catch (error) {
              Alert.alert("Erro", "Não foi possível deletar a pesagem");
            }
          },
        },
      ]
    );
  };

  const stats = calcularEstatisticas();

  const renderItem = ({ item }: { item: Pesagem }) => (
    <View style={styles.itemPesagem}>
      <View style={styles.itemInfo}>
        <View style={styles.itemHeader}>
          <Text style={styles.itemPeso}>{item.peso.toFixed(2)} kg</Text>
          <Text style={styles.itemTipo}>{item.tipoPesagem}</Text>
        </View>
        <Text style={styles.itemData}>
          {new Date(item.dataHora).toLocaleString("pt-BR")}
        </Text>
        {item.observacoes && (
          <Text style={styles.itemObs}>{item.observacoes}</Text>
        )}
        {item.pesoPrevisto && (
          <Text style={styles.itemComparativo}>
            Previsto: {item.pesoPrevisto.toFixed(2)} kg
            {item.diferencaPeso && (
              <Text
                style={[
                  styles.itemDiferenca,
                  {
                    color: item.diferencaPeso > 0 ? "#4caf50" : "#f44336",
                  },
                ]}
              >
                {" "}
                ({item.diferencaPeso > 0 ? "+" : ""}
                {item.diferencaPeso.toFixed(2)} kg)
              </Text>
            )}
          </Text>
        )}
      </View>
      <TouchableOpacity
        style={styles.btnDelete}
        onPress={() => item.id && deletarPesagem(item.id)}
      >
        <Text style={styles.textoBtnDelete}>🗑</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onVoltarAoMenu} style={styles.btnVoltar}>
          <Text style={styles.textoBtnVoltar}>‹ Voltar</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.titulo}>Histórico de Pesagens</Text>
          <Text style={styles.subtitulo}>{bovino.nome}</Text>
        </View>
      </View>

      {carregando ? (
        <ActivityIndicator
          size="large"
          color="#0066cc"
          style={styles.carregando}
        />
      ) : pesagens.length === 0 ? (
        <View style={styles.vazio}>
          <Text style={styles.textoVazio}>
            Nenhuma pesagem registrada para este animal
          </Text>
        </View>
      ) : (
        <>
          {/* Estatísticas */}
          <View style={styles.stats}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Média</Text>
              <Text style={styles.statValor}>
                {stats.mediaWeight.toFixed(0)} kg
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Mínimo</Text>
              <Text style={styles.statValor}>{stats.minWeight.toFixed(0)} kg</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Máximo</Text>
              <Text style={styles.statValor}>
                {stats.maxWeight.toFixed(0)} kg
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Ganho</Text>
              <Text
                style={[
                  styles.statValor,
                  { color: stats.ganhoTotal > 0 ? "#4caf50" : "#f44336" },
                ]}
              >
                {stats.ganhoTotal > 0 ? "+" : ""}
                {stats.ganhoTotal.toFixed(0)} kg
              </Text>
            </View>
          </View>

          {/* Resumo */}
          <View style={styles.resumo}>
            <Text style={styles.resumoTxt}>
              {pesagens.length} pesagem{pesagens.length !== 1 ? "s" : ""} •{" "}
              {stats.diasDesdeUltima} dia{stats.diasDesdeUltima !== 1 ? "s" : ""}{" "}
              desde a última
            </Text>
          </View>

          {/* Lista de Pesagens */}
          <FlatList
            data={pesagens}
            renderItem={renderItem}
            keyExtractor={(item) => item.id || `${item.dataHora}`}
            style={styles.lista}
            contentContainerStyle={styles.listaConteudo}
            scrollEventThrottle={16}
          />
        </>
      )}
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
    paddingBottom: 15,
    paddingHorizontal: 15,
  },
  btnVoltar: {
    marginBottom: 10,
  },
  textoBtnVoltar: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
  titulo: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
  subtitulo: {
    color: "#e0e0ff",
    fontSize: 12,
    marginTop: 2,
  },
  stats: {
    flexDirection: "row",
    padding: 10,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
    elevation: 2,
  },
  statLabel: {
    fontSize: 11,
    color: "#666",
    marginBottom: 4,
  },
  statValor: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#0066cc",
  },
  resumo: {
    backgroundColor: "#fff",
    padding: 10,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  resumoTxt: {
    fontSize: 12,
    color: "#666",
  },
  lista: {
    flex: 1,
  },
  listaConteudo: {
    padding: 10,
  },
  itemPesagem: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    elevation: 2,
  },
  itemInfo: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  itemPeso: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0066cc",
  },
  itemTipo: {
    fontSize: 11,
    backgroundColor: "#e3f2fd",
    color: "#0066cc",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  itemData: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  itemObs: {
    fontSize: 11,
    color: "#999",
    fontStyle: "italic",
  },
  itemComparativo: {
    fontSize: 11,
    color: "#666",
    marginTop: 4,
  },
  itemDiferenca: {
    fontWeight: "bold",
  },
  btnDelete: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#ffebee",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  textoBtnDelete: {
    fontSize: 16,
  },
  carregando: {
    flex: 1,
    justifyContent: "center",
  },
  vazio: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  textoVazio: {
    fontSize: 16,
    color: "#999",
  },
});
