import { useResponsive } from "@/hooks/useResponsive"
import { prefetchAllData } from "@/utils/prefetchFirestore"
import { Feather } from "@expo/vector-icons"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { Drawer } from "expo-router/drawer"
import { useEffect, useState } from "react"
import { ActivityIndicator, Text, View } from "react-native"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { configureReanimatedLogger, ReanimatedLogLevel } from "react-native-reanimated"

configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
})

export default function Layout() {
  const { isTablet } = useResponsive()
  const [checking, setChecking] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState("")

  useEffect(() => {
    checkFirstSync()
  }, [])

  async function checkFirstSync() {
    try {
      const lastSync = await AsyncStorage.getItem("@lastSync")
      if (!lastSync) {
        setSyncing(true)
        setChecking(false)
        setSyncMessage("Sincronizando dados para uso offline...")
        await prefetchAllData((msg) => setSyncMessage(msg))
        const now = new Date().toLocaleString("pt-BR")
        await AsyncStorage.setItem("@lastSync", now)
        setSyncing(false)
      } else {
        setChecking(false)
      }
    } catch {
      setChecking(false)
      setSyncing(false)
    }
  }

  if (checking) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FDFDFD" }}>
        <ActivityIndicator size="large" color="#3366FF" />
      </View>
    )
  }

  if (syncing) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FDFDFD", padding: 32 }}>
        <ActivityIndicator size="large" color="#3366FF" />
        <Text style={{ marginTop: 16, fontSize: 18, fontWeight: "700", color: "#1a1a1a", textAlign: "center" }}>
          Primeira sincronizacao
        </Text>
        <Text style={{ marginTop: 8, fontSize: 14, color: "#666", textAlign: "center" }}>
          {syncMessage}
        </Text>
        <Text style={{ marginTop: 16, fontSize: 13, color: "#999", textAlign: "center" }}>
          Isso acontece apenas na primeira vez. Aguarde...
        </Text>
      </View>
    )
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer
        screenOptions={{

          headerShown: false,
          drawerActiveBackgroundColor: " transparent ",
          drawerInactiveBackgroundColor: " transparent ",
          drawerActiveTintColor: "#727D9B",
          drawerInactiveTintColor: "#FFFFFF",
          drawerHideStatusBarOnOpen: true,
          overlayColor: "transparent",
          drawerStyle: {
            backgroundColor: "#1D1F25",
            paddingTop: 32,
            width: isTablet ? 280 : "50%",
          },
          drawerLabelStyle: {
            marginLeft: 0,
          },
          sceneStyle: {
            backgroundColor: "#1D1F25",
          },
        }}>
        <Drawer.Screen
          name="home"
          options={{
            title: "Home",
            drawerLabel: "Home",
            drawerIcon: ({ color }) => (
              <Feather name="home" size={20} color={color} />
            ),
          }} />
        <Drawer.Screen
          name="produtores"
          options={{
            title: "Produtores",
            drawerLabel: "Produtores",
            drawerIcon: ({ color }) => (
              <Feather name="users" size={20} color={color} />
            ),
          }} />
        <Drawer.Screen
          name="lotes"
          options={{
            title: "Lotes",
            drawerLabel: "Lotes",
            drawerIcon: ({ color }) => (
              <Feather name="trello" size={20} color={color} />
            ),
          }} />
        <Drawer.Screen
          name="leitura"
          options={{
            title: "Leitura de Cocho",
            drawerLabel: "Leitura de Cocho",
            drawerIcon: ({ color }) => (
              <Feather name="trending-up" size={20} color={color} />
            ),
          }} />
        <Drawer.Screen
          name="insumos"
          options={{
            title: "Insumos",
            drawerLabel: "Insumos",
            drawerIcon: ({ color }) => (
              <Feather name="feather" size={20} color={color} />
            ),
          }} />
        <Drawer.Screen
          name="dietas"
          options={{
            title: "Dietas",
            drawerLabel: "Dietas",
            drawerIcon: ({ color }) => (
              <Feather name="clipboard" size={20} color={color} />
            ),
          }} />
        <Drawer.Screen
          name="roteiros"
          options={{
            title: "Roteiros",
            drawerLabel: "Roteiros",
            drawerIcon: ({ color }) => (
              <Feather name="truck" size={20} color={color} />
            ),
          }} />
        <Drawer.Screen
          name="mapa-trato"
          options={{
            title: "Mapa de Trato",
            drawerLabel: "Mapa de Trato",
            drawerIcon: ({ color }) => (
              <Feather name="map" size={20} color={color} />
            ),
          }} />
        <Drawer.Screen
          name="tratador"
          options={{
            title: "Tratador",
            drawerLabel: "Tratador",
            drawerIcon: ({ color }) => (
              <Feather name="play-circle" size={20} color={color} />
            ),
          }} />
        <Drawer.Screen
          name="configuracoes"
          options={{
            title: "Configurações",
            drawerLabel: "Configurações",
            drawerIcon: ({ color }) => (
              <Feather name="settings" size={20} color={color} />
            ),
          }} />
        <Drawer.Screen
          name="signup"
          options={{
            title: "Usuários",
            drawerLabel: "Cadastrar Usuário",
            drawerIcon: ({ color }) => (
              <Feather name="user" size={20} color={color} />
            ),
          }} />
        <Drawer.Screen
          name="index"
          options={{
            title: "Sair",
            drawerLabel: "Sair",
            drawerIcon: ({ color }) => (
              <Feather name="log-out" size={20} color={color} />
            ),
          }} />
      </Drawer>
    </GestureHandlerRootView>
  )
}
