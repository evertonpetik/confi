import { useTheme } from "@/contexts/ThemeContext";
import { Feather } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export type DietaInsumo = {
  insumoId: string;
  insumoNome: string;
  percentual: number;
};

export type Dieta = {
  id: string;
  nome: string;
  insumos: DietaInsumo[];
  percentualMS: number;
  ndt: number;
  aditivoId: string;
  aditivoNome: string;
  ativo: boolean;
};

type DietaCardProps = {
  dieta: Dieta;
  custoKgMS: number;
  onEdit: (dieta: Dieta) => void;
  onDelete: (dieta: Dieta) => void;
};

export function DietaCard({
  dieta,
  custoKgMS,
  onEdit,
  onDelete,
}: DietaCardProps) {
  const { primaryColor } = useTheme();
  return (
    <View style={styles.card}>
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.nome}>{dieta.nome}</Text>
          <View
            style={[
              styles.badge,
              dieta.ativo ? styles.badgeAtivo : styles.badgeInativo,
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                dieta.ativo ? styles.badgeTextAtivo : styles.badgeTextInativo,
              ]}
            >
              {dieta.ativo ? "Ativa" : "Inativa"}
            </Text>
          </View>
        </View>
        {!!dieta.aditivoNome && (
          <Text style={styles.detalhe}>Aditivo: {dieta.aditivoNome}</Text>
        )}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>NDT</Text>
            <Text style={styles.statValue}>
              {dieta.ndt > 0 ? `${dieta.ndt}%` : "-"}
            </Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Custo/kg MS</Text>
            <Text style={styles.statValue}>
              {custoKgMS > 0
                ? `R$ ${custoKgMS.toFixed(2).replace(".", ",")}`
                : "-"}
            </Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Insumos</Text>
            <Text style={styles.statValue}>{dieta.insumos.length}</Text>
          </View>
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionButton}
          activeOpacity={0.7}
          onPress={() => onEdit(dieta)}
        >
          <Feather name="edit-2" size={18} color={primaryColor} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          activeOpacity={0.7}
          onPress={() => onDelete(dieta)}
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
  nome: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
    flexShrink: 1,
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
    flexWrap: "wrap",
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
