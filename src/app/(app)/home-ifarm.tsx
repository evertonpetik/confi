import { DrawerSceneWrapper } from "@/components/drawe-scene-wrapper";
import { DrawerToggleButton } from "@/components/DrawerToggleButton";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useResponsive } from "@/hooks/useResponsive";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const MODULES = [
  {
    route: "animais",
    label: "Rebanho",
    icon: "list" as const,
    description: "Cadastro de animais e SISBOV",
    cor: "#4CAF50",
  },
  {
    route: "movimentacoes",
    label: "Movimentações",
    icon: "shuffle" as const,
    description: "Entradas, saídas e GTA",
    cor: "#2196F3",
  },
  {
    route: "pesagem-balanca",
    label: "Pesagem",
    icon: "activity" as const,
    description: "Balança + Leitor RFID (Serial/BLE)",
    cor: "#FF9800",
  },
  {
    route: "sanidade",
    label: "Sanidade",
    icon: "shield" as const,
    description: "Vacinações e vermifugações",
    cor: "#9C27B0",
  },
  {
    route: "consulta-gta",
    label: "Consulta GTA",
    icon: "search" as const,
    description: "Consultar GTA e SISBOV",
    cor: "#607D8B",
  },
];

export default function HomeIFarm() {
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
            isTablet && !isDesktop && {
              maxWidth: maxWidthContent,
              alignSelf: "center" as const,
              width: "100%",
            },
          ]}
        >
          <View style={[styles.header, { paddingTop: headerPaddingTop }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { fontSize: titleFontSize }]} numberOfLines={1}>
                iFarm
              </Text>
              <Text style={styles.subtitle}>
                {selectedFazendaNome ?? ""} · Gestão do Rebanho
              </Text>
            </View>
            {!isDesktop && <DrawerToggleButton tintColor="#000000" />}
          </View>

          {/* Banner SISBOV */}
          <View style={[styles.banner, { backgroundColor: primaryColor + "12", borderColor: primaryColor + "30" }]}>
            <View style={[styles.bannerIcone, { backgroundColor: primaryColor + "20" }]}>
              <Feather name="radio" size={22} color={primaryColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.bannerTitulo, { color: primaryColor }]}>
                Rastreabilidade SISBOV
              </Text>
              <Text style={styles.bannerDesc}>
                Controle individual por chip, conforme normas do MAPA
              </Text>
            </View>
          </View>

          {/* Grid de módulos */}
          <View style={styles.grid}>
            {MODULES.map((mod) => (
              <TouchableOpacity
                key={mod.route}
                style={styles.card}
                activeOpacity={0.75}
                onPress={() => router.push(`/(app)/${mod.route}` as any)}
              >
                <View style={[styles.cardIcone, { backgroundColor: mod.cor + "18" }]}>
                  <Feather name={mod.icon} size={26} color={mod.cor} />
                </View>
                <Text style={styles.cardLabel}>{mod.label}</Text>
                <Text style={styles.cardDesc}>{mod.description}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Nota informativa */}
          <View style={styles.nota}>
            <Feather name="info" size={14} color="#999" />
            <Text style={styles.notaText}>
              Módulo conforme exigências SISBOV/MAPA · Integração com balança ACR e leitor RFID XRS2i via Bluetooth
            </Text>
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
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  title: {
    fontWeight: "900",
    color: "#1a1a1a",
  },
  subtitle: {
    fontSize: 14,
    color: "#888",
    marginTop: 2,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 24,
  },
  bannerIcone: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  bannerTitulo: {
    fontSize: 14,
    fontWeight: "700",
  },
  bannerDesc: {
    fontSize: 12,
    color: "#888",
    marginTop: 2,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  card: {
    width: "47%",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  cardIcone: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  cardLabel: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1a1a1a",
  },
  cardDesc: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
    lineHeight: 16,
  },
  nota: {
    flexDirection: "row",
    gap: 6,
    alignItems: "flex-start",
    marginTop: 28,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  notaText: {
    flex: 1,
    fontSize: 11,
    color: "#bbb",
    lineHeight: 16,
  },
});
