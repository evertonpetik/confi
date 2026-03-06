import { Link, router } from "expo-router"
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native"

import { Button } from "@/components/Button"
import { Input } from "@/components/Input"
import { useResponsive } from "@/hooks/useResponsive"

export default function Index() {
  const { isTablet, maxWidthAuth } = useResponsive()

  function handleSignIn() {
    router.push("/home")
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.select({ ios: "padding", android: "height" })}>
      <ScrollView
        contentContainerStyle={[{ flexGrow: 1 }, isTablet && styles.scrollWide]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.container, isTablet && { maxWidth: maxWidthAuth, alignSelf: "center" as const, width: "100%" }]}>
          <Image
            source={require("@/assets/img1.png")}
            resizeMode="contain"
            style={[styles.illustration, isTablet && styles.illustrationWide]}
          />
          <Text style={styles.title}>Entrar</Text>
          <Text style={styles.subtitle}>Acesse sua conta com e-mail e senha.</Text>
          <View style={styles.form}>
            <Input placeholder="e-mail" keyboardType="email-address" />
            <Input placeholder="senha" secureTextEntry />
            <Button label="Entrar" onPress={handleSignIn} />
            <Text style={styles.footerText}>
              Não tem conta? {" "}
              <Link href="/signup" style={styles.footerLink}>
                Cadastre-se aqui.
              </Link>
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
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
    fontWeight: 900,
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
  footerText: {
    textAlign: "center",
    marginTop: 24,
    color: "#585860",
  },
  footerLink: {
    color: "#032ad7",
    fontWeight: 700,
  }
})
