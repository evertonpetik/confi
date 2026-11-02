import { caminhoLogoFazenda, COR_PADRAO, THEME_COLORS, useTheme, type TemaFazenda } from "@/contexts/ThemeContext";
import { uploadBlob } from "@/services/storageService";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

/**
 * Editor da identidade visual de UMA fazenda (cor primária e logo).
 *
 * Usado pelo admin no cadastro da fazenda (tela Usuários). O que for salvo
 * vale para todo usuário que acessar essa fazenda, em qualquer aparelho —
 * ver ThemeContext.
 */
type Props = {
  fazendaId: string;
  fazendaNome: string;
  tema: TemaFazenda;
  onChange?: (tema: TemaFazenda) => void;
};

export function IdentidadeVisual({ fazendaId, fazendaNome, tema, onChange }: Props) {
  const { salvarTemaDaFazenda } = useTheme();
  const [cor, setCor] = useState<string>(tema.primaryColor || COR_PADRAO);
  const [logo, setLogo] = useState<string | null>(tema.logoUrl || null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [salvandoCor, setSalvandoCor] = useState<string | null>(null);

  useEffect(() => {
    setCor(tema.primaryColor || COR_PADRAO);
    setLogo(tema.logoUrl || null);
  }, [fazendaId, tema.primaryColor, tema.logoUrl]);

  async function handleCor(valor: string) {
    const anterior = cor;
    setCor(valor);
    setSalvandoCor(valor);
    try {
      await salvarTemaDaFazenda(fazendaId, { primaryColor: valor });
      onChange?.({ primaryColor: valor, logoUrl: logo });
    } catch (err) {
      console.error("Erro ao salvar cor:", err);
      setCor(anterior);
      Alert.alert("Erro", "Não foi possível salvar a cor da fazenda.");
    } finally {
      setSalvandoCor(null);
    }
  }

  async function handleUploadLogo() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        allowsEditing: true,
      });
      if (result.canceled || !result.assets[0]) return;

      setUploadingLogo(true);
      // Sufixo de tempo na URL evita cache da imagem antiga ao trocar a logo
      const url = `${await uploadBlob(caminhoLogoFazenda(fazendaId), result.assets[0].uri)}${"&v=" + Date.now()}`;
      await salvarTemaDaFazenda(fazendaId, { logoUrl: url });
      setLogo(url);
      onChange?.({ primaryColor: cor, logoUrl: url });
    } catch (err) {
      console.error("Erro ao fazer upload da logo:", err);
      Alert.alert("Erro", "Não foi possível enviar a logo.");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleRemoverLogo() {
    try {
      await salvarTemaDaFazenda(fazendaId, { logoUrl: null });
      setLogo(null);
      onChange?.({ primaryColor: cor, logoUrl: null });
    } catch (err) {
      console.error("Erro ao remover logo:", err);
      Alert.alert("Erro", "Não foi possível remover a logo.");
    }
  }

  return (
    <View>
      <Text style={styles.descricao}>
        Cor e logo exibidas para todos os usuários de <Text style={styles.bold}>{fazendaNome}</Text> (menu, telas e seleção de fazenda).
      </Text>

      <Text style={styles.label}>Cor principal</Text>
      <View style={styles.colorGrid}>
        {THEME_COLORS.map((c) => {
          const selecionada = c.value === cor;
          return (
            <TouchableOpacity
              key={c.value}
              style={styles.colorItem}
              activeOpacity={0.7}
              onPress={() => handleCor(c.value)}
              disabled={salvandoCor !== null}
            >
              <View style={[styles.colorCircle, { backgroundColor: c.value }, selecionada && styles.colorCircleSelected]}>
                {salvandoCor === c.value ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  selecionada && <Feather name="check" size={16} color="#FFF" />
                )}
              </View>
              <Text style={styles.colorLabel}>{c.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[styles.label, { marginTop: 16 }]}>Logo</Text>
      <View style={styles.logoSection}>
        <View style={styles.logoPreview}>
          {logo ? (
            <Image source={{ uri: logo }} style={styles.logoImage} resizeMode="contain" />
          ) : (
            <View style={styles.logoPlaceholder}>
              <Feather name="image" size={32} color="#DCDCDC" />
              <Text style={styles.logoPlaceholderText}>Sem logo</Text>
            </View>
          )}
        </View>
        <View style={{ gap: 8 }}>
          <TouchableOpacity
            style={[styles.uploadButton, { backgroundColor: cor }]}
            activeOpacity={0.8}
            onPress={handleUploadLogo}
            disabled={uploadingLogo}
          >
            {uploadingLogo ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Feather name="upload" size={16} color="#FFF" />
                <Text style={styles.uploadButtonText}>{logo ? "Alterar Logo" : "Enviar Logo"}</Text>
              </>
            )}
          </TouchableOpacity>
          {logo && !uploadingLogo && (
            <TouchableOpacity style={styles.removeButton} activeOpacity={0.8} onPress={handleRemoverLogo}>
              <Feather name="trash-2" size={16} color="#E53935" />
              <Text style={styles.removeButtonText}>Remover</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  descricao: { fontSize: 14, color: "#666", marginBottom: 12 },
  bold: { fontWeight: "700", color: "#1a1a1a" },
  label: { fontSize: 14, fontWeight: "600", color: "#1a1a1a", marginBottom: 8 },
  colorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  colorItem: { alignItems: "center", width: 64 },
  colorCircle: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  colorCircleSelected: { borderWidth: 3, borderColor: "#1a1a1a" },
  colorLabel: { fontSize: 10, color: "#666", marginTop: 4, textAlign: "center" },
  logoSection: { flexDirection: "row", alignItems: "center", gap: 16, flexWrap: "wrap" },
  logoPreview: {
    width: 160,
    height: 80,
    borderRadius: 8,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logoImage: { width: 150, height: 70 },
  logoPlaceholder: { alignItems: "center" },
  logoPlaceholderText: { fontSize: 11, color: "#BBB", marginTop: 4 },
  uploadButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  uploadButtonText: { color: "#FFF", fontWeight: "600", fontSize: 14 },
  removeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E53935",
  },
  removeButtonText: { color: "#E53935", fontWeight: "600", fontSize: 14 },
});
