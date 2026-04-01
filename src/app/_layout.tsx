import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

function AuthGate() {
  const { user, userProfile, selectedFazendaId, loading, signOut } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAppGroup = segments[0] === "(app)";
    const onFazendaSelect = segments[0] === "selecao-fazenda";

    if (!user) {
      // Nao autenticado -> login
      if (inAppGroup || onFazendaSelect) {
        router.replace("/");
      }
    } else if (!userProfile) {
      // Autenticado mas sem perfil no Firestore -> manter na tela atual
      // (mostraremos uma tela de "sem acesso" abaixo)
      if (inAppGroup) {
        router.replace("/");
      }
    } else if (!selectedFazendaId) {
      // Autenticado com perfil mas sem fazenda -> selecao
      if (!onFazendaSelect) {
        router.replace("/selecao-fazenda");
      }
    } else {
      // Tudo OK -> app
      if (!inAppGroup) {
        router.replace("/(app)/home");
      }
    }
  }, [user, userProfile, selectedFazendaId, loading, segments]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FDFDFD" }}>
        <ActivityIndicator size="large" color="#3366FF" />
      </View>
    );
  }

  // Usuario autenticado mas sem perfil no Firestore
  if (user && !userProfile) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FDFDFD", padding: 32 }}>
        <Text style={{ fontSize: 20, fontWeight: "700", color: "#1a1a1a", textAlign: "center" }}>
          Sem acesso
        </Text>
        <Text style={{ fontSize: 14, color: "#666", marginTop: 12, textAlign: "center" }}>
          Sua conta ainda nao foi configurada pelo administrador. Entre em contato para obter acesso.
        </Text>
        <TouchableOpacity
          onPress={signOut}
          style={{ marginTop: 24, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: "#3366FF", borderRadius: 8 }}
        >
          <Text style={{ color: "#FFF", fontWeight: "600", fontSize: 16 }}>Voltar ao Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return <Slot />;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
