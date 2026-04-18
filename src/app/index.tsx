import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useResponsive } from "@/hooks/useResponsive";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";

export default function Index() {
  const { isTablet, isSmallPhone, maxWidthAuth, containerPadding, titleFontSize } = useResponsive();
  const { signIn } = useAuth();
  const { primaryColor, logoUrl } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSignIn() {
    if (!email.trim() || !password.trim()) {
      setError("Preencha e-mail e senha.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (err: any) {
      const code = err?.code ?? "";
      if (code === "auth/user-not-found" || code === "auth/wrong-password" || code === "auth/invalid-credential") {
        setError("E-mail ou senha incorretos.");
      } else if (code === "auth/too-many-requests") {
        setError("Muitas tentativas. Tente novamente mais tarde.");
      } else {
        setError("Erro ao fazer login. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.select({ ios: "padding", android: "height" })}
    >
      <ScrollView
        contentContainerStyle={[{ flexGrow: 1 }, isTablet && styles.scrollWide]}
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
          {logoUrl && (
            <Image
              source={{ uri: logoUrl }}
              resizeMode="contain"
              style={[styles.logo, isTablet && styles.logoWide]}
            />
          )}
          <Image
            source={require("@/assets/img1.png")}
            resizeMode="contain"
            style={[styles.illustration, isTablet && styles.illustrationWide, isSmallPhone && { height: 220, marginTop: 24, marginLeft: -containerPadding }]}
          />
          <Text style={[styles.title, { fontSize: titleFontSize }]}>Entrar</Text>
          <Text style={styles.subtitle}>
            Acesse sua conta com e-mail e senha.
          </Text>
          <View style={styles.form}>
            <Input
              placeholder="e-mail"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
            <Input
              placeholder="senha"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            {error !== "" && <Text style={styles.errorText}>{error}</Text>}
            {loading ? (
              <ActivityIndicator
                size="large"
                color={primaryColor}
                style={{ marginTop: 8 }}
              />
            ) : (
              <Button label="Entrar" onPress={handleSignIn} />
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FDFDFD",
    padding: 32,
  },
  scrollWide: {
    justifyContent: "center",
  },
  illustration: {
    width: "120%",
    marginLeft: -32,
    height: 350,
    marginTop: 62,
  },
  illustrationWide: {
    width: "100%",
    marginLeft: 0,
    height: 260,
    marginTop: 16,
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
  form: {
    marginTop: 24,
    gap: 12,
  },
  errorText: {
    color: "#E53935",
    fontSize: 14,
    textAlign: "center",
  },
  logo: {
    width: 160,
    height: 70,
    alignSelf: "center",
    marginTop: 40,
    marginBottom: -20,
  },
  logoWide: {
    marginTop: 16,
    marginBottom: -8,
  },
});
