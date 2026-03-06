import { DrawerSceneWrapper } from "@/components/drawe-scene-wrapper";
import { Movimentacao } from "@/components/LoteCard";
import { useResponsive } from "@/hooks/useResponsive";
import { Feather } from "@expo/vector-icons";
import { DrawerToggleButton } from "@react-navigation/drawer";
import { useFocusEffect } from "@react-navigation/native";
import { collection, getDocs } from "firebase/firestore";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { db } from "../../firebaseConfig";

export default function Home() {
  const { isTablet, isDesktop, maxWidthContent } = useResponsive();
  const [lotesAtivos, setLotesAtivos] = useState(0);
  const [totalAnimais, setTotalAnimais] = useState(0);
  const [totalMortes, setTotalMortes] = useState(0);
  const [totalVendas, setTotalVendas] = useState(0);
  const [totalEntradas, setTotalEntradas] = useState(0);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      fetchDashboard();
    }, [])
  );

  async function fetchDashboard() {
    try {
      setLoading(true);
      const lotesSnap = await getDocs(collection(db, "lotes"));
      let ativos = 0;
      let animais = 0;
      let mortes = 0;
      let vendas = 0;
      let entradas = 0;

      for (const loteDoc of lotesSnap.docs) {
        const loteData = loteDoc.data();
        if (loteData.ativo !== true) continue;
        ativos++;

        const movSnap = await getDocs(
          collection(db, "lotes", loteDoc.id, "movimentacoes")
        );
        for (const movDoc of movSnap.docs) {
          const mov = movDoc.data() as Movimentacao;
          if (mov.evento === "Entrada") {
            animais += mov.quantidade;
            entradas += mov.quantidade;
          } else {
            animais -= mov.quantidade;
            if (mov.movimentacao === "Morte") {
              mortes += mov.quantidade;
            }
            if (mov.movimentacao === "Venda") {
              vendas += mov.quantidade;
            }
          }
        }
      }

      setLotesAtivos(ativos);
      setTotalAnimais(animais);
      setTotalMortes(mortes);
      setTotalVendas(vendas);
      setTotalEntradas(entradas);
    } catch (error) {
      console.error("Erro ao buscar dashboard:", error);
    } finally {
      setLoading(false);
    }
  }

  const cardBasis = isDesktop ? ("30%" as const) : ("47%" as const);

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
          <View style={[styles.container, isTablet && { maxWidth: maxWidthContent, alignSelf: "center" as const, width: "100%" }]}>
            <View style={styles.header}>
              <Text style={styles.title}>Dashboard</Text>
              <DrawerToggleButton tintColor="#000000" />
            </View>

            <Text style={styles.subtitle}>
              Visão geral do seu confinamento.
            </Text>

            {loading ? (
              <ActivityIndicator
                size="large"
                color="#3366FF"
                style={{ marginTop: 48 }}
              />
            ) : (
              <View style={styles.cardsContainer}>
                <View style={[styles.card, styles.cardBlue, { flexBasis: cardBasis }]}>
                  <View style={styles.cardIcon}>
                    <Feather name="layers" size={24} color="#3366FF" />
                  </View>
                  <Text style={styles.cardValue}>{lotesAtivos}</Text>
                  <Text style={styles.cardLabel}>Lotes Ativos</Text>
                </View>

                <View style={[styles.card, styles.cardGreen, { flexBasis: cardBasis }]}>
                  <View style={styles.cardIcon}>
                    <Feather name="bar-chart-2" size={24} color="#2E7D32" />
                  </View>
                  <Text style={styles.cardValue}>{totalAnimais}</Text>
                  <Text style={styles.cardLabel}>Total de Animais</Text>
                </View>

                <View style={[styles.card, styles.cardTeal, { flexBasis: cardBasis }]}>
                  <View style={styles.cardIcon}>
                    <Feather name="log-in" size={24} color="#00796B" />
                  </View>
                  <Text style={styles.cardValue}>{totalEntradas}</Text>
                  <Text style={styles.cardLabel}>Entradas</Text>
                </View>

                <View style={[styles.card, styles.cardOrange, { flexBasis: cardBasis }]}>
                  <View style={styles.cardIcon}>
                    <Feather name="dollar-sign" size={24} color="#E65100" />
                  </View>
                  <Text style={styles.cardValue}>{totalVendas}</Text>
                  <Text style={styles.cardLabel}>Vendas</Text>
                </View>

                <View style={[styles.card, styles.cardRed, { flexBasis: cardBasis }]}>
                  <View style={styles.cardIcon}>
                    <Feather name="alert-triangle" size={24} color="#C62828" />
                  </View>
                  <Text style={styles.cardValue}>{totalMortes}</Text>
                  <Text style={styles.cardLabel}>Mortes</Text>
                </View>
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
  cardsContainer: {
    marginTop: 32,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  card: {
    flexGrow: 1,
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    minWidth: 140,
  },
  cardBlue: {
    backgroundColor: "#EEF2FF",
  },
  cardGreen: {
    backgroundColor: "#E8F5E9",
  },
  cardRed: {
    backgroundColor: "#FFEBEE",
  },
  cardTeal: {
    backgroundColor: "#E0F2F1",
  },
  cardOrange: {
    backgroundColor: "#FFF3E0",
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  cardValue: {
    fontSize: 32,
    fontWeight: "900",
    color: "#1a1a1a",
  },
  cardLabel: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
    textAlign: "center",
  },
});
