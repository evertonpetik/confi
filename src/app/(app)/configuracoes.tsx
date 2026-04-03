import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DrawerSceneWrapper } from "@/components/drawe-scene-wrapper";
import { DrawerToggleButton } from "@/components/DrawerToggleButton";
import {
  CampoSchema,
  TabelaAuxiliarFormModal,
} from "@/components/TabelaAuxiliarFormModal";
import { useAuth } from "@/contexts/AuthContext";
import { useResponsive } from "@/hooks/useResponsive";
import {
  addDocument,
  deleteDocument,
  getCollection,
  updateDocument,
} from "@/services/firestoreService";
import { prefetchAllData } from "@/utils/prefetchFirestore";
import { seedTabelasAuxiliares } from "@/utils/seedTabelasAuxiliares";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
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

// ---- Schema definitions for each auxiliary table ----

type TabelaConfig = {
  nome: string;
  colecao: string;
  campos: CampoSchema[];
};

const TABELAS: TabelaConfig[] = [

  {
    nome: "Piquetes",
    colecao: "piquetes",
    campos: [
      { key: "descricao", label: "Descricao", tipo: "texto" },
      { key: "capacidade", label: "Capacidade", tipo: "numero" },
    ],
  },
  {
    nome: "Vagao",
    colecao: "vagao",
    campos: [
      { key: "descricao", label: "Descricao", tipo: "texto" },
      { key: "capacidade", label: "Capacidade (kg)", tipo: "numero" },
    ],
  },
  {
    nome: "Nota de Leitura",
    colecao: "notaLeitura",
    campos: [
      { key: "descricao", label: "Descricao", tipo: "texto" },
      { key: "fator", label: "Fator", tipo: "numero" },
    ],
  },
  {
    nome: "Parametros",
    colecao: "parametros",
    campos: [
      { key: "descricao", label: "Parametro", tipo: "texto" },
      { key: "valor", label: "Valor", tipo: "numero" },
    ],
  },
];

type ItemAux = { id: string } & Record<string, string | number>;

export default function Configuracoes() {
  const { isTablet, isDesktop, maxWidthContent } = useResponsive();
  const { selectedFazendaId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState("");
  const [lastSync, setLastSync] = useState<string | null>(null);

  // Data per table: colecao -> items[]
  const [dados, setDados] = useState<Map<string, ItemAux[]>>(new Map());

  // Expanded table sections
  const [expandido, setExpandido] = useState<Set<string>>(new Set());

  // Form modal
  const [formModal, setFormModal] = useState<{
    visible: boolean;
    tabela: TabelaConfig | null;
    item: ItemAux | null;
  }>({ visible: false, tabela: null, item: null });

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<{
    colecao: string;
    id: string;
    descricao: string;
  } | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchAllTables();
      loadLastSync();
    }, [])
  );

  async function fetchAllTables() {
    try {
      setLoadingData(true);
      const newDados = new Map<string, ItemAux[]>();
      const promises = TABELAS.map(async (t) => {
        const snap = await getCollection(t.colecao);
        const items: ItemAux[] = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as ItemAux[];
        items.sort((a, b) =>
          String(a.descricao ?? "").localeCompare(String(b.descricao ?? ""))
        );
        newDados.set(t.colecao, items);
      });
      await Promise.all(promises);
      setDados(newDados);
    } catch (error) {
      console.error("Erro ao buscar tabelas:", error);
    } finally {
      setLoadingData(false);
    }
  }

  async function loadLastSync() {
    try {
      const ts = await AsyncStorage.getItem(`@lastSync:${selectedFazendaId}`);
      setLastSync(ts);
    } catch { /* ignore */ }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncProgress("Iniciando sincronizacao...");
    try {
      await prefetchAllData((msg, _pct) => setSyncProgress(msg));
      const now = new Date().toLocaleString("pt-BR");
      await AsyncStorage.setItem(`@lastSync:${selectedFazendaId}`, now);
      setLastSync(now);
      Alert.alert("Sincronizacao", "Todos os dados foram sincronizados para uso offline.");
    } catch (error) {
      console.error("Erro ao sincronizar:", error);
      Alert.alert("Erro", "Nao foi possivel sincronizar os dados.");
    } finally {
      setSyncing(false);
      setSyncProgress("");
    }
  }

  async function handleSeedTabelasAuxiliares() {
    setLoading(true);
    try {
      const resultado = await seedTabelasAuxiliares();
      Alert.alert("Tabelas Auxiliares", resultado);
      await fetchAllTables();
    } catch {
      Alert.alert("Erro", "Nao foi possivel criar as tabelas auxiliares.");
    } finally {
      setLoading(false);
    }
  }

  function toggleExpandido(colecao: string) {
    setExpandido((prev) => {
      const next = new Set(prev);
      if (next.has(colecao)) next.delete(colecao);
      else next.add(colecao);
      return next;
    });
  }

  function openAdd(tabela: TabelaConfig) {
    setFormModal({ visible: true, tabela, item: null });
  }

  function openEdit(tabela: TabelaConfig, item: ItemAux) {
    setFormModal({ visible: true, tabela, item });
  }

  async function handleSaveItem(data: Record<string, string | number>) {
    const tabela = formModal.tabela;
    if (!tabela) return;

    try {
      if (formModal.item) {
        // Update
        await updateDocument([tabela.colecao], formModal.item.id, data);
        setDados((prev) => {
          const next = new Map(prev);
          const items = (next.get(tabela.colecao) ?? []).map((it) =>
            it.id === formModal.item!.id ? { ...it, ...data } : it
          );
          next.set(tabela.colecao, items);
          return next;
        });
      } else {
        // Add
        const docRef = await addDocument([tabela.colecao], data);
        setDados((prev) => {
          const next = new Map(prev);
          const items = [...(next.get(tabela.colecao) ?? []), { id: docRef.id, ...data }];
          items.sort((a, b) =>
            String(a.descricao ?? "").localeCompare(String(b.descricao ?? ""))
          );
          next.set(tabela.colecao, items);
          return next;
        });
      }
      setFormModal({ visible: false, tabela: null, item: null });
    } catch (error) {
      console.error("Erro ao salvar:", error);
      Alert.alert("Erro", "Nao foi possivel salvar o registro.");
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    try {
      await deleteDocument([deleteTarget.colecao], deleteTarget.id);
      setDados((prev) => {
        const next = new Map(prev);
        const items = (next.get(deleteTarget.colecao) ?? []).filter(
          (it) => it.id !== deleteTarget.id
        );
        next.set(deleteTarget.colecao, items);
        return next;
      });
    } catch (error) {
      console.error("Erro ao excluir:", error);
      Alert.alert("Erro", "Nao foi possivel excluir o registro.");
    } finally {
      setDeleteTarget(null);
    }
  }

  function renderItemFields(tabela: TabelaConfig, item: ItemAux) {
    return tabela.campos
      .filter((c) => c.key !== "descricao")
      .map((c) => (
        <Text key={c.key} style={styles.itemField}>
          {c.label}: {String(item[c.key] ?? "-")}
        </Text>
      ));
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
              <Text style={styles.title}>Configuracoes</Text>
              {!isDesktop && <DrawerToggleButton tintColor="#000000" />}
            </View>

            <Text style={styles.subtitle}>
              Gerencie as tabelas auxiliares do sistema.
            </Text>



            {/* Sync button */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Sincronizacao Offline</Text>
              <Text style={styles.sectionDescription}>
                Baixa todos os dados para uso offline. Execute quando tiver conexao com a internet.
              </Text>
              {lastSync && (
                <Text style={styles.lastSyncText}>
                  Ultima sincronizacao: {lastSync}
                </Text>
              )}
              {syncing ? (
                <View style={{ alignItems: "center", marginTop: 12, gap: 8 }}>
                  <ActivityIndicator size="large" color="#3366FF" />
                  <Text style={styles.syncProgressText}>{syncProgress}</Text>
                </View>
              ) : (
                <Button label="Sincronizar Dados" onPress={handleSync} />
              )}
            </View>

            {/* Tables list */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tabelas Auxiliares</Text>

              {loadingData ? (
                <ActivityIndicator
                  size="large"
                  color="#3366FF"
                  style={{ marginTop: 16 }}
                />
              ) : (
                <View style={styles.tablesList}>
                  {TABELAS.map((tabela) => {
                    const items = dados.get(tabela.colecao) ?? [];
                    const isOpen = expandido.has(tabela.colecao);

                    return (
                      <View key={tabela.colecao} style={styles.tableCard}>
                        <TouchableOpacity
                          style={styles.tableCardHeader}
                          activeOpacity={0.7}
                          onPress={() => toggleExpandido(tabela.colecao)}
                        >
                          <View style={styles.tableCardHeaderLeft}>
                            <Feather
                              name={isOpen ? "chevron-down" : "chevron-right"}
                              size={18}
                              color="#666"
                            />
                            <Text style={styles.tableCardTitle}>
                              {tabela.nome}
                            </Text>
                          </View>
                          <View style={styles.tableCardBadge}>
                            <Text style={styles.tableCardBadgeText}>
                              {items.length}
                            </Text>
                          </View>
                        </TouchableOpacity>

                        {isOpen && (
                          <View style={styles.tableCardBody}>
                            {/* Add button */}
                            <TouchableOpacity
                              style={styles.addItemButton}
                              activeOpacity={0.8}
                              onPress={() => openAdd(tabela)}
                            >
                              <Feather name="plus" size={16} color="#3366FF" />
                              <Text style={styles.addItemText}>
                                Adicionar
                              </Text>
                            </TouchableOpacity>

                            {items.length === 0 ? (
                              <Text style={styles.emptyText}>
                                Nenhum registro encontrado.
                              </Text>
                            ) : (
                              items.map((item) => (
                                <View key={item.id} style={styles.itemRow}>
                                  <View style={styles.itemInfo}>
                                    <Text style={styles.itemDescricao}>
                                      {String(item.descricao ?? "-")}
                                    </Text>
                                    {renderItemFields(tabela, item)}
                                  </View>
                                  <View style={styles.itemActions}>
                                    <TouchableOpacity
                                      activeOpacity={0.7}
                                      onPress={() => openEdit(tabela, item)}
                                    >
                                      <Feather
                                        name="edit-2"
                                        size={16}
                                        color="#3366FF"
                                      />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                      activeOpacity={0.7}
                                      onPress={() =>
                                        setDeleteTarget({
                                          colecao: tabela.colecao,
                                          id: item.id,
                                          descricao: String(
                                            item.descricao ?? ""
                                          ),
                                        })
                                      }
                                    >
                                      <Feather
                                        name="trash-2"
                                        size={16}
                                        color="#E53935"
                                      />
                                    </TouchableOpacity>
                                  </View>
                                </View>
                              ))
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Form Modal */}
      {formModal.visible && formModal.tabela && (
        <TabelaAuxiliarFormModal
          visible
          tabelaNome={formModal.tabela.nome}
          campos={formModal.tabela.campos}
          item={formModal.item}
          onSave={handleSaveItem}
          onClose={() =>
            setFormModal({ visible: false, tabela: null, item: null })
          }
        />
      )}

      {/* Confirm Delete */}
      <ConfirmDialog
        visible={!!deleteTarget}
        title="Excluir Registro"
        message={`Deseja excluir "${deleteTarget?.descricao ?? ""}"? Essa acao nao pode ser desfeita.`}
        onConfirm={handleDeleteConfirm}
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
  section: {
    marginTop: 32,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  sectionDescription: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
  tablesList: {
    gap: 12,
  },
  tableCard: {
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    overflow: "hidden",
  },
  tableCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  tableCardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tableCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  tableCardBadge: {
    backgroundColor: "#3366FF",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tableCardBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFF",
  },
  tableCardBody: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  addItemButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
    paddingVertical: 6,
  },
  addItemText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3366FF",
  },
  emptyText: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    paddingVertical: 12,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
  },
  itemInfo: {
    flex: 1,
  },
  itemDescricao: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  itemField: {
    fontSize: 12,
    color: "#888",
    marginTop: 1,
  },
  itemActions: {
    flexDirection: "row",
    gap: 16,
    marginLeft: 12,
  },
  lastSyncText: {
    fontSize: 13,
    color: "#888",
    fontStyle: "italic",
  },
  syncProgressText: {
    fontSize: 13,
    color: "#3366FF",
    textAlign: "center",
  },
});
