import { Feather } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export type RoteiroPiquete = {
  piqueteId: string;
  piqueteNome: string;
};

export type Roteiro = {
  id: string;
  numero: number;
  dietaId: string;
  dietaNome: string;
  piquetes: RoteiroPiquete[];
  minTratos: number;
  ativo: boolean;
};

type RoteiroCardProps = {
  roteiro: Roteiro;
  onEdit: (roteiro: Roteiro) => void;
  onDelete: (roteiro: Roteiro) => void;
};

export function RoteiroCard({ roteiro, onEdit, onDelete }: RoteiroCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.numero}>Roteiro {roteiro.numero}</Text>
          <View
            style={[
              styles.badge,
              roteiro.ativo ? styles.badgeAtivo : styles.badgeInativo,
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                roteiro.ativo ? styles.badgeTextAtivo : styles.badgeTextInativo,
              ]}
            >
              {roteiro.ativo ? "Ativo" : "Inativo"}
            </Text>
          </View>
        </View>
        {!!roteiro.dietaNome && (
          <Text style={styles.detalhe}>Dieta: {roteiro.dietaNome}</Text>
        )}
        {roteiro.piquetes.length > 0 && (
          <Text style={styles.detalhe}>
            Piquetes: {roteiro.piquetes.map((p) => p.piqueteNome).join(", ")}
          </Text>
        )}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Piquetes</Text>
            <Text style={styles.statValue}>{roteiro.piquetes.length}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Min. Tratos</Text>
            <Text style={styles.statValue}>{roteiro.minTratos ?? 1}</Text>
          </View>
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionButton}
          activeOpacity={0.7}
          onPress={() => onEdit(roteiro)}
        >
          <Feather name="edit-2" size={18} color="#3366FF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          activeOpacity={0.7}
          onPress={() => onDelete(roteiro)}
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
    alignItems: "flex-start",
  },
  content: {
    flex: 1,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  numero: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeAtivo: {
    backgroundColor: "#E8F5E9",
  },
  badgeInativo: {
    backgroundColor: "#FFEBEE",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  badgeTextAtivo: {
    color: "#2E7D32",
  },
  badgeTextInativo: {
    color: "#C62828",
  },
  detalhe: {
    fontSize: 13,
    color: "#888",
    marginTop: 2,
  },
  statsRow: {
    flexDirection: "row",
    marginTop: 8,
    gap: 16,
  },
  stat: {
    alignItems: "center",
  },
  statLabel: {
    fontSize: 11,
    color: "#999",
  },
  statValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  actions: {
    flexDirection: "column",
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
