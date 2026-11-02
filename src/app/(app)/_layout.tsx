import { ModuloId, useAuth } from "@/contexts/AuthContext";
import { menuDoModulo, MODULO_LABEL, podeAcessar, primeiraTelaPermitida, telaPorRota } from "@/constants/telas";
import { DrawerProvider, useDrawer } from "@/contexts/DrawerContext";
import { useTheme } from "@/contexts/ThemeContext";
import { WeighingProvider } from "@/contexts/WeighingContext";
import { useResponsive } from "@/hooks/useResponsive";
import { prefetchAllData } from "@/utils/prefetchFirestore";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Slot, usePathname, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { userProfile, selectedFazendaNome, selectedModulo, signOut, clearFazenda, clearModulo } = useAuth();
  const { logoUrl, primaryColor } = useTheme();
  const pathname = usePathname();
  const router = useRouter();

  // Menu do módulo já filtrado pelas telas liberadas no perfil (admin vê tudo)
  const itens = selectedModulo ? menuDoModulo(userProfile, selectedModulo) : [];
  const moduloLabel = selectedModulo ? MODULO_LABEL[selectedModulo] : "";

  return (
    <ScrollView contentContainerStyle={{ flex: 1 }} bounces={false}>
      {/* Logo */}
      {logoUrl && (
        <View style={styles.logoContainer}>
          <Image
            source={{ uri: logoUrl }}
            style={styles.sidebarLogo}
            resizeMode="contain"
          />
        </View>
      )}
      {/* Fazenda header */}
      <View style={styles.header}>
        <Feather name="map-pin" size={16} color={primaryColor} />
        <Text style={styles.fazendaNome} numberOfLines={1}>
          {selectedFazendaNome ?? ""}
        </Text>
      </View>
      <View style={styles.userRow}>
        <Feather name="user" size={14} color={primaryColor} />
        <Text style={[styles.userName, { color: primaryColor }]} numberOfLines={1}>
          {userProfile?.nome ?? ""} ({userProfile?.tipo ?? ""})
        </Text>
      </View>
      {/* Module badge */}
      {moduloLabel ? (
        <View style={styles.moduloBadge}>
          <Text style={[styles.moduloBadgeText, { color: primaryColor }]}>{moduloLabel}</Text>
        </View>
      ) : null}
      <View style={styles.divider} />

      {/* Menu items */}
      {itens.map((item) => {
        const isActive = pathname.includes(item.route);
        const color = isActive ? primaryColor : "#FFFFFF";

        return (
          <TouchableOpacity
            key={item.route}
            activeOpacity={0.7}
            onPress={() => {
              router.replace(`/(app)/${item.route}` as any);
              onNavigate?.();
            }}
            style={styles.drawerItem}
          >
            <Feather name={item.icon} size={20} color={color} />
            <Text style={[styles.drawerItemLabel, { color }]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.divider} />
        <TouchableOpacity
          style={styles.footerButton}
          activeOpacity={0.7}
          onPress={() => {
            clearModulo();
            onNavigate?.();
          }}
        >
          <Feather name="layers" size={18} color={primaryColor} />
          <Text style={[styles.footerText, { color: primaryColor }]}>Trocar Modulo</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.footerButton}
          activeOpacity={0.7}
          onPress={() => {
            clearFazenda();
            onNavigate?.();
          }}
        >
          <Feather name="refresh-cw" size={18} color={primaryColor} />
          <Text style={[styles.footerText, { color: primaryColor }]}>Trocar Fazenda</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.footerButton}
          activeOpacity={0.7}
          onPress={signOut}
        >
          <Feather name="log-out" size={18} color="#E53935" />
          <Text style={[styles.footerText, { color: "#E53935" }]}>Sair</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function MobileDrawer() {
  const { isOpen, close, progress } = useDrawer();
  const { isTablet } = useResponsive();
  const { width: screenWidth } = useWindowDimensions();

  const drawerWidth = isTablet ? 280 : Math.max(screenWidth * 0.65, 220);

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-drawerWidth, 0],
  });

  const overlayOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <>
      {/* Overlay */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            // Em style, não como prop: a prop está depreciada no react-native-web
            pointerEvents: isOpen ? "auto" : "none",
            backgroundColor: "rgba(0,0,0,0.5)",
            opacity: overlayOpacity,
            zIndex: 99,
          },
        ]}
      >
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={close}
        />
      </Animated.View>

      {/* Drawer panel */}
      <Animated.View
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: drawerWidth,
          backgroundColor: "#1D1F25",
          paddingTop: 32,
          transform: [{ translateX }],
          zIndex: 100,
          elevation: 16,
        }}
      >
        <SidebarContent onNavigate={close} />
      </Animated.View>
    </>
  );
}

export default function AppLayout() {
  const { isDesktop } = useResponsive();
  const { selectedFazendaId, selectedModulo, userProfile } = useAuth();
  const { primaryColor } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  // Guarda de rota: quem digita a URL ou segue um atalho para uma tela não
  // liberada no perfil é levado para a primeira tela permitida do módulo.
  useEffect(() => {
    if (!userProfile || !selectedModulo) return;
    const rota = pathname.split("/").filter(Boolean).pop() ?? "";
    if (!telaPorRota(rota)) return;
    if (!podeAcessar(userProfile, rota)) {
      router.replace(`/(app)/${primeiraTelaPermitida(userProfile, selectedModulo)}` as any);
    }
  }, [pathname, userProfile, selectedModulo]);

  useEffect(() => {
    if (selectedFazendaId) {
      checkFirstSync();
    }
  }, [selectedFazendaId]);

  async function checkFirstSync() {
    const syncKey = `@lastSync:${selectedFazendaId}`;
    try {
      const lastSync = await AsyncStorage.getItem(syncKey);
      if (!lastSync) {
        setSyncing(true);
        setChecking(false);
        setSyncMessage("Sincronizando dados para uso offline...");
        await prefetchAllData((msg) => setSyncMessage(msg));
        const now = new Date().toLocaleString("pt-BR");
        await AsyncStorage.setItem(syncKey, now);
        setSyncing(false);
      } else {
        setChecking(false);
      }
    } catch {
      setChecking(false);
      setSyncing(false);
    }
  }

  if (checking) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#FDFDFD",
        }}
      >
        <ActivityIndicator size="large" color={primaryColor} />
      </View>
    );
  }

  if (syncing) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#FDFDFD",
          padding: 32,
        }}
      >
        <ActivityIndicator size="large" color={primaryColor} />
        <Text
          style={{
            marginTop: 16,
            fontSize: 18,
            fontWeight: "700",
            color: "#1a1a1a",
            textAlign: "center",
          }}
        >
          Primeira sincronizacao
        </Text>
        <Text
          style={{
            marginTop: 8,
            fontSize: 14,
            color: "#666",
            textAlign: "center",
          }}
        >
          {syncMessage}
        </Text>
        <Text
          style={{
            marginTop: 16,
            fontSize: 13,
            color: "#999",
            textAlign: "center",
          }}
        >
          Isso acontece apenas na primeira vez. Aguarde...
        </Text>
      </View>
    );
  }

  return (
    <WeighingProvider>
      <DrawerProvider>
        <View style={{ flex: 1, flexDirection: "row" }}>
          {isDesktop && (
            <View
              style={{
                width: 280,
                backgroundColor: "#1D1F25",
                paddingTop: 32,
              }}
            >
              <SidebarContent />
            </View>
          )}
          <View style={{ flex: 1, backgroundColor: "#F5F5F5" }}>
            <Slot />
          </View>
          {!isDesktop && <MobileDrawer />}
        </View>
      </DrawerProvider>
    </WeighingProvider>
  );
}

const styles = StyleSheet.create({
  logoContainer: {
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  sidebarLogo: {
    width: 120,
    height: 50,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  fazendaNome: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    flex: 1,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  userName: {
    fontSize: 12,
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: "#2A2D35",
    marginHorizontal: 16,
    marginVertical: 8,
  },
  moduloBadge: {
    marginHorizontal: 20,
    marginBottom: 4,
    backgroundColor: "#2A2D35",
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: "flex-start",
  },
  moduloBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  drawerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  drawerItemLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  footer: {
    marginTop: "auto",
    paddingBottom: 16,
  },
  footerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  footerText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
