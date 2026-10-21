import { CompraFormModal } from "@/components/CompraFormModal";
import { ConferenciaMSDados, ConferenciaMSModal } from "@/components/ConferenciaMSModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DrawerSceneWrapper } from "@/components/drawe-scene-wrapper";
import { DrawerToggleButton } from "@/components/DrawerToggleButton";
import {
  Compra,
  ConferenciaMS,
  Insumo,
  InsumoCard,
  Saida,
} from "@/components/InsumoCard";
import { InsumoFormModal } from "@/components/InsumoFormModal";
import { useTheme } from "@/contexts/ThemeContext";
import { useResponsive } from "@/hooks/useResponsive";
import Aviso from "@/services/alerta";
import {
  addDocument,
  deleteDocument,
  getCollection,
  setDocument,
  updateDocument,
} from "@/services/firestoreService";
import { msVigente } from "@/utils/materiaSecaCalc";
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

export default function Insumos() {
  const { primaryColor } = useTheme();
  const { isTablet, isDesktop, maxWidthContent, containerPadding, titleFontSize, headerPaddingTop } = useResponsive();
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);

  const [formVisible, setFormVisible] = useState(false);
  const [editingInsumo, setEditingInsumo] = useState<Insumo | null>(null);

  const [compraVisible, setCompraVisible] = useState(false);
  const [compraInsumo, setCompraInsumo] = useState<Insumo | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Insumo | null>(null);

  const [conferenciaVisible, setConferenciaVisible] = useState(false);
  const [conferenciaInsumo, setConferenciaInsumo] = useState<Insumo | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchInsumos();
    }, [])
  );

  async function fetchInsumos() {
    try {
      setLoading(true);
      const insumosSnap = await getCollection("insumos");
      const data: Insumo[] = [];

      for (const insumoDoc of insumosSnap.docs) {
        const insumoData = insumoDoc.data();
        const [comprasSnap, saidasSnap, conferenciasSnap] = await Promise.all([
          getCollection("insumos", insumoDoc.id, "compras"),
          getCollection("insumos", insumoDoc.id, "saidas"),
          getCollection("insumos", insumoDoc.id, "conferencias"),
        ]);
        const compras: Compra[] = comprasSnap.docs.map((cDoc) => ({
          id: cDoc.id,
          ...cDoc.data(),
        })) as Compra[];
        const saidas: Saida[] = saidasSnap.docs.map((sDoc) => ({
          id: sDoc.id,
          ...sDoc.data(),
        })) as Saida[];
        const conferencias: ConferenciaMS[] = conferenciasSnap.docs.map((cDoc) => ({
          id: cDoc.id,
          ...cDoc.data(),
        })) as ConferenciaMS[];

        data.push({
          id: insumoDoc.id,
          nome: insumoData.nome ?? "",
          percentualMateriaSeca: insumoData.percentualMateriaSeca ?? 0,
          materiaSecaVariavel: insumoData.materiaSecaVariavel ?? false,
          autonomiaMinimaDias: insumoData.autonomiaMinimaDias,
          compras,
          saidas,
          conferencias,
        });
      }

      data.sort((a, b) => a.nome.localeCompare(b.nome));
      setInsumos(data);
    } catch (error) {
      console.error("Erro ao buscar insumos:", error);
    } finally {
      setLoading(false);
    }
  }

  function handleNew() {
    setEditingInsumo(null);
    setFormVisible(true);
  }

  function handleEdit(insumo: Insumo) {
    setEditingInsumo(insumo);
    setFormVisible(true);
  }

  function handleDeleteRequest(insumo: Insumo) {
    setDeleteTarget(insumo);
  }

  function handleCompras(insumo: Insumo) {
    setCompraInsumo(insumo);
    setCompraVisible(true);
  }

  async function handleSave(data: Omit<Insumo, "id" | "compras" | "saidas" | "conferencias">) {
    try {
      if (editingInsumo) {
        await updateDocument(["insumos"], editingInsumo.id, { ...data });

        // Sincronizar nome do insumo nas dietas que o referenciam
        if (data.nome !== editingInsumo.nome) {
          const dietasSnap = await getCollection("dietas");
          for (const dietaDoc of dietasSnap.docs) {
            const dietaData = dietaDoc.data();
            const dietaInsumos: { insumoId: string; insumoNome: string; percentual: number }[] =
              dietaData.insumos ?? [];
            const hasInsumo = dietaInsumos.some(
              (di) => di.insumoId === editingInsumo.id
            );
            if (hasInsumo) {
              const updatedInsumos = dietaInsumos.map((di) =>
                di.insumoId === editingInsumo.id
                  ? { ...di, insumoNome: data.nome }
                  : di
              );
              await updateDocument(["dietas"], dietaDoc.id, {
                insumos: updatedInsumos,
              });
            }
          }
        }

        setInsumos((prev) =>
          prev.map((i) =>
            i.id === editingInsumo.id ? { ...i, ...data } : i
          )
        );
      } else {
        const docRef = await addDocument(["insumos"], data);
        setInsumos((prev) =>
          [...prev, { id: docRef.id, ...data, compras: [], saidas: [], conferencias: [] }].sort((a, b) =>
            a.nome.localeCompare(b.nome)
          )
        );
      }
      setFormVisible(false);
      setEditingInsumo(null);
    } catch (error) {
      console.error("Erro ao salvar insumo:", error);
      Alert.alert("Erro", "Não foi possível salvar o insumo.");
    }
  }

  async function handleAddCompra(
    insumoId: string,
    compraData: Omit<Compra, "id">
  ) {
    try {
      const docRef = await addDocument(
        ["insumos", insumoId, "compras"],
        compraData
      );
      const newCompra: Compra = { id: docRef.id, ...compraData };
      setInsumos((prev) =>
        prev.map((i) =>
          i.id === insumoId
            ? { ...i, compras: [...i.compras, newCompra] }
            : i
        )
      );
      setCompraInsumo((prev) =>
        prev && prev.id === insumoId
          ? { ...prev, compras: [...prev.compras, newCompra] }
          : prev
      );
    } catch (error) {
      console.error("Erro ao adicionar compra:", error);
      Alert.alert("Erro", "Não foi possível adicionar a compra.");
    }
  }

  async function handleDeleteCompra(insumoId: string, compraId: string) {
    try {
      await deleteDocument(["insumos", insumoId, "compras"], compraId);
      setInsumos((prev) =>
        prev.map((i) =>
          i.id === insumoId
            ? { ...i, compras: i.compras.filter((c) => c.id !== compraId) }
            : i
        )
      );
      setCompraInsumo((prev) =>
        prev && prev.id === insumoId
          ? { ...prev, compras: prev.compras.filter((c) => c.id !== compraId) }
          : prev
      );
    } catch (error) {
      console.error("Erro ao excluir compra:", error);
      Alert.alert("Erro", "Não foi possível excluir a compra.");
    }
  }

  function handleConferencias(insumo: Insumo) {
    setConferenciaInsumo(insumo);
    setConferenciaVisible(true);
  }

  /**
   * Aplica a nova lista de conferências de um insumo: recalcula a MS vigente
   * (conferência finalizada de data mais recente), grava no Firestore quando
   * mudou e sincroniza o estado da tela e do modal.
   */
  async function aplicarConferencias(insumoId: string, conferencias: ConferenciaMS[]) {
    const insumoAtual = insumos.find((i) => i.id === insumoId);
    const vigente = msVigente(conferencias);
    const novaMS = vigente ?? insumoAtual?.percentualMateriaSeca ?? 0;

    if (insumoAtual && novaMS !== insumoAtual.percentualMateriaSeca) {
      await updateDocument(["insumos"], insumoId, { percentualMateriaSeca: novaMS });
    }

    const atualizar = (i: Insumo): Insumo =>
      i.id === insumoId ? { ...i, percentualMateriaSeca: novaMS, conferencias } : i;
    setInsumos((prev) => prev.map(atualizar));
    setConferenciaInsumo((prev) => (prev && prev.id === insumoId ? atualizar(prev) : prev));
  }

  async function handleAddConferencia(insumoId: string, confData: ConferenciaMSDados) {
    try {
      const docRef = await addDocument(["insumos", insumoId, "conferencias"], confData);
      const newConf: ConferenciaMS = { id: docRef.id, ...confData };
      const insumoAtual = insumos.find((i) => i.id === insumoId);
      await aplicarConferencias(insumoId, [...(insumoAtual?.conferencias ?? []), newConf]);
    } catch (error) {
      console.error("Erro ao adicionar conferência:", error);
      Aviso.alert("Erro", "Não foi possível adicionar a conferência.");
    }
  }

  async function handleUpdateConferencia(
    insumoId: string,
    conferenciaId: string,
    confData: ConferenciaMSDados
  ) {
    try {
      // setDocument sem merge: a conferência é regravada por inteiro, para que
      // campos removidos (ex.: observação apagada) não fiquem para trás.
      await setDocument(["insumos", insumoId, "conferencias"], conferenciaId, confData);
      const insumoAtual = insumos.find((i) => i.id === insumoId);
      const conferencias = (insumoAtual?.conferencias ?? []).map((c) =>
        c.id === conferenciaId ? { id: conferenciaId, ...confData } : c
      );
      await aplicarConferencias(insumoId, conferencias);
    } catch (error) {
      console.error("Erro ao atualizar conferência:", error);
      Aviso.alert("Erro", "Não foi possível atualizar a conferência.");
    }
  }

  async function handleDeleteConferencia(insumoId: string, conferenciaId: string) {
    try {
      await deleteDocument(["insumos", insumoId, "conferencias"], conferenciaId);
      const insumoAtual = insumos.find((i) => i.id === insumoId);
      const restantes = (insumoAtual?.conferencias ?? []).filter((c) => c.id !== conferenciaId);
      // Sem conferência finalizada restante, aplicarConferencias mantém a MS atual.
      await aplicarConferencias(insumoId, restantes);
    } catch (error) {
      console.error("Erro ao excluir conferência:", error);
      Aviso.alert("Erro", "Não foi possível excluir a conferência.");
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    try {
      for (const sub of ["compras", "saidas", "conferencias"]) {
        const snap = await getCollection("insumos", deleteTarget.id, sub);
        for (const doc of snap.docs) {
          await deleteDocument(["insumos", deleteTarget.id, sub], doc.id);
        }
      }
      await deleteDocument(["insumos"], deleteTarget.id);
      setInsumos((prev) => prev.filter((i) => i.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (error) {
      console.error("Erro ao excluir insumo:", error);
      Alert.alert("Erro", "Não foi possível excluir o insumo.");
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
          <View style={[styles.container, { padding: containerPadding }, isTablet && !isDesktop && { maxWidth: maxWidthContent, alignSelf: "center" as const, width: "100%" }]}>
            <View style={[styles.header, { paddingTop: headerPaddingTop }]}>
              <Text style={[styles.title, { fontSize: titleFontSize, flex: 1 }]} numberOfLines={1}>Insumos</Text>
              {!isDesktop && <DrawerToggleButton tintColor="#000000" />}
            </View>

            <Text style={styles.subtitle}>
              Gerencie seus insumos e compras.
            </Text>

            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: primaryColor }]}
              activeOpacity={0.8}
              onPress={handleNew}
            >
              <Feather name="plus" size={20} color="#FFF" />
              <Text style={styles.addButtonLabel}>Novo Insumo</Text>
            </TouchableOpacity>

            {loading ? (
              <ActivityIndicator
                size="large"
                color={primaryColor}
                style={{ marginTop: 32 }}
              />
            ) : insumos.length === 0 ? (
              <Text style={styles.emptyText}>
                Nenhum insumo encontrado.
              </Text>
            ) : (
              <View style={styles.list}>
                {insumos.map((insumo) => (
                  <InsumoCard
                    key={insumo.id}
                    insumo={insumo}
                    onEdit={handleEdit}
                    onDelete={handleDeleteRequest}
                    onCompras={handleCompras}
                    onConferencias={handleConferencias}
                  />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <InsumoFormModal
        visible={formVisible}
        insumo={editingInsumo}
        onSave={handleSave}
        onClose={() => {
          setFormVisible(false);
          setEditingInsumo(null);
        }}
      />

      <CompraFormModal
        visible={compraVisible}
        insumo={compraInsumo}
        onAddCompra={handleAddCompra}
        onDeleteCompra={handleDeleteCompra}
        onClose={() => {
          setCompraVisible(false);
          setCompraInsumo(null);
        }}
      />

      <ConferenciaMSModal
        visible={conferenciaVisible}
        insumo={conferenciaInsumo}
        onAddConferencia={handleAddConferencia}
        onUpdateConferencia={handleUpdateConferencia}
        onDeleteConferencia={handleDeleteConferencia}
        onClose={() => {
          setConferenciaVisible(false);
          setConferenciaInsumo(null);
        }}
      />

      <ConfirmDialog
        visible={!!deleteTarget}
        title="Excluir Insumo"
        message={`Deseja realmente excluir o insumo "${deleteTarget?.nome ?? ""}"? Compras, saídas e conferências de MS associadas também serão excluídas.`}
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
