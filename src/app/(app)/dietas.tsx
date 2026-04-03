import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Dieta, DietaCard } from "@/components/DietaCard";
import { DietaFormModal } from "@/components/DietaFormModal";
import { DrawerSceneWrapper } from "@/components/drawe-scene-wrapper";
import { DrawerToggleButton } from "@/components/DrawerToggleButton";
import { Compra, Insumo } from "@/components/InsumoCard";
import { InsumoFormModal } from "@/components/InsumoFormModal";
import { SelectOption } from "@/components/Select";
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

function calcularCustoKgMS(
  dietaInsumos: Dieta["insumos"],
  insumosMap: Map<string, Insumo>
): number {
  let custo = 0;
  for (const di of dietaInsumos) {
    const insumo = insumosMap.get(di.insumoId);
    if (!insumo || insumo.compras.length === 0) continue;
    if (insumo.percentualMateriaSeca <= 0) continue;

    const totalQtd = insumo.compras.reduce((acc, c) => acc + c.quantidade, 0);
    if (totalQtd <= 0) continue;

    const totalValor = insumo.compras.reduce(
      (acc, c) => acc + c.quantidade * c.precoKg,
      0
    );
    const precoMedioMO = totalValor / totalQtd;
    const precoKgMS = precoMedioMO / (insumo.percentualMateriaSeca / 100);
    custo += (di.percentual / 100) * precoKgMS;
  }
  return custo;
}

export default function Dietas() {
  const { isTablet, isDesktop, maxWidthContent } = useResponsive();
  const [dietas, setDietas] = useState<Dieta[]>([]);
  const [loading, setLoading] = useState(true);

  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [insumosMap, setInsumosMap] = useState<Map<string, Insumo>>(new Map());
  const [insumoOptions, setInsumoOptions] = useState<SelectOption[]>([]);
  const [aditivoOptions, setAditivoOptions] = useState<SelectOption[]>([]);

  const [formVisible, setFormVisible] = useState(false);
  const [editingDieta, setEditingDieta] = useState<Dieta | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Dieta | null>(null);
  const [inlineInsumoVisible, setInlineInsumoVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchAllData();
    }, [])
  );

  async function fetchAllData() {
    try {
      setLoading(true);
      await Promise.all([fetchInsumos(), fetchAditivos(), fetchDietas()]);
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchInsumos() {
    const insumosSnap = await getCollection("insumos");
    const data: Insumo[] = [];

    for (const insumoDoc of insumosSnap.docs) {
      const insumoData = insumoDoc.data();
      const comprasSnap = await getCollection(
        "insumos", insumoDoc.id, "compras"
      );
      const compras: Compra[] = comprasSnap.docs.map((cDoc) => ({
        id: cDoc.id,
        ...cDoc.data(),
      })) as Compra[];

      data.push({
        id: insumoDoc.id,
        nome: insumoData.nome ?? "",
        percentualMateriaSeca: insumoData.percentualMateriaSeca ?? 0,
        materiaSecaVariavel: insumoData.materiaSecaVariavel ?? false,
        compras,
        saidas: [],
        conferencias: [],
      });
    }

    data.sort((a, b) => a.nome.localeCompare(b.nome));
    setInsumos(data);

    const map = new Map<string, Insumo>();
    for (const i of data) {
      map.set(i.id, i);
    }
    setInsumosMap(map);

    setInsumoOptions(
      data.map((i) => ({ label: i.nome, value: i.id }))
    );
  }

  async function fetchAditivos() {
    const snap = await getCollection("aditivos");
    const options: SelectOption[] = snap.docs
      .map((d) => ({
        label: d.data().descricao ?? "",
        value: d.data().descricao ?? "",
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
    setAditivoOptions(options);
  }

  async function fetchDietas() {
    const snap = await getCollection("dietas");
    const data: Dieta[] = snap.docs.map((d) => ({
      id: d.id,
      nome: d.data().nome ?? "",
      insumos: d.data().insumos ?? [],
      percentualMS: d.data().percentualMS ?? 0,
      ndt: d.data().ndt ?? 0,
      aditivoId: d.data().aditivoId ?? "",
      aditivoNome: d.data().aditivoNome ?? "",
      ativo: d.data().ativo ?? true,
    }));
    data.sort((a, b) => a.nome.localeCompare(b.nome));
    setDietas(data);
  }

  function handleNew() {
    setEditingDieta(null);
    setFormVisible(true);
  }

  function handleEdit(dieta: Dieta) {
    setEditingDieta(dieta);
    setFormVisible(true);
  }

  function handleDeleteRequest(dieta: Dieta) {
    setDeleteTarget(dieta);
  }

  async function handleInlineInsumoSave(data: Omit<Insumo, "id" | "compras" | "saidas" | "conferencias">) {
    try {
      const docRef = await addDocument(["insumos"], data);
      const newInsumo: Insumo = { id: docRef.id, ...data, compras: [], saidas: [], conferencias: [] };
      setInsumos((prev) =>
        [...prev, newInsumo].sort((a, b) => a.nome.localeCompare(b.nome))
      );
      setInsumosMap((prev) => {
        const m = new Map(prev);
        m.set(docRef.id, newInsumo);
        return m;
      });
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

  async function handleSave(data: Omit<Dieta, "id">) {
    try {
      if (editingDieta) {
        await updateDocument(["dietas"], editingDieta.id, { ...data });
        setDietas((prev) =>
          prev.map((d) =>
            d.id === editingDieta.id ? { ...d, ...data } : d
          )
        );
      } else {
        const docRef = await addDocument(["dietas"], data);
        setDietas((prev) =>
          [...prev, { id: docRef.id, ...data }].sort((a, b) =>
            a.nome.localeCompare(b.nome)
          )
        );
      }
      setFormVisible(false);
      setEditingDieta(null);
    } catch (error) {
      console.error("Erro ao salvar dieta:", error);
      Alert.alert("Erro", "Não foi possível salvar a dieta.");
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteDocument(["dietas"], deleteTarget.id);
      setDietas((prev) => prev.filter((d) => d.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (error) {
      console.error("Erro ao excluir dieta:", error);
      Alert.alert("Erro", "Não foi possível excluir a dieta.");
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
              isTablet && !isDesktop && {
                maxWidth: maxWidthContent,
                alignSelf: "center" as const,
                width: "100%",
              },
            ]}
          >
            <View style={styles.header}>
              <Text style={styles.title}>Dietas</Text>
              {!isDesktop && <DrawerToggleButton tintColor="#000000" />}
            </View>

            <Text style={styles.subtitle}>
              Gerencie suas dietas e composições.
            </Text>

            <TouchableOpacity
              style={styles.addButton}
              activeOpacity={0.8}
              onPress={handleNew}
            >
              <Feather name="plus" size={20} color="#FFF" />
              <Text style={styles.addButtonLabel}>Nova Dieta</Text>
            </TouchableOpacity>

            {loading ? (
              <ActivityIndicator
                size="large"
                color="#3366FF"
                style={{ marginTop: 32 }}
              />
            ) : dietas.length === 0 ? (
              <Text style={styles.emptyText}>
                Nenhuma dieta encontrada.
              </Text>
            ) : (
              <View style={styles.list}>
                {dietas.map((dieta) => (
                  <DietaCard
                    key={dieta.id}
                    dieta={dieta}
                    custoKgMS={calcularCustoKgMS(dieta.insumos, insumosMap)}
                    onEdit={handleEdit}
                    onDelete={handleDeleteRequest}
                  />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <DietaFormModal
        visible={formVisible && !inlineInsumoVisible}
        dieta={editingDieta}
        insumoOptions={insumoOptions}
        aditivoOptions={aditivoOptions}
        insumosMap={insumosMap}
        onSave={handleSave}
        onClose={() => {
          setFormVisible(false);
          setEditingDieta(null);
        }}
        onAddInsumo={() => setInlineInsumoVisible(true)}
      />

      <InsumoFormModal
        visible={inlineInsumoVisible}
        onSave={handleInlineInsumoSave}
        onClose={() => setInlineInsumoVisible(false)}
      />

      <ConfirmDialog
        visible={!!deleteTarget}
        title="Excluir Dieta"
        message={`Deseja realmente excluir a dieta "${deleteTarget?.nome ?? ""}"?`}
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
