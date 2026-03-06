import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DrawerSceneWrapper } from "@/components/drawe-scene-wrapper";
import { FaturamentoModal, LancamentoFinanceiro } from "@/components/FaturamentoModal";
import { Lote, LoteCard, Movimentacao } from "@/components/LoteCard";
import { LoteFormModal } from "@/components/LoteFormModal";
import { MovimentacaoFormModal } from "@/components/MovimentacaoFormModal";
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

type FiltroStatus = "ativos" | "inativos";

export default function Lotes() {
  const { isTablet, maxWidthContent } = useResponsive();
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<FiltroStatus>("ativos");

  const [modalVisible, setModalVisible] = useState(false);
  const [editingLote, setEditingLote] = useState<Lote | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Lote | null>(null);

  const [movVisible, setMovVisible] = useState(false);
  const [movLote, setMovLote] = useState<Lote | null>(null);

  const [fatVisible, setFatVisible] = useState(false);
  const [fatLote, setFatLote] = useState<Lote | null>(null);
  const [lancamentosMap, setLancamentosMap] = useState<Map<string, LancamentoFinanceiro[]>>(new Map());
  const [gmdRealMap, setGmdRealMap] = useState<Map<string, { data: string; gmdReal: number }[]>>(new Map());

  // Opcoes dos selects
  const [racaOptions, setRacaOptions] = useState<SelectOption[]>([]);
  const [categoriaOptions, setCategoriaOptions] = useState<SelectOption[]>([]);
  const [compensatorioOptions, setCompensatorioOptions] = useState<SelectOption[]>([]);
  const [implanteOptions, setImplanteOptions] = useState<SelectOption[]>([]);
  const [tamanhoCorporalOptions, setTamanhoCorporalOptions] = useState<SelectOption[]>([]);
  const [produtorOptions, setProdutorOptions] = useState<SelectOption[]>([]);
  const [movimentacaoOptions, setMovimentacaoOptions] = useState<{ descricao: string; tipo: string }[]>([]);
  const [dietaOptions, setDietaOptions] = useState<SelectOption[]>([]);
  const [allPiqueteOptions, setAllPiqueteOptions] = useState<SelectOption[]>([]);

  useFocusEffect(
    useCallback(() => {
      fetchLotes();
      fetchOptions();
      fetchFinanceiro();
    }, [])
  );

  async function fetchOptions() {
    try {
      const [racaSnap, catSnap, compSnap, impSnap, tamSnap, prodSnap, movSnap, dietaSnap, piqueteSnap] =
        await Promise.all([
          getDocs(collection(db, "raca")),
          getDocs(collection(db, "categoria")),
          getDocs(collection(db, "compensatorio")),
          getDocs(collection(db, "implante")),
          getDocs(collection(db, "tamanhoCorporal")),
          getDocs(collection(db, "produtores")),
          getDocs(collection(db, "movimentacao")),
          getDocs(collection(db, "dietas")),
          getDocs(collection(db, "piquetes")),
        ]);

      setRacaOptions(
        racaSnap.docs.map((d) => ({
          label: d.data().descricao,
          value: d.data().descricao,
        }))
      );
      setCategoriaOptions(
        catSnap.docs.map((d) => ({
          label: d.data().descricao,
          value: d.data().descricao,
        }))
      );
      setCompensatorioOptions(
        compSnap.docs.map((d) => ({
          label: d.data().descricao,
          value: d.data().descricao,
        }))
      );
      setImplanteOptions(
        impSnap.docs.map((d) => ({
          label: d.data().descricao,
          value: d.data().descricao,
        }))
      );
      setTamanhoCorporalOptions(
        tamSnap.docs.map((d) => ({
          label: d.data().descricao,
          value: d.data().descricao,
        }))
      );
      setProdutorOptions(
        prodSnap.docs.map((d) => ({
          label: d.data().nome,
          value: d.id,
        }))
      );
      setMovimentacaoOptions(
        movSnap.docs.map((d) => ({
          descricao: d.data().descricao as string,
          tipo: d.data().tipo as string,
        }))
      );
      setDietaOptions(
        dietaSnap.docs
          .filter((d) => d.data().ativo !== false)
          .map((d) => ({
            label: d.data().nome,
            value: d.id,
          }))
      );
      setAllPiqueteOptions(
        piqueteSnap.docs
          .map((d) => ({
            label: d.data().descricao as string,
            value: d.id,
          }))
          .sort((a, b) => {
            const numA = parseInt(a.label.replace(/\D/g, "")) || 0;
            const numB = parseInt(b.label.replace(/\D/g, "")) || 0;
            return numA - numB;
          })
      );
    } catch (error) {
      console.error("Erro ao buscar opções:", error);
    }
  }

  async function fetchLotes() {
    try {
      setLoading(true);
      const lotesSnap = await getDocs(collection(db, "lotes"));
      const data: Lote[] = [];

      for (const loteDoc of lotesSnap.docs) {
        const loteData = loteDoc.data();
        const movSnap = await getDocs(
          collection(db, "lotes", loteDoc.id, "movimentacoes")
        );
        const movimentacoes: Movimentacao[] = movSnap.docs.map((mDoc) => ({
          id: mDoc.id,
          ...mDoc.data(),
        })) as Movimentacao[];

        data.push({
          id: loteDoc.id,
          numero: loteData.numero ?? 0,
          raca: loteData.raca ?? "",
          categoria: loteData.categoria ?? "",
          compensatorio: loteData.compensatorio ?? "",
          implante: loteData.implante ?? "",
          tamanhoCorporal: loteData.tamanhoCorporal ?? "",
          produtor: loteData.produtor ?? "",
          produtorId: loteData.produtorId ?? "",
          gmdEstimado: loteData.gmdEstimado ?? 0,
          ativo: loteData.ativo ?? true,
          dietaId: loteData.dietaId ?? "",
          dietaNome: loteData.dietaNome ?? "",
          piqueteId: loteData.piqueteId ?? "",
          piqueteNome: loteData.piqueteNome ?? "",
          movimentacoes,
        });
      }

      data.sort((a, b) => a.numero - b.numero);
      setLotes(data);
    } catch (error) {
      console.error("Erro ao buscar lotes:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchFinanceiro() {
    try {
      const histSnap = await getDocs(collection(db, "historicoMapaTrato"));
      const map = new Map<string, LancamentoFinanceiro[]>();
      const gmdMap = new Map<string, { data: string; gmdReal: number }[]>();
      for (const hDoc of histSnap.docs) {
        const h = hDoc.data();
        const custoPorLote = h.custoPorLote as { loteId: string; custo: number }[] | undefined;
        if (!custoPorLote || !h.data) continue;

        // Build msPorLote lookup if available (real MS from descarga + percentualMSFinal)
        const msPorLoteData = h.msPorLote as { loteId: string; totalMS: number; gmdReal?: number }[] | undefined;
        const msLookup = new Map<string, number>();
        if (msPorLoteData) {
          for (const ml of msPorLoteData) {
            msLookup.set(ml.loteId, ml.totalMS);
            // Extract gmdReal per lote per day
            if (ml.gmdReal != null && ml.gmdReal > 0) {
              const prev = gmdMap.get(ml.loteId) ?? [];
              prev.push({ data: h.data as string, gmdReal: ml.gmdReal });
              gmdMap.set(ml.loteId, prev);
            }
          }
        }

        for (const cl of custoPorLote) {
          if (!cl.loteId || cl.custo <= 0) continue;
          const prev = map.get(cl.loteId) ?? [];

          // Use real MS per lot if available, otherwise fallback to proportional estimate
          let kgMS: number;
          if (msLookup.has(cl.loteId)) {
            kgMS = msLookup.get(cl.loteId)!;
          } else {
            const totalMS = (h.totalMS as number) ?? 0;
            const custoTotal = (h.custoTotal as number) ?? 0;
            const numLotes = custoPorLote.length;
            const proporcao = custoTotal > 0 ? cl.custo / custoTotal : (numLotes > 0 ? 1 / numLotes : 0);
            kgMS = totalMS * proporcao;
          }

          prev.push({
            data: h.data as string,
            kgMS,
            custoTotal: cl.custo,
          });
          map.set(cl.loteId, prev);
        }
      }
      setLancamentosMap(map);
      setGmdRealMap(gmdMap);
    } catch (error) {
      console.error("Erro ao buscar financeiro:", error);
    }
  }

  function getNextNumero(): number {
    if (lotes.length === 0) return 1;
    return Math.max(...lotes.map((l) => l.numero)) + 1;
  }

  function handleNew() {
    setEditingLote(null);
    setModalVisible(true);
  }

  function handleEdit(lote: Lote) {
    setEditingLote(lote);
    setModalVisible(true);
  }

  function handleDeleteRequest(lote: Lote) {
    setDeleteTarget(lote);
  }

  function handleMovimentacoes(lote: Lote) {
    setMovLote(lote);
    setMovVisible(true);
  }

  function handleFaturamento(lote: Lote) {
    setFatLote(lote);
    setFatVisible(true);
  }

  async function handleSave(data: Omit<Lote, "id" | "movimentacoes">) {
    try {
      if (editingLote) {
        const ref = doc(db, "lotes", editingLote.id);
        await updateDoc(ref, { ...data });
        setLotes((prev) =>
          prev.map((l) =>
            l.id === editingLote.id
              ? { ...l, ...data }
              : l
          )
        );
      } else {
        const docRef = await addDoc(collection(db, "lotes"), data);
        setLotes((prev) =>
          [...prev, { id: docRef.id, ...data, movimentacoes: [] }].sort(
            (a, b) => a.numero - b.numero
          )
        );
      }
      setModalVisible(false);
      setEditingLote(null);
    } catch (error) {
      console.error("Erro ao salvar lote:", error);
      Alert.alert("Erro", "Não foi possível salvar o lote.");
    }
  }

  async function handleAddMovimentacao(
    loteId: string,
    movData: Omit<Movimentacao, "id">
  ) {
    try {
      const docRef = await addDoc(
        collection(db, "lotes", loteId, "movimentacoes"),
        movData
      );
      const newMov: Movimentacao = { id: docRef.id, ...movData };
      setLotes((prev) =>
        prev.map((l) =>
          l.id === loteId
            ? { ...l, movimentacoes: [...l.movimentacoes, newMov] }
            : l
        )
      );
      setMovLote((prev) =>
        prev && prev.id === loteId
          ? { ...prev, movimentacoes: [...prev.movimentacoes, newMov] }
          : prev
      );
    } catch (error) {
      console.error("Erro ao adicionar movimentação:", error);
      Alert.alert("Erro", "Não foi possível adicionar a movimentação.");
    }
  }

  async function handleDeleteMovimentacao(loteId: string, movId: string) {
    try {
      await deleteDoc(doc(db, "lotes", loteId, "movimentacoes", movId));
      setLotes((prev) =>
        prev.map((l) =>
          l.id === loteId
            ? {
              ...l,
              movimentacoes: l.movimentacoes.filter((m) => m.id !== movId),
            }
            : l
        )
      );
      setMovLote((prev) =>
        prev && prev.id === loteId
          ? {
            ...prev,
            movimentacoes: prev.movimentacoes.filter((m) => m.id !== movId),
          }
          : prev
      );
    } catch (error) {
      console.error("Erro ao excluir movimentação:", error);
      Alert.alert("Erro", "Não foi possível excluir a movimentação.");
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    try {
      const movSnap = await getDocs(
        collection(db, "lotes", deleteTarget.id, "movimentacoes")
      );
      for (const movDoc of movSnap.docs) {
        await deleteDoc(
          doc(db, "lotes", deleteTarget.id, "movimentacoes", movDoc.id)
        );
      }
      await deleteDoc(doc(db, "lotes", deleteTarget.id));
      setLotes((prev) => prev.filter((l) => l.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (error) {
      console.error("Erro ao excluir lote:", error);
      Alert.alert("Erro", "Não foi possível excluir o lote.");
    }
  }

  const lotesFiltrados = lotes.filter((l) =>
    filtro === "ativos" ? l.ativo : !l.ativo
  );

  // Piquetes ocupados por outros lotes (excluindo o lote em edição)
  const occupiedPiqueteIds = new Set(
    lotes
      .filter((l) => l.piqueteId && l.id !== editingLote?.id)
      .map((l) => l.piqueteId)
  );
  const availablePiqueteOptions = allPiqueteOptions.filter(
    (p) => !occupiedPiqueteIds.has(p.value)
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
          <View style={[styles.container, isTablet && { maxWidth: maxWidthContent, alignSelf: "center" as const, width: "100%" }]}>
            <View style={styles.header}>
              <Text style={styles.title}>Lotes</Text>
              <DrawerToggleButton tintColor="#000000" />
            </View>

            <Text style={styles.subtitle}>
              Gerencie seus lotes de animais.
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
              <Text style={styles.addButtonLabel}>Novo Lote</Text>
            </TouchableOpacity>

            {loading ? (
              <ActivityIndicator
                size="large"
                color="#3366FF"
                style={{ marginTop: 32 }}
              />
            ) : lotesFiltrados.length === 0 ? (
              <Text style={styles.emptyText}>
                Nenhum lote {filtro === "ativos" ? "ativo" : "inativo"} encontrado.
              </Text>
            ) : (
              <View style={styles.list}>
                {lotesFiltrados.map((lote) => (
                  <LoteCard
                    key={lote.id}
                    lote={lote}
                    gmdRealDiario={gmdRealMap.get(lote.id) ?? []}
                    onEdit={handleEdit}
                    onDelete={handleDeleteRequest}
                    onMovimentacoes={handleMovimentacoes}
                    onFaturamento={handleFaturamento}
                  />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <LoteFormModal
        visible={modalVisible}
        lote={editingLote}
        nextNumero={getNextNumero()}
        racaOptions={racaOptions}
        categoriaOptions={categoriaOptions}
        compensatorioOptions={compensatorioOptions}
        implanteOptions={implanteOptions}
        tamanhoCorporalOptions={tamanhoCorporalOptions}
        produtorOptions={produtorOptions}
        dietaOptions={dietaOptions}
        piqueteOptions={availablePiqueteOptions}
        onSave={handleSave}
        onClose={() => {
          setModalVisible(false);
          setEditingLote(null);
        }}
      />

      <MovimentacaoFormModal
        visible={movVisible}
        lote={movLote}
        movimentacaoOptions={movimentacaoOptions}
        onAddMovimentacao={handleAddMovimentacao}
        onDeleteMovimentacao={handleDeleteMovimentacao}
        onClose={() => {
          setMovVisible(false);
          setMovLote(null);
        }}
      />

      <ConfirmDialog
        visible={!!deleteTarget}
        title="Excluir Lote"
        message={`Deseja realmente excluir o Lote ${deleteTarget?.numero ?? ""}? Esta ação não pode ser desfeita.`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <FaturamentoModal
        visible={fatVisible}
        loteNumero={fatLote?.numero ?? 0}
        lancamentos={fatLote ? lancamentosMap.get(fatLote.id) ?? [] : []}
        onClose={() => {
          setFatVisible(false);
          setFatLote(null);
        }}
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
