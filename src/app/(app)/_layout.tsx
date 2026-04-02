import { useAuth } from "@/contexts/AuthContext";
import { useResponsive } from "@/hooks/useResponsive";
import { prefetchAllData } from "@/utils/prefetchFirestore";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DrawerContentComponentProps,
  DrawerContentScrollView,
  DrawerItemList,
} from "@react-navigation/drawer";
import { DrawerActions } from "@react-navigation/native";
import { useNavigation } from "expo-router";
import { Drawer } from "expo-router/drawer";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  configureReanimatedLogger,
  ReanimatedLogLevel,
} from "react-native-reanimated";

configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { userProfile, selectedFazendaNome, signOut, clearFazenda } = useAuth();

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={{ flex: 1 }}>
      {/* Fazenda header */}
      <View style={drawerStyles.header}>
        <Feather name="map-pin" size={16} color="#727D9B" />
        <Text style={drawerStyles.fazendaNome} numberOfLines={1}>
          {selectedFazendaNome ?? ""}
        </Text>
      </View>
      <View style={drawerStyles.userRow}>
        <Feather name="user" size={14} color="#727D9B" />
        <Text style={drawerStyles.userName} numberOfLines={1}>
          {userProfile?.nome ?? ""} ({userProfile?.tipo ?? ""})
        </Text>
      </View>
      <View style={drawerStyles.divider} />

      {/* Drawer items */}
      <DrawerItemList {...props} />

      {/* Footer actions */}
      <View style={drawerStyles.footer}>
        <View style={drawerStyles.divider} />
        <TouchableOpacity
          style={drawerStyles.footerButton}
          activeOpacity={0.7}
          onPress={clearFazenda}
        >
          <Feather name="refresh-cw" size={18} color="#727D9B" />
          <Text style={drawerStyles.footerText}>Trocar Fazenda</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={drawerStyles.footerButton}
          activeOpacity={0.7}
          onPress={signOut}
        >
          <Feather name="log-out" size={18} color="#E53935" />
          <Text style={[drawerStyles.footerText, { color: "#E53935" }]}>
            Sair
          </Text>
        </TouchableOpacity>
      </View>
    </DrawerContentScrollView>
  );
}

const drawerStyles = StyleSheet.create({
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
    color: "#727D9B",
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: "#2A2D35",
    marginHorizontal: 16,
    marginVertical: 8,
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
    color: "#727D9B",
  },
});

export default function AppLayout() {
  const { isTablet, isDesktop } = useResponsive();
  const { userProfile, selectedFazendaId, selectedFazendaNome } = useAuth();
  const navigation = useNavigation();
  const [checking, setChecking] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const didForceClose = useRef(false);

  const isAdmin = userProfile?.tipo === "admin";

  // Força o drawer a fechar no mount em dispositivos móveis
  useEffect(() => {
    if (!isDesktop && !checking && !syncing && !didForceClose.current) {
      didForceClose.current = true;
      const timer = setTimeout(() => {
        navigation.dispatch(DrawerActions.closeDrawer());
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isDesktop, checking, syncing]);

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
        <ActivityIndicator size="large" color="#3366FF" />
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
        <ActivityIndicator size="large" color="#3366FF" />
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
    <Drawer
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      defaultStatus={isDesktop ? "open" : "closed"}
      screenOptions={{
        headerShown: false,
        drawerActiveBackgroundColor: " transparent ",
        drawerInactiveBackgroundColor: " transparent ",
        drawerActiveTintColor: "#727D9B",
        drawerInactiveTintColor: "#FFFFFF",
        overlayColor: isDesktop ? "transparent" : "rgba(0,0,0,0.5)",
        drawerType: isDesktop ? "permanent" : "front",
        drawerStyle: {
          backgroundColor: "#1D1F25",
          paddingTop: 32,
          width: isDesktop ? 280 : isTablet ? 280 : "50%",
          borderRightWidth: isDesktop ? 0 : undefined,
          position: isDesktop ? "relative" : undefined,
          height: "100%",
        },
        drawerLabelStyle: {
          marginLeft: 0,
        },
        sceneStyle: {
          backgroundColor: "#1D1F25",
          minHeight: "100%",
        },
      }}
    >
      <Drawer.Screen
        name="home"
        options={{
          title: selectedFazendaNome ?? "Home",
          drawerLabel: "Home",
          drawerIcon: ({ color }) => (
            <Feather name="home" size={20} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="produtores"
        options={{
          title: "Produtores",
          drawerLabel: "Produtores",
          drawerIcon: ({ color }) => (
            <Feather name="users" size={20} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="lotes"
        options={{
          title: "Lotes",
          drawerLabel: "Lotes",
          drawerIcon: ({ color }) => (
            <Feather name="trello" size={20} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="leitura"
        options={{
          title: "Leitura de Cocho",
          drawerLabel: "Leitura de Cocho",
          drawerIcon: ({ color }) => (
            <Feather name="trending-up" size={20} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="insumos"
        options={{
          title: "Insumos",
          drawerLabel: "Insumos",
          drawerIcon: ({ color }) => (
            <Feather name="feather" size={20} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="dietas"
        options={{
          title: "Dietas",
          drawerLabel: "Dietas",
          drawerIcon: ({ color }) => (
            <Feather name="clipboard" size={20} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="roteiros"
        options={{
          title: "Roteiros",
          drawerLabel: "Roteiros",
          drawerIcon: ({ color }) => (
            <Feather name="truck" size={20} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="mapa-trato"
        options={{
          title: "Mapa de Trato",
          drawerLabel: "Mapa de Trato",
          drawerIcon: ({ color }) => (
            <Feather name="map" size={20} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="tratador"
        options={{
          title: "Tratador",
          drawerLabel: "Tratador",
          drawerIcon: ({ color }) => (
            <Feather name="play-circle" size={20} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="configuracoes"
        options={{
          title: "Configuracoes",
          drawerLabel: "Configuracoes",
          drawerIcon: ({ color }) => (
            <Feather name="settings" size={20} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="signup"
        options={{
          title: "Usuarios",
          drawerLabel: "Usuarios",
          drawerIcon: ({ color }) => (
            <Feather name="user-plus" size={20} color={color} />
          ),
          drawerItemStyle: isAdmin ? undefined : { display: "none" },
        }}
      />
    </Drawer>
  );
}
