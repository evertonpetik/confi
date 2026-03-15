import { useResponsive } from "@/hooks/useResponsive"
import { Feather } from "@expo/vector-icons"
import { Drawer } from "expo-router/drawer"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { configureReanimatedLogger, ReanimatedLogLevel } from "react-native-reanimated"

configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
})

export default function Layout() {
  const { isTablet } = useResponsive()

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
