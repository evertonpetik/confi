import { Feather } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

export type AbastecimentoItem = {
  id: string;
  data: string;
  hora: string;
  veiculoId: string;
  veiculoNome: string;
  veiculoTipo: string;
  tanqueId: string;
  tanqueNome: string;
  litros: number;
  marcadorAnterior: number;
  marcadorAtual: number;
  consumo: number | null;
  fotoBomba: string;
  fotoPainel: string | null;
  observacao: string;
  criadoOffline: boolean;
  criadoEm: string;
};

type AbastecimentoCardProps = {
  item: AbastecimentoItem;
};

const TIPO_MARCADOR: Record<string, string> = {
  veiculo: "km",
  maquina: "h",
  equipamento: "",
};

export function AbastecimentoCard({ item }: AbastecimentoCardProps) {
  const unit = TIPO_MARCADOR[item.veiculoTipo] ?? "";
  const consumoUnit = item.veiculoTipo === "veiculo" ? "L/km" : "L/h";

  // Format date dd/mm/yyyy
  const [year, month, day] = (item.data ?? "").split("-");
  const dataFormatada = day && month && year ? `${day}/${month}/${year}` : item.data;

  return (
    <View style={styles.card}>
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.nome}>{item.veiculoNome}</Text>
          {item.criadoOffline && (
            <View style={styles.badge}>
              <Feather name="wifi-off" size={10} color="#E65100" />
              <Text style={styles.badgeText}>Offline</Text>
            </View>
          )}
        </View>

        <Text style={styles.detalhe}>
          {dataFormatada} as {item.hora} - {item.tanqueNome}
        </Text>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Litros</Text>
            <Text style={styles.statValue}>
              {item.litros.toLocaleString("pt-BR")} L
            </Text>
          </View>

          {item.veiculoTipo !== "equipamento" && item.marcadorAtual > 0 && (
            <View style={styles.stat}>
              <Text style={styles.statLabel}>
                {item.veiculoTipo === "veiculo" ? "Hodometro" : "Horimetro"}
              </Text>
              <Text style={styles.statValue}>
                {item.marcadorAnterior.toLocaleString("pt-BR")} {"->"}{" "}
                {item.marcadorAtual.toLocaleString("pt-BR")} {unit}
              </Text>
            </View>
          )}

          {item.consumo !== null && item.consumo > 0 && (
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Consumo</Text>
              <Text style={styles.statValue}>
                {item.consumo.toFixed(2)} {consumoUnit}
              </Text>
            </View>
          )}
        </View>

        {!!item.observacao && (
          <Text style={styles.observacao}>{item.observacao}</Text>
        )}
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
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: "#FFF3E0",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#E65100",
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
  observacao: {
    fontSize: 12,
    color: "#666",
    fontStyle: "italic",
    marginTop: 8,
  },
});
