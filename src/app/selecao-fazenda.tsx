import { useAuth } from "@/contexts/AuthContext";
import { useResponsive } from "@/hooks/useResponsive";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { addRawDocument, setCurrentFazendaId } from "@/services/firestoreService";
import { seedTabelasAuxiliares } from "@/utils/seedTabelasAuxiliares";
import { Feather } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function SelecaoFazenda() {
  const { isTablet, maxWidthAuth } = useResponsive();
  const { fazendas, selectFazenda, signOut, userProfile, loading: authLoading } = useAuth();
  const [ready, setReady] = useState(false);
  const [novaFazendaNome, setNovaFazendaNome] = useState("");
  const [criando, setCriando] = useState(false);

  // Dar tempo para o AuthContext carregar fazendas
  useEffect(() => {
    if (!authLoading) {
      // Pequeno delay para garantir que fazendas foram carregadas
      const t = setTimeout(() => setReady(true), 500);
      return () => clearTimeout(t);
    }
  }, [authLoading]);

  // Auto-selecionar se so tem 1 fazenda
  useEffect(() => {
    if (ready && fazendas.length === 1) {
      selectFazenda(fazendas[0].id, fazendas[0].nome);
    }
  }, [fazendas, ready]);

  const isAdmin = userProfile?.tipo === "admin";

  async function handleCriarFazenda() {
    if (!novaFazendaNome.trim()) {
      Alert.alert("Atencao", "Preencha o nome da fazenda.");
      return;
    }
    setCriando(true);
    try {
      const docRef = await addRawDocument(["fazendas"], {
        nome: novaFazendaNome.trim(),
      });
      // Setar fazendaId para que o seed use o path correto
      setCurrentFazendaId(docRef.id);
      await seedTabelasAuxiliares();
      // Selecionar a fazenda recem-criada diretamente
      selectFazenda(docRef.id, novaFazendaNome.trim());
    } catch (error) {
      console.error("Erro ao criar fazenda:", error);
      Alert.alert("Erro", "Nao foi possivel criar a fazenda.");
    } finally {
      setCriando(false);
    }
  }

  // Ainda carregando auth ou aguardando fazendas
  if (!ready) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3366FF" />
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>
    );
  }

  // Nenhuma fazenda existe e usuario e admin -> oferecer criar
  if (fazendas.length === 0 && isAdmin) {
    return (
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.container,
            isTablet && {
              maxWidth: maxWidthAuth,
              alignSelf: "center" as const,
              width: "100%",
            },
          ]}
        >
          <Text style={styles.greeting}>
            Ola, {userProfile?.nome ?? ""}
          </Text>
          <Text style={styles.title}>Criar Fazenda</Text>
          <Text style={styles.subtitle}>
            Nenhuma fazenda cadastrada. Crie a primeira para comecar.
          </Text>

          <View style={styles.formSection}>
            <Input
              placeholder="Nome da fazenda"
              value={novaFazendaNome}
              onChangeText={setNovaFazendaNome}
            />
            <View style={{ marginTop: 12 }}>
              {criando ? (
                <ActivityIndicator size="large" color="#3366FF" />
              ) : (
                <Button label="Criar Fazenda" onPress={handleCriarFazenda} />
              )}
            </View>
          </View>

          <TouchableOpacity
            style={styles.logoutButton}
            activeOpacity={0.7}
            onPress={signOut}
          >
            <Feather name="log-out" size={18} color="#E53935" />
            <Text style={styles.logoutText}>Sair</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // Nenhuma fazenda e nao e admin
  if (fazendas.length === 0) {
    return (
      <View style={[styles.centered, { padding: 32 }]}>
        <Feather name="alert-circle" size={48} color="#999" />
        <Text style={{ fontSize: 18, fontWeight: "700", color: "#1a1a1a", marginTop: 16, textAlign: "center" }}>
          Sem fazendas
        </Text>
        <Text style={{ fontSize: 14, color: "#666", marginTop: 8, textAlign: "center" }}>
          Voce ainda nao tem acesso a nenhuma fazenda. Entre em contato com o administrador.
        </Text>
        <TouchableOpacity
          style={styles.logoutButton}
          activeOpacity={0.7}
          onPress={signOut}
        >
          <Feather name="log-out" size={18} color="#E53935" />
          <Text style={styles.logoutText}>Sair</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Se so tem 1, mostrar loading enquanto auto-seleciona
  if (fazendas.length === 1) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3366FF" />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View
        style={[
          styles.container,
          isTablet && {
            maxWidth: maxWidthAuth,
            alignSelf: "center" as const,
            width: "100%",
          },
        ]}
      >
        <Text style={styles.greeting}>
          Ola, {userProfile?.nome ?? ""}
        </Text>
        <Text style={styles.title}>Selecione a Fazenda</Text>
        <Text style={styles.subtitle}>
          Escolha em qual fazenda deseja trabalhar.
        </Text>

        <View style={styles.list}>
          {fazendas.map((f) => (
            <TouchableOpacity
              key={f.id}
              style={styles.card}
              activeOpacity={0.7}
              onPress={() => selectFazenda(f.id, f.nome)}
            >
              <View style={styles.cardIcon}>
                <Feather name="map-pin" size={24} color="#3366FF" />
              </View>
              <Text style={styles.cardText}>{f.nome}</Text>
              <Feather name="chevron-right" size={20} color="#999" />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={styles.logoutButton}
          activeOpacity={0.7}
          onPress={signOut}
        >
          <Feather name="log-out" size={18} color="#E53935" />
          <Text style={styles.logoutText}>Sair</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FDFDFD",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: "#666",
  },
  container: {
    flex: 1,
    backgroundColor: "#FDFDFD",
    padding: 32,
  },
  greeting: {
    fontSize: 16,
    color: "#666",
    marginTop: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    marginTop: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginTop: 8,
  },
  formSection: {
    marginTop: 32,
    gap: 12,
  },
  list: {
    marginTop: 32,
    gap: 12,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  cardText: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 32,
    paddingVertical: 12,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#E53935",
  },
});
