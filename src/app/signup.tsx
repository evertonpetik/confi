import { Link } from "expo-router"
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native"

import { Button } from "@/components/Button"
import { Input } from "@/components/Input"
import { useResponsive } from "@/hooks/useResponsive"

export default function SignUp() {
  const { isTablet, maxWidthAuth } = useResponsive()

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
            source={require("@/assets/img2.png")}
            resizeMode="contain"
            style={[styles.illustration, isTablet && styles.illustrationWide]}
          />
          <Text style={styles.title}>Cadastrar</Text>
          <Text style={styles.subtitle}>Crie sua conta para acessar.</Text>

          <View style={styles.form}>
            <Input placeholder="Nome" />
            <Input placeholder="E-mail" keyboardType="email-address" />
            <Input placeholder="Senha" secureTextEntry />
            <Input placeholder="Confirmar Senha" secureTextEntry />
            <Button label="Cadastrar" />
            <Text style={styles.footerText}>
              Já tem uma conta? {" "}
              <Link href="/" style={styles.footerLink}>
                Entre aqui.
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
