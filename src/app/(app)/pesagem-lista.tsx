import { Redirect } from "expo-router";
export default function PesagemListaPage() {
  return <Redirect href="/(app)/pesagem-balanca" />;
}

import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useWeighing } from "../../contexts/WeighingContext";
import { Bovino, TipoMovimentacao } from "../../services/weighing.types";

interface TelaListaPesagemProps {
  farmedaId: string;
  tipoMovimentacao: TipoMovimentacao;
  onSelecionarAnimal: (bovino: Bovino) => void;
  onVoltarAoMenu: () => void;
}

/**
 * Tela de listagem e busca de animais para pesagem
 */
export const TelaListaPesagem: React.FC<TelaListaPesagemProps> = ({
  farmedaId,
  tipoMovimentacao,
  onSelecionarAnimal,
  onVoltarAoMenu,
}) => {
  const { iniciarDescoberta, balancaConectada, rfidConectada, iniciarPesagem } =
    useWeighing();

  const [bovinos, setBovinos] = useState<Bovino[]>([]);
  const [filtrados, setFiltrados] = useState<Bovino[]>([]);
  const [termo, setTermo] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [conectando, setConectando] = useState(true);

  // Carrega bovinos e conecta dispositivos
  useEffect(() => {
    carregarBovinos();
    conectarDispositivos();
  }, []);

  // Filtra bovinos conforme digitação
  useEffect(() => {
    if (!termo) {
      setFiltrados(bovinos);
    } else {
      const termo_lower = termo.toLowerCase();
      setFiltrados(
        bovinos.filter(
          (b) =>
            b.nome.toLowerCase().includes(termo_lower) ||
            b.chipId.includes(termo) ||
            b.categoria.toLowerCase().includes(termo_lower)
        )
      );
    }
  }, [termo, bovinos]);

  const carregarBovinos = async () => {
    try {
      // Busca bovinos ativos da fazenda
      // (Esta é uma implementação simplificada)
      // Na prática, você carregaria do Firestore
      setBovinos([]);
    } catch (error) {
      console.error("Erro ao carregar bovinos:", error);
      Alert.alert("Erro", "Não foi possível carregar os bovinos");
    } finally {
      setCarregando(false);
    }
  };

  const conectarDispositivos = async () => {
    try {
      setConectando(true);
      await iniciarDescoberta();
    } catch (error) {
      console.error("Erro ao descobrir dispositivos:", error);
      Alert.alert("Atenção", "Verifique se Bluetooth está ativo");
    } finally {
      setConectando(false);
    }
  };

  const handleSelecionarAnimal = async (bovino: Bovino) => {
    try {
      if (!balancaConectada || !rfidConectada) {
        Alert.alert("Aviso", "Conecte a balança e o leitor RFID primeiro");
        return;
      }

      await iniciarPesagem(tipoMovimentacao);
      onSelecionarAnimal(bovino);
    } catch (error) {
      Alert.alert("Erro", "Não foi possível iniciar a pesagem");
    }
  };

  const renderItem = ({ item }: { item: Bovino }) => (
    <TouchableOpacity
      style={styles.itemBovino}
      onPress={() => handleSelecionarAnimal(item)}
    >
      <View style={styles.itemConteudo}>
        <Text style={styles.nomeAnimal}>{item.nome}</Text>
        <View style={styles.detalhes}>
          <Text style={styles.detalheTxt}>Chip: {item.chipId}</Text>
          <Text style={styles.detalheTxt}>
            {item.categoria} • {item.sexo === "M" ? "Macho" : "Fêmea"}
          </Text>
          {item.dataUltimaPesagem && (
            <Text style={styles.detalheTxt}>
              Última pesagem: {item.pesoAnterior}kg
            </Text>
          )}
        </View>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onVoltarAoMenu} style={styles.btnVoltar}>
          <Text style={styles.textoBtnVoltar}>‹ Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.titulo}>Pesagem de Animais</Text>
        <View style={styles.statusDispositivos}>
          <Text style={[styles.statusTxt, balancaConectada && styles.ok]}>
            {balancaConectada ? "⚖ " : "○ "}Balança
          </Text>
          <Text style={[styles.statusTxt, rfidConectada && styles.ok]}>
            {rfidConectada ? "📡 " : "○ "}RFID
          </Text>
        </View>
      </View>

      {/* Busca */}
      <View style={styles.secaoBusca}>
        <TextInput
          style={styles.inputBusca}
          placeholder="Buscar por nome, chip ou categoria..."
          placeholderTextColor="#999"
          value={termo}
          onChangeText={setTermo}
        />
        <Text style={styles.totalResultados}>{filtrados.length} animais</Text>
      </View>

      {/* Lista */}
      {carregando ? (
        <ActivityIndicator
          size="large"
          color="#0066cc"
          style={styles.carregando}
        />
      ) : filtrados.length === 0 ? (
        <View style={styles.vazio}>
          <Text style={styles.textoVazio}>
            {termo
              ? "Nenhum animal encontrado"
              : "Nenhum animal disponível para pesagem"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtrados}
          renderItem={renderItem}
          keyExtractor={(item) => item.id || item.chipId}
          style={styles.lista}
          contentContainerStyle={styles.listaConteudo}
        />
      )}

      {/* Rodapé */}
      <View style={styles.rodape}>
        {conectando && (
          <Text style={styles.textoRodape}>
            Procurando dispositivos Bluetooth...
          </Text>
        )}
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
    paddingBottom: 15,
    paddingHorizontal: 15,
    elevation: 3,
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
    marginBottom: 10,
  },
  statusDispositivos: {
    flexDirection: "row",
    gap: 15,
  },
  statusTxt: {
    color: "#ffb3b3",
    fontSize: 12,
    fontWeight: "500",
  },
  ok: {
    color: "#90EE90",
  },
  secaoBusca: {
    backgroundColor: "#fff",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  inputBusca: {
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 8,
  },
  totalResultados: {
    fontSize: 12,
    color: "#666",
  },
  lista: {
    flex: 1,
  },
  listaConteudo: {
    padding: 10,
  },
  itemBovino: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    elevation: 2,
  },
  itemConteudo: {
    flex: 1,
  },
  nomeAnimal: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  detalhes: {
    gap: 2,
  },
  detalheTxt: {
    fontSize: 12,
    color: "#666",
  },
  chevron: {
    fontSize: 24,
    color: "#0066cc",
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
  rodape: {
    backgroundColor: "#fff",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    justifyContent: "center",
    alignItems: "center",
  },
  textoRodape: {
    fontSize: 12,
    color: "#666",
  },
});
