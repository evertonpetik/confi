import {
  AbastecimentoCard,
  type AbastecimentoItem,
} from "@/components/AbastecimentoCard";
import { DrawerSceneWrapper } from "@/components/drawe-scene-wrapper";
import { DrawerToggleButton } from "@/components/DrawerToggleButton";
import { Select } from "@/components/Select";
import type { Tanque } from "@/components/TanqueCard";
import type { Veiculo } from "@/components/VeiculoCard";
import { useResponsive } from "@/hooks/useResponsive";
import { getCollection } from "@/services/firestoreService";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function HistoricoCombustivel() {
  const {
    isTablet,
    isDesktop,
    maxWidthContent,
    containerPadding,
    titleFontSize,
    headerPaddingTop,
  } = useResponsive();

  const [abastecimentos, setAbastecimentos] = useState<AbastecimentoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [tanques, setTanques] = useState<Tanque[]>([]);

  // Filters
  const [filtroVeiculo, setFiltroVeiculo] = useState("");
  const [filtroTanque, setFiltroTanque] = useState("");

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  async function fetchData() {
    try {
      setLoading(true);
      const [abastSnap, veiculosSnap, tanquesSnap] = await Promise.all([
        getCollection("abastecimentos"),
        getCollection("veiculos"),
        getCollection("tanques"),
      ]);

      const abastData: AbastecimentoItem[] = abastSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as AbastecimentoItem[];

      // Sort by date desc, then hora desc
      abastData.sort((a, b) => {
        const dateComp = (b.data ?? "").localeCompare(a.data ?? "");
        if (dateComp !== 0) return dateComp;
        return (b.hora ?? "").localeCompare(a.hora ?? "");
      });

      setAbastecimentos(abastData);
      setVeiculos(
        veiculosSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Veiculo[]
      );
      setTanques(
        tanquesSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Tanque[]
      );
    } catch (err) {
      console.error("Erro ao buscar historico:", err);
    } finally {
      setLoading(false);
    }
  }

  const filtered = abastecimentos.filter((a) => {
    if (filtroVeiculo && a.veiculoId !== filtroVeiculo) return false;
    if (filtroTanque && a.tanqueId !== filtroTanque) return false;
    return true;
  });

  const totalLitros = filtered.reduce((sum, a) => sum + (a.litros ?? 0), 0);

  const veiculoOptions = [
    { label: "Todos", value: "" },
    ...veiculos.map((v) => ({
      label: v.nome,
      value: v.id,
    })),
  ];

  const tanqueOptions = [
    { label: "Todos", value: "" },
    ...tanques.map((t) => ({
      label: t.nome,
      value: t.id,
    })),
  ];

  return (
    <DrawerSceneWrapper>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.select({ ios: "padding", android: "height" })}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.container,
              { padding: containerPadding },
              isTablet &&
              !isDesktop && {
                maxWidth: maxWidthContent,
                alignSelf: "center" as const,
                width: "100%",
              },
            ]}
          >
            <View style={[styles.header, { paddingTop: headerPaddingTop }]}>
              <Text
                style={[styles.title, { fontSize: titleFontSize, flex: 1 }]}
                numberOfLines={1}
              >
                Historico
              </Text>
              {!isDesktop && <DrawerToggleButton tintColor="#000000" />}
            </View>

            <Text style={styles.subtitle}>
              Historico de abastecimentos de combustivel.
            </Text>

            {/* Summary */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryStat}>
                <Text style={styles.summaryLabel}>Total Litros</Text>
                <Text style={styles.summaryValue}>
                  {totalLitros.toLocaleString("pt-BR")} L
                </Text>
              </View>
              <View style={styles.summaryStat}>
                <Text style={styles.summaryLabel}>Registros</Text>
                <Text style={styles.summaryValue}>{filtered.length}</Text>
              </View>
            </View>

            {/* Filters */}
            <View style={styles.filtersRow}>
              <View style={styles.filterItem}>
                <Text style={styles.filterLabel}>Veiculo</Text>
                <Select
                  placeholder="Todos"
                  value={filtroVeiculo}
                  options={veiculoOptions}
                  onSelect={setFiltroVeiculo}
                />
              </View>
              <View style={styles.filterItem}>
                <Text style={styles.filterLabel}>Tanque</Text>
                <Select
                  placeholder="Todos"
                  value={filtroTanque}
                  options={tanqueOptions}
                  onSelect={setFiltroTanque}
                />
              </View>
            </View>

            {(filtroVeiculo || filtroTanque) && (
              <TouchableOpacity
                style={styles.clearFilters}
                activeOpacity={0.7}
                onPress={() => {
                  setFiltroVeiculo("");
                  setFiltroTanque("");
                }}
              >
                <Feather name="x" size={14} color="#3366FF" />
                <Text style={styles.clearFiltersText}>Limpar filtros</Text>
              </TouchableOpacity>
            )}

            {loading ? (
              <ActivityIndicator
                size="large"
                color="#3366FF"
                style={{ marginTop: 32 }}
              />
            ) : filtered.length === 0 ? (
              <Text style={styles.emptyText}>
                Nenhum abastecimento encontrado.
              </Text>
            ) : (
              <View style={styles.list}>
                {filtered.map((item) => (
                  <AbastecimentoCard key={item.id} item={item} />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </DrawerSceneWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FDFDFD",
    padding: 32,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 40,
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginTop: 8,
  },
  summaryCard: {
    flexDirection: "row",
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    gap: 24,
    justifyContent: "center",
  },
  summaryStat: {
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: 12,
    color: "#999",
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a1a",
    marginTop: 4,
  },
  filtersRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  filterItem: {
    flex: 1,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#444",
    marginBottom: 4,
  },
  clearFilters: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-end",
    marginTop: 8,
  },
  clearFiltersText: {
    fontSize: 13,
    color: "#3366FF",
    fontWeight: "500",
  },
  emptyText: {
    textAlign: "center",
    marginTop: 32,
    fontSize: 16,
    color: "#999",
  },
  list: {
    marginTop: 24,
    gap: 12,
  },
});
