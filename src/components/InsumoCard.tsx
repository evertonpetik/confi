import { Feather } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export type Compra = {
  id: string;
  data: string;
  quantidade: number;
  precoKg: number;
};

export type Saida = {
  id: string;
  data: string;
  quantidade: number;
  precoKg: number;
  origem: string;
  roteiroId: string;
  roteiroNumero: number;
};

export type Insumo = {
  id: string;
  nome: string;
  percentualMateriaSeca: number;
  materiaSecaVariavel: boolean;
  compras: Compra[];
  saidas: Saida[];
};

type InsumoCardProps = {
  insumo: Insumo;
  onEdit: (insumo: Insumo) => void;
  onDelete: (insumo: Insumo) => void;
  onCompras: (insumo: Insumo) => void;
};

export function calcularEstoque(compras: Compra[], saidas: Saida[] = []): number {
  const totalCompras = compras.reduce((acc, c) => acc + c.quantidade, 0);
  const totalSaidas = saidas.reduce((acc, s) => acc + s.quantidade, 0);
  return totalCompras - totalSaidas;
}

export function calcularPrecoMedio(compras: Compra[], saidas: Saida[] = []): number {
  // Média Ponderada Móvel: processa compras e saídas em ordem cronológica
  type Evento = { data: string; tipo: "E" | "S"; quantidade: number; precoKg: number };
  const eventos: Evento[] = [
    ...compras.map((c) => ({ data: c.data, tipo: "E" as const, quantidade: c.quantidade, precoKg: c.precoKg })),
    ...saidas.map((s) => ({ data: s.data, tipo: "S" as const, quantidade: s.quantidade, precoKg: s.precoKg })),
  ].sort((a, b) => a.data.localeCompare(b.data));

  let estoque = 0;
  let valorTotal = 0;

  for (const ev of eventos) {
    if (ev.tipo === "E") {
      estoque += ev.quantidade;
      valorTotal += ev.quantidade * ev.precoKg;
    } else {
      if (estoque <= 0) continue;
      const avgMomento = valorTotal / estoque;
      valorTotal -= ev.quantidade * avgMomento;
      estoque -= ev.quantidade;
      if (estoque < 0) { estoque = 0; valorTotal = 0; }
    }
  }

  return estoque > 0 ? valorTotal / estoque : 0;
}

export function InsumoCard({
  insumo,
  onEdit,
  onDelete,
  onCompras,
}: InsumoCardProps) {
  const estoque = calcularEstoque(insumo.compras, insumo.saidas);
  const precoMedio = calcularPrecoMedio(insumo.compras, insumo.saidas);

  return (
    <View style={styles.card}>
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.nome}>{insumo.nome}</Text>
          {insumo.materiaSecaVariavel && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>MS Variável</Text>
            </View>
          )}
        </View>
        <Text style={styles.detalhe}>
          Matéria Seca: {insumo.percentualMateriaSeca}%
        </Text>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Estoque</Text>
            <Text style={styles.statValue}>
              {estoque > 0 ? `${estoque.toLocaleString("pt-BR")} kg` : "-"}
            </Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Preço Médio</Text>
            <Text style={styles.statValue}>
              {precoMedio > 0
                ? `R$ ${precoMedio.toFixed(2).replace(".", ",")}`
                : "-"}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionButton}
          activeOpacity={0.7}
          onPress={() => onCompras(insumo)}
        >
          <Feather name="shopping-cart" size={18} color="#2E7D32" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          activeOpacity={0.7}
          onPress={() => onEdit(insumo)}
        >
          <Feather name="edit-2" size={18} color="#3366FF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          activeOpacity={0.7}
          onPress={() => onDelete(insumo)}
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
  },
  badge: {
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
