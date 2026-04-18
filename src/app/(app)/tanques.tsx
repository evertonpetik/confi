import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DrawerSceneWrapper } from "@/components/drawe-scene-wrapper";
import { DrawerToggleButton } from "@/components/DrawerToggleButton";
import { Tanque, TanqueCard } from "@/components/TanqueCard";
import { TanqueFormModal } from "@/components/TanqueFormModal";
import { useTheme } from "@/contexts/ThemeContext";
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

export default function Tanques() {
  const { primaryColor } = useTheme();
  const {
    isTablet,
    isDesktop,
    maxWidthContent,
    containerPadding,
    titleFontSize,
    headerPaddingTop,
  } = useResponsive();
  const [tanques, setTanques] = useState<Tanque[]>([]);
  const [loading, setLoading] = useState(true);

  const [formVisible, setFormVisible] = useState(false);
  const [editingTanque, setEditingTanque] = useState<Tanque | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Tanque | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchTanques();
    }, [])
  );

  async function fetchTanques() {
    try {
      setLoading(true);
      const snap = await getCollection("tanques");
      const data: Tanque[] = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Tanque[];
      data.sort((a, b) => a.nome.localeCompare(b.nome));
      setTanques(data);
    } catch (error) {
      console.error("Erro ao buscar tanques:", error);
    } finally {
      setLoading(false);
    }
  }

  function handleNew() {
    setEditingTanque(null);
    setFormVisible(true);
  }

  function handleEdit(tanque: Tanque) {
    setEditingTanque(tanque);
    setFormVisible(true);
  }

  function handleDeleteRequest(tanque: Tanque) {
    setDeleteTarget(tanque);
  }

  async function handleSave(data: Omit<Tanque, "id">) {
    try {
      if (editingTanque) {
        await updateDocument(["tanques"], editingTanque.id, { ...data });
        setTanques((prev) =>
          prev.map((t) =>
            t.id === editingTanque.id ? { ...t, ...data } : t
          )
        );
      } else {
        const docRef = await addDocument(["tanques"], data);
        setTanques((prev) =>
          [...prev, { id: docRef.id, ...data }].sort((a, b) =>
            a.nome.localeCompare(b.nome)
          )
        );
      }
      setFormVisible(false);
      setEditingTanque(null);
    } catch (error) {
      console.error("Erro ao salvar tanque:", error);
      Alert.alert("Erro", "Nao foi possivel salvar o tanque.");
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteDocument(["tanques"], deleteTarget.id);
      setTanques((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (error) {
      console.error("Erro ao excluir tanque:", error);
      Alert.alert("Erro", "Nao foi possivel excluir o tanque.");
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
                Tanques
              </Text>
              {!isDesktop && <DrawerToggleButton tintColor="#000000" />}
            </View>

            <Text style={styles.subtitle}>
              Gerencie os tanques de combustivel da propriedade.
            </Text>

            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: primaryColor }]}
              activeOpacity={0.8}
              onPress={handleNew}
            >
              <Feather name="plus" size={20} color="#FFF" />
              <Text style={styles.addButtonLabel}>Novo Tanque</Text>
            </TouchableOpacity>

            {loading ? (
              <ActivityIndicator
                size="large"
                color={primaryColor}
                style={{ marginTop: 32 }}
              />
            ) : tanques.length === 0 ? (
              <Text style={styles.emptyText}>Nenhum tanque encontrado.</Text>
            ) : (
              <View style={styles.list}>
                {tanques.map((tanque) => (
                  <TanqueCard
                    key={tanque.id}
                    tanque={tanque}
                    onEdit={handleEdit}
                    onDelete={handleDeleteRequest}
                  />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <TanqueFormModal
        visible={formVisible}
        tanque={editingTanque}
        onSave={handleSave}
        onClose={() => {
          setFormVisible(false);
          setEditingTanque(null);
        }}
      />

      <ConfirmDialog
        visible={!!deleteTarget}
        title="Excluir Tanque"
        message={`Deseja realmente excluir o tanque "${deleteTarget?.nome ?? ""}"?`}
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
