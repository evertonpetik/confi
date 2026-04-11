import { Feather } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export type Produtor = {
  id: string;
  nome: string;
  abreviacao: string;
  fazenda: string;
  cidade: string;
  uf: string;
  inscricaoEstadual: string;
  telefone: string;
  email: string;
  cpfCnpj: string;
};

type ProdutorCardProps = {
  produtor: Produtor;
  onEdit: (produtor: Produtor) => void;
  onDelete: (produtor: Produtor) => void;
};

export function ProdutorCard({ produtor, onEdit, onDelete }: ProdutorCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.content}>
        <Text style={styles.nome}>{produtor.nome || produtor.id}</Text>
        {!!produtor.fazenda && (
          <Text style={styles.fazenda}>{produtor.fazenda}</Text>
        )}
        {!!(produtor.cidade || produtor.uf) && (
          <Text style={styles.localidade}>
            {[produtor.cidade, produtor.uf].filter(Boolean).join(" - ")}
          </Text>
        )}
        {!!produtor.telefone && (
          <Text style={styles.detalhe}>{produtor.telefone}</Text>
        )}
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionButton}
          activeOpacity={0.7}
          onPress={() => onEdit(produtor)}
        >
          <Feather name="edit-2" size={18} color="#3366FF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          activeOpacity={0.7}
          onPress={() => onDelete(produtor)}
        >
          <Feather name="trash-2" size={18} color="#E53935" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  content: {
    flex: 1,
  },
  nome: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
    flexShrink: 1,
  },
  fazenda: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  localidade: {
    fontSize: 13,
    color: "#888",
    marginTop: 2,
  },
  detalhe: {
    fontSize: 13,
    color: "#888",
    marginTop: 2,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
});
