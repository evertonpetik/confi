import { Feather } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export type Veiculo = {
  id: string;
  nome: string;
  placa: string;
  tipo: "veiculo" | "maquina" | "equipamento";
  tipoMarcador: "km" | "horimetro" | "nenhum";
  tipoCombustivel: string;
  marcadorAtual: number;
  ativo: boolean;
};

type VeiculoCardProps = {
  veiculo: Veiculo;
  onEdit: (veiculo: Veiculo) => void;
  onDelete: (veiculo: Veiculo) => void;
  onQRCode: (veiculo: Veiculo) => void;
};

const TIPO_LABELS: Record<string, string> = {
  veiculo: "Veiculo",
  maquina: "Maquina",
  equipamento: "Equipamento",
};

const MARCADOR_UNITS: Record<string, string> = {
  km: "km",
  horimetro: "h",
  nenhum: "",
};

export function VeiculoCard({
  veiculo,
  onEdit,
  onDelete,
  onQRCode,
}: VeiculoCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.nome}>{veiculo.nome}</Text>
          <View style={[styles.badge, styles.badgeTipo]}>
            <Text style={[styles.badgeText, styles.badgeTipoText]}>
              {TIPO_LABELS[veiculo.tipo] ?? veiculo.tipo}
            </Text>
          </View>
          {!veiculo.ativo && (
            <View style={[styles.badge, styles.badgeInativo]}>
              <Text style={[styles.badgeText, styles.badgeInativoText]}>
                Inativo
              </Text>
            </View>
          )}
        </View>

        {!!veiculo.placa && (
          <Text style={styles.detalhe}>Placa: {veiculo.placa}</Text>
        )}
        <Text style={styles.detalhe}>{veiculo.tipoCombustivel}</Text>

        {veiculo.tipoMarcador !== "nenhum" && (
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>
                {veiculo.tipoMarcador === "km" ? "Hodometro" : "Horimetro"}
              </Text>
              <Text style={styles.statValue}>
                {veiculo.marcadorAtual.toLocaleString("pt-BR")}{" "}
                {MARCADOR_UNITS[veiculo.tipoMarcador]}
              </Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionButton}
          activeOpacity={0.7}
          onPress={() => onQRCode(veiculo)}
        >
          <Feather name="maximize" size={18} color="#2E7D32" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          activeOpacity={0.7}
          onPress={() => onEdit(veiculo)}
        >
          <Feather name="edit-2" size={18} color="#3366FF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          activeOpacity={0.7}
          onPress={() => onDelete(veiculo)}
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
  badgeTipo: {
    backgroundColor: "#E8F5E9",
  },
  badgeTipoText: {
    color: "#2E7D32",
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
