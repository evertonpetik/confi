import { Feather } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export type Movimentacao = {
  id: string;
  evento: "Entrada" | "Saida";
  movimentacao: string;
  data: string;
  quantidade: number;
  pesoMedio: number;
  observacao: string;
};

export type Lote = {
  id: string;
  numero: number;
  raca: string;
  categoria: string;
  compensatorio: string;
  implante: string;
  tamanhoCorporal: string;
  produtor: string;
  produtorId: string;
  gmdEstimado: number;
  ativo: boolean;
  dietaId: string;
  dietaNome: string;
  piqueteId: string;
  piqueteNome: string;
  pesoAbate?: number;
  movimentacoes: Movimentacao[];
};

type LoteCardProps = {
  lote: Lote;
  gmdRealDiario: { data: string; gmdReal: number }[];
  onEdit: (lote: Lote) => void;
  onDelete: (lote: Lote) => void;
  onMovimentacoes: (lote: Lote) => void;
  onFaturamento: (lote: Lote) => void;
};

function calcularQuantidadeAtual(movimentacoes: Movimentacao[]): number {
  return movimentacoes.reduce((acc, m) => {
    return m.evento === "Entrada" ? acc + m.quantidade : acc - m.quantidade;
  }, 0);
}

function calcularPesoMedio(
  movimentacoes: Movimentacao[],
  gmdEstimado: number
): number {
  const qtdAtual = calcularQuantidadeAtual(movimentacoes);
  if (qtdAtual <= 0) return 0;

  const hoje = new Date();
  let pesoTotal = 0;

  for (const m of movimentacoes) {
    const dataMovimentacao = new Date(m.data + "T00:00:00");
    const diffMs = hoje.getTime() - dataMovimentacao.getTime();
    const dias = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    const pesoAjustado = m.pesoMedio + gmdEstimado * dias;

    if (m.evento === "Entrada") {
      pesoTotal += m.quantidade * pesoAjustado;
    } else {
      pesoTotal -= m.quantidade * pesoAjustado;
    }
  }

  return pesoTotal / qtdAtual;
}

function calcularPesoMedioInicial(movimentacoes: Movimentacao[]): number {
  const entradas = movimentacoes.filter((m) => m.evento === "Entrada");
  if (entradas.length === 0) return 0;
  const totalAnimais = entradas.reduce((acc, m) => acc + m.quantidade, 0);
  if (totalAnimais <= 0) return 0;
  const pesoTotal = entradas.reduce((acc, m) => acc + m.quantidade * m.pesoMedio, 0);
  return pesoTotal / totalAnimais;
}

export { calcularPesoMedio, calcularPesoMedioInicial, calcularQuantidadeAtual };

export function LoteCard({ lote, gmdRealDiario, onEdit, onDelete, onMovimentacoes, onFaturamento }: LoteCardProps) {
  const qtdAtual = calcularQuantidadeAtual(lote.movimentacoes);
  const pesoMedio = calcularPesoMedio(lote.movimentacoes, lote.gmdEstimado);
  const pesoMedioInicial = calcularPesoMedioInicial(lote.movimentacoes);

  // GMD Real medio and Peso Real
  const gmdRealMedio = gmdRealDiario.length > 0
    ? gmdRealDiario.reduce((acc, g) => acc + g.gmdReal, 0) / gmdRealDiario.length
    : null;

  // Peso Real = peso medio inicial + soma dos GMD reais diarios
  const pesoReal = gmdRealDiario.length > 0
    ? pesoMedioInicial + gmdRealDiario.reduce((acc, g) => acc + g.gmdReal, 0)
    : null;

  return (
    <View style={styles.card}>
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.numero}>Lote {lote.numero}</Text>
          <View
            style={[
              styles.badge,
              lote.ativo ? styles.badgeAtivo : styles.badgeInativo,
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                lote.ativo ? styles.badgeTextAtivo : styles.badgeTextInativo,
              ]}
            >
              {lote.ativo ? "Ativo" : "Inativo"}
            </Text>
          </View>
        </View>
        {!!lote.raca && (
          <Text style={styles.detalhe}>
            {lote.raca} - {lote.categoria}
          </Text>
        )}
        {!!lote.produtor && (
          <Text style={styles.detalhe}>{lote.produtor}</Text>
        )}
        {!!lote.dietaNome && (
          <Text style={styles.detalhe}>Dieta: {lote.dietaNome}</Text>
        )}
        {!!lote.piqueteNome && (
          <Text style={styles.detalhe}>Piquete: {lote.piqueteNome}</Text>
        )}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Animais</Text>
            <Text style={styles.statValue}>{qtdAtual}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>KG Inicial</Text>
            <Text style={styles.statValue}>
              {pesoMedioInicial > 0 ? `${pesoMedioInicial.toFixed(1)} kg` : "-"}
            </Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>KG Previsto</Text>
            <Text style={styles.statValue}>
              {pesoMedio > 0 ? `${pesoMedio.toFixed(1)} kg` : "-"}
            </Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>GMD Est.</Text>
            <Text style={styles.statValue}>{lote.gmdEstimado} kg</Text>
          </View>
        </View>
        {(pesoReal !== null || gmdRealMedio !== null) && (
          <View style={styles.statsRow}>
            {pesoReal !== null && (
              <View style={styles.stat}>
                <Text style={styles.statLabel}>KG Real</Text>
                <Text style={[styles.statValue, styles.statValueReal]}>
                  {pesoReal.toFixed(1)} kg
                </Text>
              </View>
            )}
            {gmdRealMedio !== null && (
              <View style={styles.stat}>
                <Text style={styles.statLabel}>GMD Real</Text>
                <Text style={[styles.statValue, styles.statValueReal]}>
                  {gmdRealMedio.toFixed(3)} kg
                </Text>
              </View>
            )}
            {gmdRealDiario.length > 0 && (
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Dias</Text>
                <Text style={styles.statValue}>{gmdRealDiario.length}</Text>
              </View>
            )}
          </View>
        )}
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionButton}
          activeOpacity={0.7}
          onPress={() => onFaturamento(lote)}
        >
          <Feather name="dollar-sign" size={18} color="#FF9800" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          activeOpacity={0.7}
          onPress={() => onMovimentacoes(lote)}
        >
          <Feather name="activity" size={18} color="#2E7D32" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          activeOpacity={0.7}
          onPress={() => onEdit(lote)}
        >
          <Feather name="edit-2" size={18} color="#3366FF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          activeOpacity={0.7}
          onPress={() => onDelete(lote)}
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
  statValueReal: {
    color: "#3366FF",
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
