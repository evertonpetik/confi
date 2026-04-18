import { DrawerSceneWrapper } from "@/components/drawe-scene-wrapper";
import { DrawerToggleButton } from "@/components/DrawerToggleButton";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useResponsive } from "@/hooks/useResponsive";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const QUICK_ACCESS = [
  { route: "abastecimento", label: "Novo Abastecimento", icon: "plus-circle" as const, description: "Registrar abastecimento" },
  { route: "tanques", label: "Tanques", icon: "database" as const, description: "Gerenciar tanques" },
  { route: "veiculos", label: "Veiculos", icon: "navigation" as const, description: "Gerenciar veiculos" },
  { route: "historico-combustivel", label: "Historico", icon: "list" as const, description: "Consultar historico" },
];

export default function HomeAbastecimento() {
  const { isTablet, isDesktop, maxWidthContent, containerPadding, titleFontSize, headerPaddingTop } = useResponsive();
  const { selectedFazendaNome } = useAuth();
  const { primaryColor } = useTheme();
  const router = useRouter();

  return (
    <DrawerSceneWrapper>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
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
            <Text style={[styles.title, { fontSize: titleFontSize, flex: 1 }]} numberOfLines={1}>
              Abastecimento
            </Text>
            {!isDesktop && <DrawerToggleButton tintColor="#000000" />}
          </View>
          <Text style={styles.subtitle}>
            {selectedFazendaNome ?? ""} - Controle de Combustivel
          </Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Acesso Rapido</Text>
            <View style={styles.cardGrid}>
              {QUICK_ACCESS.map((item) => (
                <TouchableOpacity
                  key={item.route}
                  style={styles.card}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/(app)/${item.route}` as any)}
                >
                  <View style={[styles.cardIcon, { backgroundColor: primaryColor + "1A" }]}>
                    <Feather name={item.icon} size={24} color={primaryColor} />
                  </View>
                  <Text style={styles.cardTitle}>{item.label}</Text>
                  <Text style={styles.cardDescription}>{item.description}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
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
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
  },
  section: {
    marginTop: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 16,
  },
  cardGrid: {
    gap: 12,
  },
  card: {
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    padding: 20,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  cardDescription: {
    fontSize: 13,
    color: "#888",
    marginTop: 4,
  },
});
