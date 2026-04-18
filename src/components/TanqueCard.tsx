import { useTheme } from "@/contexts/ThemeContext";
import { Feather } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export type Tanque = {
  id: string;
  nome: string;
  tipoCombustivel: string;
  capacidadeLitros: number;
  localizacao: "fixo" | "movel";
  nivelAtual: number;
  alertaNivelMinimo: number;
  ativo: boolean;
};

type TanqueCardProps = {
  tanque: Tanque;
  onEdit: (tanque: Tanque) => void;
  onDelete: (tanque: Tanque) => void;
};

export function TanqueCard({ tanque, onEdit, onDelete }: TanqueCardProps) {
  const { primaryColor } = useTheme();
  const percentual =
    tanque.capacidadeLitros > 0
      ? (tanque.nivelAtual / tanque.capacidadeLitros) * 100
      : 0;
  const alertaBaixo = tanque.nivelAtual <= tanque.alertaNivelMinimo;

  return (
    <View style={styles.card}>
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.nome}>{tanque.nome}</Text>
          <View
            style={[
              styles.badge,
              tanque.localizacao === "movel"
                ? styles.badgeMovel
                : styles.badgeFixo,
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                tanque.localizacao === "movel"
                  ? styles.badgeMovelText
                  : styles.badgeFixoText,
              ]}
            >
              {tanque.localizacao === "movel" ? "Movel" : "Fixo"}
            </Text>
          </View>
          {!tanque.ativo && (
            <View style={[styles.badge, styles.badgeInativo]}>
              <Text style={[styles.badgeText, styles.badgeInativoText]}>
                Inativo
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.detalhe}>{tanque.tipoCombustivel}</Text>

        {/* Barra de nivel */}
        <View style={styles.nivelContainer}>
          <View style={styles.nivelBar}>
            <View
              style={[
                styles.nivelFill,
                {
                  width: `${Math.min(percentual, 100)}%`,
                  backgroundColor: alertaBaixo ? "#E53935" : "#2E7D32",
                },
              ]}
            />
          </View>
          <Text
            style={[styles.nivelText, alertaBaixo && { color: "#E53935" }]}
          >
            {tanque.nivelAtual.toLocaleString("pt-BR")} /{" "}
            {tanque.capacidadeLitros.toLocaleString("pt-BR")} L (
            {percentual.toFixed(0)}%)
          </Text>
        </View>

        {alertaBaixo && (
          <View style={styles.alertaRow}>
            <Feather name="alert-triangle" size={14} color="#E53935" />
            <Text style={styles.alertaText}>Nivel abaixo do minimo!</Text>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionButton}
          activeOpacity={0.7}
          onPress={() => onEdit(tanque)}
        >
          <Feather name="edit-2" size={18} color={primaryColor} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          activeOpacity={0.7}
          onPress={() => onDelete(tanque)}
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
    flexWrap: "wrap",
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
  badgeFixo: {
    backgroundColor: "#E3F2FD",
  },
  badgeFixoText: {
    color: "#1565C0",
  },
  badgeMovel: {
    backgroundColor: "#FFF3E0",
  },
  badgeMovelText: {
    color: "#E65100",
  },
  badgeInativo: {
    backgroundColor: "#F5F5F5",
    borderWidth: 1,
    borderColor: "#DCDCDC",
  },
  badgeInativoText: {
    color: "#999",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  detalhe: {
    fontSize: 13,
    color: "#888",
    marginTop: 2,
  },
  nivelContainer: {
    marginTop: 10,
  },
  nivelBar: {
    height: 8,
    backgroundColor: "#E0E0E0",
    borderRadius: 4,
    overflow: "hidden",
  },
  nivelFill: {
    height: "100%",
    borderRadius: 4,
  },
  nivelText: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  alertaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  alertaText: {
    fontSize: 12,
    color: "#E53935",
    fontWeight: "600",
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
