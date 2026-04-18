import { ModuloId, useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useResponsive } from "@/hooks/useResponsive";
import { Feather } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type ModuloInfo = {
  id: ModuloId;
  label: string;
  description: string;
  icon: React.ComponentProps<typeof Feather>["name"];
};

const MODULOS_INFO: ModuloInfo[] = [
  {
    id: "iconfi",
    label: "iConfi",
    description: "Confinamento",
    icon: "grid",
  },
  {
    id: "ifarm",
    label: "iFarm",
    description: "Rebanho e Rastreabilidade",
    icon: "map",
  },
  {
    id: "abastecimento",
    label: "Abastecimento",
    description: "Controle de Combustivel",
    icon: "droplet",
  },
];

export default function SelecaoModulo() {
  const { isTablet, maxWidthAuth, containerPadding, titleFontSize } = useResponsive();
  const { userProfile, selectedFazendaNome, selectModulo, clearFazenda, signOut } = useAuth();
  const { primaryColor } = useTheme();
  const [ready, setReady] = useState(false);

  const isAdmin = userProfile?.tipo === "admin";

  const availableModulos = MODULOS_INFO.filter(
    (m) => isAdmin || (userProfile?.modulos ?? []).includes(m.id)
  );

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 300);
    return () => clearTimeout(t);
  }, []);

  // Auto-selecionar se so tem 1 modulo
  useEffect(() => {
    if (ready && availableModulos.length === 1) {
      selectModulo(availableModulos[0].id);
    }
  }, [ready, availableModulos.length]);

  if (!ready) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={primaryColor} />
      </View>
    );
  }

  // Auto-selecionando
  if (availableModulos.length === 1) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={primaryColor} />
      </View>
    );
  }

  // Sem modulos
  if (availableModulos.length === 0) {
    return (
      <View style={[styles.centered, { padding: 32 }]}>
        <Feather name="alert-circle" size={48} color="#999" />
        <Text style={{ fontSize: 18, fontWeight: "700", color: "#1a1a1a", marginTop: 16, textAlign: "center" }}>
          Sem modulos
        </Text>
        <Text style={{ fontSize: 14, color: "#666", marginTop: 8, textAlign: "center" }}>
          Voce ainda nao tem acesso a nenhum modulo. Entre em contato com o administrador.
        </Text>
        <View style={styles.footerActions}>
          <TouchableOpacity
            style={styles.footerButton}
            activeOpacity={0.7}
            onPress={clearFazenda}
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
          { padding: containerPadding },
          isTablet && {
            maxWidth: maxWidthAuth,
            alignSelf: "center" as const,
            width: "100%",
          },
        ]}
      >
        <Text style={styles.greeting}>
          {selectedFazendaNome ?? ""}
        </Text>
        <Text style={[styles.title, { fontSize: titleFontSize }]}>Selecione o Modulo</Text>
        <Text style={styles.subtitle}>
          Escolha qual modulo deseja acessar.
        </Text>

        <View style={styles.list}>
          {availableModulos.map((m) => (
            <TouchableOpacity
              key={m.id}
              style={styles.card}
              activeOpacity={0.7}
              onPress={() => selectModulo(m.id)}
            >
              <View style={[styles.cardIcon, { backgroundColor: primaryColor + "1A" }]}>
                <Feather name={m.icon} size={24} color={primaryColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{m.label}</Text>
                <Text style={styles.cardDescription}>{m.description}</Text>
              </View>
              <Feather name="chevron-right" size={20} color="#999" />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.footerActions}>
          <TouchableOpacity
            style={styles.footerButton}
            activeOpacity={0.7}
            onPress={clearFazenda}
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
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  cardDescription: {
    fontSize: 13,
    color: "#888",
    marginTop: 2,
  },
  footerActions: {
    marginTop: 32,
    gap: 8,
  },
  footerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
  },
  footerText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
