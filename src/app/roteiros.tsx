import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Dieta } from "@/components/DietaCard";
import { DietaFormModal } from "@/components/DietaFormModal";
import { DrawerSceneWrapper } from "@/components/drawe-scene-wrapper";
import { Insumo } from "@/components/InsumoCard";
import { InsumoFormModal } from "@/components/InsumoFormModal";
import { Roteiro, RoteiroCard } from "@/components/RoteiroCard";
import { RoteiroFormModal } from "@/components/RoteiroFormModal";
import { SelectOption } from "@/components/Select";
import { useResponsive } from "@/hooks/useResponsive";
import { Feather } from "@expo/vector-icons";
import { DrawerToggleButton } from "@react-navigation/drawer";
import { useFocusEffect } from "@react-navigation/native";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
} from "firebase/firestore";
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
import { db } from "../../firebaseConfig";

type LoteRef = {
  id: string;
  dietaId: string;
  piqueteId: string;
  piqueteNome: string;
  ativo: boolean;
};

type FiltroStatus = "ativos" | "inativos";

export default function Roteiros() {
  const { isTablet, maxWidthContent } = useResponsive();
  const [roteiros, setRoteiros] = useState<Roteiro[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<FiltroStatus>("ativos");

  const [modalVisible, setModalVisible] = useState(false);
  const [editingRoteiro, setEditingRoteiro] = useState<Roteiro | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Roteiro | null>(null);

  const [dietaOptions, setDietaOptions] = useState<SelectOption[]>([]);
  const [lotesRef, setLotesRef] = useState<LoteRef[]>([]);

  // Modais inline para cadastro rápido
  const [inlineDietaVisible, setInlineDietaVisible] = useState(false);
  const [inlineInsumoVisible, setInlineInsumoVisible] = useState(false);
  const [insumoOptions, setInsumoOptions] = useState<SelectOption[]>([]);
  const [aditivoOptions, setAditivoOptions] = useState<SelectOption[]>([]);

  useFocusEffect(
    useCallback(() => {
      fetchRoteiros();
      fetchOptions();
    }, [])
  );

  async function fetchOptions() {
    try {
      const [dietaSnap, lotesSnap, insumoSnap, aditivoSnap] = await Promise.all([
        getDocs(collection(db, "dietas")),
        getDocs(collection(db, "lotes")),
        getDocs(collection(db, "insumos")),
        getDocs(collection(db, "aditivos")),
      ]);

      setDietaOptions(
        dietaSnap.docs
          .filter((d) => d.data().ativo !== false)
          .map((d) => ({
            label: d.data().nome,
            value: d.id,
          }))
          .sort((a, b) => a.label.localeCompare(b.label))
      );

      setLotesRef(
        lotesSnap.docs.map((d) => ({
          id: d.id,
          dietaId: d.data().dietaId ?? "",
          piqueteId: d.data().piqueteId ?? "",
          piqueteNome: d.data().piqueteNome ?? "",
          ativo: d.data().ativo ?? true,
        }))
      );

      setInsumoOptions(
        insumoSnap.docs
          .map((d) => ({ label: d.data().nome as string, value: d.id }))
          .sort((a, b) => a.label.localeCompare(b.label))
      );
      setAditivoOptions(
        aditivoSnap.docs
          .map((d) => ({
            label: d.data().descricao as string,
            value: d.data().descricao as string,
          }))
          .sort((a, b) => a.label.localeCompare(b.label))
      );
    } catch (error) {
      console.error("Erro ao buscar opções:", error);
    }
  }

  async function fetchRoteiros() {
    try {
      setLoading(true);
      const snap = await getDocs(collection(db, "roteiros"));
      const data: Roteiro[] = snap.docs.map((d) => ({
        id: d.id,
        numero: d.data().numero ?? 0,
        dietaId: d.data().dietaId ?? "",
        dietaNome: d.data().dietaNome ?? "",
        piquetes: d.data().piquetes ?? [],
        minTratos: d.data().minTratos ?? 1,
        ativo: d.data().ativo ?? true,
      }));
      data.sort((a, b) => a.numero - b.numero);
      setRoteiros(data);
    } catch (error) {
      console.error("Erro ao buscar roteiros:", error);
    } finally {
      setLoading(false);
    }
  }

  function getNextNumero(): number {
    if (roteiros.length === 0) return 1;
    return Math.max(...roteiros.map((r) => r.numero)) + 1;
  }

  function getPiquetesForDieta(dietaId: string) {
    return lotesRef
      .filter((l) => l.piqueteId && l.dietaId === dietaId && l.ativo)
      .map((l) => ({
        label: l.piqueteNome,
        value: l.piqueteId,
      }))
      .sort((a, b) => {
        const numA = parseInt(a.label.replace(/\D/g, "")) || 0;
        const numB = parseInt(b.label.replace(/\D/g, "")) || 0;
        return numA - numB;
      });
  }

  function handleNew() {
    setEditingRoteiro(null);
    setModalVisible(true);
  }

  function handleEdit(roteiro: Roteiro) {
    setEditingRoteiro(roteiro);
    setModalVisible(true);
  }

  function handleDeleteRequest(roteiro: Roteiro) {
    setDeleteTarget(roteiro);
  }

  async function handleInlineDietaSave(data: Omit<Dieta, "id">) {
    try {
      const docRef = await addDoc(collection(db, "dietas"), data);
      setDietaOptions((prev) =>
        [...prev, { label: data.nome, value: docRef.id }].sort((a, b) =>
          a.label.localeCompare(b.label)
        )
      );
      setInlineDietaVisible(false);
    } catch (error) {
      console.error("Erro ao salvar dieta:", error);
      Alert.alert("Erro", "Não foi possível salvar a dieta.");
    }
  }

  async function handleInlineInsumoSave(data: Omit<Insumo, "id" | "compras">) {
    try {
      const docRef = await addDoc(collection(db, "insumos"), data);
      setInsumoOptions((prev) =>
        [...prev, { label: data.nome, value: docRef.id }].sort((a, b) =>
          a.label.localeCompare(b.label)
        )
      );
      setInlineInsumoVisible(false);
    } catch (error) {
      console.error("Erro ao salvar insumo:", error);
      Alert.alert("Erro", "Não foi possível salvar o insumo.");
    }
  }

  async function handleSave(data: Omit<Roteiro, "id">) {
    try {
      if (editingRoteiro) {
        const ref = doc(db, "roteiros", editingRoteiro.id);
        await updateDoc(ref, { ...data });
        setRoteiros((prev) =>
          prev.map((r) =>
            r.id === editingRoteiro.id ? { ...r, ...data } : r
          )
        );
      } else {
        const docRef = await addDoc(collection(db, "roteiros"), data);
        setRoteiros((prev) =>
          [...prev, { id: docRef.id, ...data }].sort(
            (a, b) => a.numero - b.numero
          )
        );
      }
      setModalVisible(false);
      setEditingRoteiro(null);
    } catch (error) {
      console.error("Erro ao salvar roteiro:", error);
      Alert.alert("Erro", "Não foi possível salvar o roteiro.");
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteDoc(doc(db, "roteiros", deleteTarget.id));
      setRoteiros((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (error) {
      console.error("Erro ao excluir roteiro:", error);
      Alert.alert("Erro", "Não foi possível excluir o roteiro.");
    }
  }

  const roteirosFiltrados = roteiros.filter((r) =>
    filtro === "ativos" ? r.ativo : !r.ativo
  );

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
              isTablet && {
                maxWidth: maxWidthContent,
                alignSelf: "center" as const,
                width: "100%",
              },
            ]}
          >
            <View style={styles.header}>
              <Text style={styles.title}>Roteiros</Text>
              <DrawerToggleButton tintColor="#000000" />
            </View>

            <Text style={styles.subtitle}>
              Gerencie seus roteiros de trato.
            </Text>

            {/* Filtro Ativos / Inativos */}
            <View style={styles.filterRow}>
              <TouchableOpacity
                style={[
                  styles.filterButton,
                  filtro === "ativos" && styles.filterActive,
                ]}
                activeOpacity={0.8}
                onPress={() => setFiltro("ativos")}
              >
                <Text
                  style={[
                    styles.filterText,
                    filtro === "ativos" && styles.filterTextActive,
                  ]}
                >
                  Ativos
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterButton,
                  filtro === "inativos" && styles.filterActive,
                ]}
                activeOpacity={0.8}
                onPress={() => setFiltro("inativos")}
              >
                <Text
                  style={[
                    styles.filterText,
                    filtro === "inativos" && styles.filterTextActive,
                  ]}
                >
                  Inativos
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.addButton}
              activeOpacity={0.8}
              onPress={handleNew}
            >
              <Feather name="plus" size={20} color="#FFF" />
              <Text style={styles.addButtonLabel}>Novo Roteiro</Text>
            </TouchableOpacity>

            {loading ? (
              <ActivityIndicator
                size="large"
                color="#3366FF"
                style={{ marginTop: 32 }}
              />
            ) : roteirosFiltrados.length === 0 ? (
              <Text style={styles.emptyText}>
                Nenhum roteiro{" "}
                {filtro === "ativos" ? "ativo" : "inativo"} encontrado.
              </Text>
            ) : (
              <View style={styles.list}>
                {roteirosFiltrados.map((roteiro) => (
                  <RoteiroCard
                    key={roteiro.id}
                    roteiro={roteiro}
                    onEdit={handleEdit}
                    onDelete={handleDeleteRequest}
                  />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <RoteiroFormModal
        visible={modalVisible && !inlineDietaVisible}
        roteiro={editingRoteiro}
        nextNumero={getNextNumero()}
        dietaOptions={dietaOptions}
        getPiquetesForDieta={getPiquetesForDieta}
        onSave={handleSave}
        onClose={() => {
          setModalVisible(false);
          setEditingRoteiro(null);
        }}
        onAddDieta={() => setInlineDietaVisible(true)}
      />

      <DietaFormModal
        visible={inlineDietaVisible && !inlineInsumoVisible}
        insumoOptions={insumoOptions}
        aditivoOptions={aditivoOptions}
        onSave={handleInlineDietaSave}
        onClose={() => setInlineDietaVisible(false)}
        onAddInsumo={() => setInlineInsumoVisible(true)}
      />

      <InsumoFormModal
        visible={inlineInsumoVisible}
        onSave={handleInlineInsumoSave}
        onClose={() => setInlineInsumoVisible(false)}
      />

      <ConfirmDialog
        visible={!!deleteTarget}
        title="Excluir Roteiro"
        message={`Deseja realmente excluir o Roteiro ${deleteTarget?.numero ?? ""}? Esta ação não pode ser desfeita.`}
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
  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 20,
  },
  filterButton: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#DCDCDC",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF",
  },
  filterActive: {
    backgroundColor: "#3366FF",
    borderColor: "#3366FF",
  },
  filterText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  filterTextActive: {
    color: "#FFF",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3366FF",
    borderRadius: 8,
    height: 48,
    gap: 8,
    marginTop: 16,
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
