import { Button } from "@/components/Button"
import { DrawerSceneWrapper } from "@/components/drawe-scene-wrapper"
import { useResponsive } from "@/hooks/useResponsive"
import { seedTabelasAuxiliares } from "@/utils/seedTabelasAuxiliares"
import { DrawerToggleButton } from "@react-navigation/drawer"
import { useState } from "react"
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native"


export default function Configuracoes() {
  const { isTablet, maxWidthContent } = useResponsive()
  const [loading, setLoading] = useState(false)

  async function handleSeedTabelasAuxiliares() {
    setLoading(true)
    try {
      const resultado = await seedTabelasAuxiliares()
      Alert.alert("Tabelas Auxiliares", resultado)
    } catch (error) {
      Alert.alert("Erro", "Não foi possível criar as tabelas auxiliares.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <DrawerSceneWrapper>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.select({ ios: "padding", android: "height" })}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.container, isTablet && { maxWidth: maxWidthContent, alignSelf: "center" as const, width: "100%" }]}>

            <View style={styles.header}>
              <Text style={styles.title}>Configurações</Text>
              <DrawerToggleButton tintColor="#000000" />
            </View>

            <Text style={styles.subtitle}>Texto explicativo da pagina.</Text>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Banco de Dados</Text>
              <Text style={styles.sectionDescription}>
                Popula o banco de dados com as tabelas auxiliares (Tamanho Corporal, Implante, Movimentação, Raça, Compensatório, Categoria e GEC). Tabelas já existentes serão ignoradas.
              </Text>
              {loading ? (
                <ActivityIndicator size="large" color="#3366FF" style={{ marginTop: 16 }} />
              ) : (
                <Button label="Criar Tabelas Auxiliares" onPress={handleSeedTabelasAuxiliares} />
              )}
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </DrawerSceneWrapper>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FDFDFD",
    padding: 32,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 40,
    marginBottom: 24,
  },
  illustration: {
    width: "120%",
    marginLeft: -32,
    height: 350,
    marginTop: 62,
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
  },
  section: {
    marginTop: 32,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 700,
  },
  sectionDescription: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
})