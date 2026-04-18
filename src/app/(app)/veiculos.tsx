import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DrawerSceneWrapper } from "@/components/drawe-scene-wrapper";
import { DrawerToggleButton } from "@/components/DrawerToggleButton";
import { QRCodeModal } from "@/components/QRCodeModal";
import { Veiculo, VeiculoCard } from "@/components/VeiculoCard";
import { VeiculoFormModal } from "@/components/VeiculoFormModal";
import { useResponsive } from "@/hooks/useResponsive";
import {
  addDocument,
  deleteDocument,
  getCollection,
  updateDocument,
} from "@/services/firestoreService";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function Veiculos() {
  const {
    isTablet,
    isDesktop,
    maxWidthContent,
    containerPadding,
    titleFontSize,
    headerPaddingTop,
  } = useResponsive();
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [loading, setLoading] = useState(true);

  const [formVisible, setFormVisible] = useState(false);
  const [editingVeiculo, setEditingVeiculo] = useState<Veiculo | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Veiculo | null>(null);
  const [qrCodeVeiculo, setQrCodeVeiculo] = useState<Veiculo | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchVeiculos();
    }, [])
  );

  async function fetchVeiculos() {
    try {
      setLoading(true);
      const snap = await getCollection("veiculos");
      const data: Veiculo[] = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Veiculo[];
      data.sort((a, b) => a.nome.localeCompare(b.nome));
      setVeiculos(data);
    } catch (error) {
      console.error("Erro ao buscar veiculos:", error);
    } finally {
      setLoading(false);
    }
  }

  function handleNew() {
    setEditingVeiculo(null);
    setFormVisible(true);
  }

  function handleEdit(veiculo: Veiculo) {
    setEditingVeiculo(veiculo);
    setFormVisible(true);
  }

  function handleDeleteRequest(veiculo: Veiculo) {
    setDeleteTarget(veiculo);
  }

  function handleQRCode(veiculo: Veiculo) {
    setQrCodeVeiculo(veiculo);
  }

  async function handleSave(data: Omit<Veiculo, "id">) {
    try {
      if (editingVeiculo) {
        await updateDocument(["veiculos"], editingVeiculo.id, { ...data });
        setVeiculos((prev) =>
          prev.map((v) =>
            v.id === editingVeiculo.id ? { ...v, ...data } : v
          )
        );
      } else {
        const docRef = await addDocument(["veiculos"], data);
        const newVeiculo = { id: docRef.id, ...data };
        setVeiculos((prev) =>
          [...prev, newVeiculo].sort((a, b) => a.nome.localeCompare(b.nome))
        );
        // Show QR code for newly created vehicle
        setQrCodeVeiculo(newVeiculo);
      }
      setFormVisible(false);
      setEditingVeiculo(null);
    } catch (error) {
      console.error("Erro ao salvar veiculo:", error);
      Alert.alert("Erro", "Nao foi possivel salvar o veiculo.");
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteDocument(["veiculos"], deleteTarget.id);
      setVeiculos((prev) => prev.filter((v) => v.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (error) {
      console.error("Erro ao excluir veiculo:", error);
      Alert.alert("Erro", "Nao foi possivel excluir o veiculo.");
    }
  }

  return (
    <DrawerSceneWrapper>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.select({ ios: "padding", android: "height" })}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.container,
              { padding: containerPadding },
              isTablet &&
              !isDesktop && {
                maxWidth: maxWidthContent,
                alignSelf: "center" as const,
                width: "100%",
              },
            ]}
          >
            <View style={[styles.header, { paddingTop: headerPaddingTop }]}>
              <Text
                style={[styles.title, { fontSize: titleFontSize, flex: 1 }]}
                numberOfLines={1}
              >
                Veiculos
              </Text>
              {!isDesktop && <DrawerToggleButton tintColor="#000000" />}
            </View>

            <Text style={styles.subtitle}>
              Gerencie veiculos, maquinas e equipamentos.
            </Text>

            <TouchableOpacity
              style={styles.addButton}
              activeOpacity={0.8}
              onPress={handleNew}
            >
              <Feather name="plus" size={20} color="#FFF" />
              <Text style={styles.addButtonLabel}>Novo Veiculo</Text>
            </TouchableOpacity>

            {loading ? (
              <ActivityIndicator
                size="large"
                color="#3366FF"
                style={{ marginTop: 32 }}
              />
            ) : veiculos.length === 0 ? (
              <Text style={styles.emptyText}>
                Nenhum veiculo encontrado.
              </Text>
            ) : (
              <View style={styles.list}>
                {veiculos.map((veiculo) => (
                  <VeiculoCard
                    key={veiculo.id}
                    veiculo={veiculo}
                    onEdit={handleEdit}
                    onDelete={handleDeleteRequest}
                    onQRCode={handleQRCode}
                  />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <VeiculoFormModal
        visible={formVisible}
        veiculo={editingVeiculo}
        onSave={handleSave}
        onClose={() => {
          setFormVisible(false);
          setEditingVeiculo(null);
        }}
      />

      <QRCodeModal
        visible={!!qrCodeVeiculo}
        veiculo={qrCodeVeiculo}
        onClose={() => setQrCodeVeiculo(null)}
      />

      <ConfirmDialog
        visible={!!deleteTarget}
        title="Excluir Veiculo"
        message={`Deseja realmente excluir "${deleteTarget?.nome ?? ""}"?`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </DrawerSceneWrapper>
  );
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
  title: {
    fontSize: 32,
    fontWeight: "900",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginTop: 8,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3366FF",
    borderRadius: 8,
    height: 48,
    gap: 8,
    marginTop: 24,
  },
  addButtonLabel: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
  emptyText: {
    textAlign: "center",
    marginTop: 32,
    fontSize: 16,
    color: "#999",
  },
  list: {
    marginTop: 24,
    gap: 12,
  },
});
