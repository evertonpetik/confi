import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DrawerSceneWrapper } from "@/components/drawe-scene-wrapper";
import { DrawerToggleButton } from "@/components/DrawerToggleButton";
import { Produtor, ProdutorCard } from "@/components/ProdutorCard";
import { ProdutorFormModal } from "@/components/ProdutorFormModal";
import { useResponsive } from "@/hooks/useResponsive";
import {
  addDocument,
  deleteDocument,
  getCollection,
  updateDocument
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

export default function Produtores() {
  const { isTablet, isDesktop, maxWidthContent } = useResponsive();
  const [produtores, setProdutores] = useState<Produtor[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingProdutor, setEditingProdutor] = useState<Produtor | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Produtor | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchProdutores();
    }, [])
  );

  async function fetchProdutores() {
    try {
      setLoading(true);
      const querySnapshot = await getCollection("produtores");
      const data: Produtor[] = [];
      querySnapshot.forEach((docSnap) => {
        data.push({ id: docSnap.id, ...docSnap.data() } as Produtor);
      });
      setProdutores(data);
    } catch (error) {
      console.error("Erro ao buscar produtores:", error);
    } finally {
      setLoading(false);
    }
  }

  function handleNew() {
    setEditingProdutor(null);
    setModalVisible(true);
  }

  function handleEdit(produtor: Produtor) {
    setEditingProdutor(produtor);
    setModalVisible(true);
  }

  function handleDeleteRequest(produtor: Produtor) {
    setDeleteTarget(produtor);
  }

  async function handleSave(data: Omit<Produtor, "id">) {
    try {
      if (editingProdutor) {
        await updateDocument(["produtores"], editingProdutor.id, { ...data });
        setProdutores((prev) =>
          prev.map((p) =>
            p.id === editingProdutor.id ? { ...p, ...data } : p
          )
        );
      } else {
        const docRef = await addDocument(["produtores"], data);
        setProdutores((prev) => [...prev, { id: docRef.id, ...data }]);
      }
      setModalVisible(false);
      setEditingProdutor(null);
    } catch (error) {
      console.error("Erro ao salvar produtor:", error);
      Alert.alert("Erro", "Nao foi possivel salvar o produtor.");
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteDocument(["produtores"], deleteTarget.id);
      setProdutores((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (error) {
      console.error("Erro ao excluir produtor:", error);
      Alert.alert("Erro", "Nao foi possivel excluir o produtor.");
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
          <View style={[styles.container, isTablet && !isDesktop && { maxWidth: maxWidthContent, alignSelf: "center" as const, width: "100%" }]}>
            <View style={styles.header}>
              <Text style={styles.title}>Produtores</Text>
              {!isDesktop && <DrawerToggleButton tintColor="#000000" />}
            </View>

            <Text style={styles.subtitle}>
              Gerencie seus produtores cadastrados.
            </Text>

            <TouchableOpacity
              style={styles.addButton}
              activeOpacity={0.8}
              onPress={handleNew}
            >
              <Feather name="plus" size={20} color="#FFF" />
              <Text style={styles.addButtonLabel}>Novo Produtor</Text>
            </TouchableOpacity>

            {loading ? (
              <ActivityIndicator
                size="large"
                color="#3366FF"
                style={{ marginTop: 32 }}
              />
            ) : produtores.length === 0 ? (
              <Text style={styles.emptyText}>
                Nenhum produtor encontrado.
              </Text>
            ) : (
              <View style={styles.list}>
                {produtores.map((produtor) => (
                  <ProdutorCard
                    key={produtor.id}
                    produtor={produtor}
                    onEdit={handleEdit}
                    onDelete={handleDeleteRequest}
                  />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <ProdutorFormModal
        visible={modalVisible}
        produtor={editingProdutor}
        onSave={handleSave}
        onClose={() => {
          setModalVisible(false);
          setEditingProdutor(null);
        }}
      />

      <ConfirmDialog
        visible={!!deleteTarget}
        title="Excluir Produtor"
        message={`Deseja realmente excluir o produtor "${deleteTarget?.nome ?? ""}"? Esta acao nao pode ser desfeita.`}
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
