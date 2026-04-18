import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DrawerSceneWrapper } from "@/components/drawe-scene-wrapper";
import { DrawerToggleButton } from "@/components/DrawerToggleButton";
import { Input } from "@/components/Input";
import { ALL_MODULOS, Fazenda, ModuloId, useAuth } from "@/contexts/AuthContext";
import { useResponsive } from "@/hooks/useResponsive";
import { createUserOnSecondaryApp } from "@/services/authService";
import {
  addRawDocument,
  deleteRawDocument,
  getCurrentFazendaId,
  getRawCollection,
  setCurrentFazendaId,
  setRawDocument,
  updateRawDocument,
} from "@/services/firestoreService";
import { seedTabelasAuxiliares } from "@/utils/seedTabelasAuxiliares";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type Usuario = {
  id: string;
  nome: string;
  email: string;
  tipo: "admin" | "gestor" | "cliente";
  fazendas: string[];
  modulos: ModuloId[];
};

export default function Signup() {
  const { isTablet, isDesktop, maxWidthContent, containerPadding, titleFontSize, headerPaddingTop } = useResponsive();
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);

  // User form modal
  const [userModalVisible, setUserModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);
  const [formNome, setFormNome] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formSenha, setFormSenha] = useState("");
  const [formTipo, setFormTipo] = useState<"admin" | "gestor" | "cliente">("cliente");
  const [formFazendas, setFormFazendas] = useState<string[]>([]);
  const [formModulos, setFormModulos] = useState<ModuloId[]>([]);
  const [saving, setSaving] = useState(false);

  // Fazenda form modal
  const [fazendaModalVisible, setFazendaModalVisible] = useState(false);
  const [formFazendaNome, setFormFazendaNome] = useState("");
  const [savingFazenda, setSavingFazenda] = useState(false);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "user" | "fazenda";
    id: string;
    nome: string;
  } | null>(null);

  const isAdmin = userProfile?.tipo === "admin";

  useFocusEffect(
    useCallback(() => {
      if (isAdmin) fetchData();
    }, [isAdmin])
  );

  async function fetchData() {
    try {
      setLoading(true);
      const [usersSnap, fazendasSnap] = await Promise.all([
        getRawCollection("usuarios"),
        getRawCollection("fazendas"),
      ]);
      setUsuarios(
        usersSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Usuario)
          .sort((a, b) => a.nome.localeCompare(b.nome))
      );
      setFazendas(
        fazendasSnap.docs
          .map((d) => ({ id: d.id, nome: d.data().nome ?? "" }))
          .sort((a, b) => a.nome.localeCompare(b.nome))
      );
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
    } finally {
      setLoading(false);
    }
  }

  function openNewUser() {
    setEditingUser(null);
    setFormNome("");
    setFormEmail("");
    setFormSenha("");
    setFormTipo("cliente");
    setFormFazendas([]);
    setFormModulos([]);
    setUserModalVisible(true);
  }

  function openEditUser(user: Usuario) {
    setEditingUser(user);
    setFormNome(user.nome);
    setFormEmail(user.email);
    setFormSenha("");
    setFormTipo(user.tipo);
    setFormFazendas(user.fazendas ?? []);
    setFormModulos(user.modulos ?? []);
    setUserModalVisible(true);
  }

  async function handleSaveUser() {
    if (!formNome.trim() || !formEmail.trim()) {
      Alert.alert("Atencao", "Preencha nome e e-mail.");
      return;
    }
    if (!editingUser && !formSenha.trim()) {
      Alert.alert("Atencao", "Preencha a senha para o novo usuario.");
      return;
    }

    setSaving(true);
    try {
      if (editingUser) {
        await updateRawDocument(["usuarios"], editingUser.id, {
          nome: formNome.trim(),
          email: formEmail.trim(),
          tipo: formTipo,
          fazendas: formFazendas,
          modulos: formModulos,
        });
        setUsuarios((prev) =>
          prev.map((u) =>
            u.id === editingUser.id
              ? {
                ...u,
                nome: formNome.trim(),
                email: formEmail.trim(),
                tipo: formTipo,
                fazendas: formFazendas,
                modulos: formModulos,
              }
              : u
          )
        );
      } else {
        const uid = await createUserOnSecondaryApp(
          formEmail.trim(),
          formSenha
        );
        const userData = {
          nome: formNome.trim(),
          email: formEmail.trim(),
          tipo: formTipo,
          fazendas: formFazendas,
          modulos: formModulos,
        };
        await setRawDocument(["usuarios"], uid, userData);
        setUsuarios((prev) =>
          [...prev, { id: uid, ...userData }].sort((a, b) =>
            a.nome.localeCompare(b.nome)
          )
        );
      }
      setUserModalVisible(false);
    } catch (error: any) {
      console.error("Erro ao salvar usuario:", error);
      const msg =
        error?.code === "auth/email-already-in-use"
          ? "Este e-mail ja esta em uso."
          : "Nao foi possivel salvar o usuario.";
      Alert.alert("Erro", msg);
    } finally {
      setSaving(false);
    }
  }

  function toggleFazenda(fazendaId: string) {
    setFormFazendas((prev) =>
      prev.includes(fazendaId)
        ? prev.filter((id) => id !== fazendaId)
        : [...prev, fazendaId]
    );
  }

  function toggleModulo(moduloId: ModuloId) {
    setFormModulos((prev) =>
      prev.includes(moduloId)
        ? prev.filter((id) => id !== moduloId)
        : [...prev, moduloId]
    );
  }

  function openNewFazenda() {
    setFormFazendaNome("");
    setFazendaModalVisible(true);
  }

  async function handleSaveFazenda() {
    if (!formFazendaNome.trim()) {
      Alert.alert("Atencao", "Preencha o nome da fazenda.");
      return;
    }
    setSavingFazenda(true);
    try {
      const docRef = await addRawDocument(["fazendas"], {
        nome: formFazendaNome.trim(),
      });
      // Semear tabelas auxiliares na nova fazenda
      const previousFazendaId = getCurrentFazendaId();
      setCurrentFazendaId(docRef.id);
      await seedTabelasAuxiliares();
      setCurrentFazendaId(previousFazendaId);

      const newFazenda: Fazenda = {
        id: docRef.id,
        nome: formFazendaNome.trim(),
      };
      setFazendas((prev) =>
        [...prev, newFazenda].sort((a, b) => a.nome.localeCompare(b.nome))
      );
      setFazendaModalVisible(false);
      Alert.alert(
        "Fazenda criada",
        `"${formFazendaNome.trim()}" foi criada com as tabelas auxiliares.`
      );
    } catch (error) {
      console.error("Erro ao criar fazenda:", error);
      Alert.alert("Erro", "Nao foi possivel criar a fazenda.");
    } finally {
      setSavingFazenda(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === "user") {
        await deleteRawDocument(["usuarios"], deleteTarget.id);
        setUsuarios((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      } else {
        await deleteRawDocument(["fazendas"], deleteTarget.id);
        setFazendas((prev) => prev.filter((f) => f.id !== deleteTarget.id));
      }
    } catch (error) {
      console.error("Erro ao excluir:", error);
      Alert.alert("Erro", "Nao foi possivel excluir.");
    } finally {
      setDeleteTarget(null);
    }
  }

  if (!isAdmin) {
    return (
      <DrawerSceneWrapper>
        <View
          style={[
            styles.container,
            { justifyContent: "center", alignItems: "center" },
          ]}
        >
          <Feather name="lock" size={48} color="#999" />
          <Text style={{ fontSize: 18, color: "#999", marginTop: 16 }}>
            Acesso restrito a administradores.
          </Text>
        </View>
      </DrawerSceneWrapper>
    );
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
              <Text style={[styles.title, { fontSize: titleFontSize, flex: 1 }]} numberOfLines={1}>Gestao</Text>
              {!isDesktop && <DrawerToggleButton tintColor="#000000" />}
            </View>
            <Text style={styles.subtitle}>
              Gerencie usuarios e fazendas.
            </Text>

            {loading ? (
              <ActivityIndicator
                size="large"
                color="#3366FF"
                style={{ marginTop: 32 }}
              />
            ) : (
              <>
                {/* Fazendas */}
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Fazendas</Text>
                    <TouchableOpacity
                      style={styles.addBtn}
                      activeOpacity={0.8}
                      onPress={openNewFazenda}
                    >
                      <Feather name="plus" size={16} color="#FFF" />
                      <Text style={styles.addBtnText}>Nova</Text>
                    </TouchableOpacity>
                  </View>
                  {fazendas.length === 0 ? (
                    <Text style={styles.emptyText}>Nenhuma fazenda.</Text>
                  ) : (
                    fazendas.map((f) => (
                      <View key={f.id} style={styles.itemRow}>
                        <View style={styles.itemInfo}>
                          <Feather name="map-pin" size={16} color="#3366FF" />
                          <Text style={styles.itemName}>{f.nome}</Text>
                        </View>
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() =>
                            setDeleteTarget({
                              type: "fazenda",
                              id: f.id,
                              nome: f.nome,
                            })
                          }
                        >
                          <Feather name="trash-2" size={16} color="#E53935" />
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </View>

                {/* Usuarios */}
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Usuarios</Text>
                    <TouchableOpacity
                      style={styles.addBtn}
                      activeOpacity={0.8}
                      onPress={openNewUser}
                    >
                      <Feather name="plus" size={16} color="#FFF" />
                      <Text style={styles.addBtnText}>Novo</Text>
                    </TouchableOpacity>
                  </View>
                  {usuarios.length === 0 ? (
                    <Text style={styles.emptyText}>Nenhum usuario.</Text>
                  ) : (
                    usuarios.map((u) => (
                      <View key={u.id} style={styles.itemRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.itemName}>{u.nome}</Text>
                          <Text style={styles.itemDetail}>
                            {u.email} · {u.tipo}
                          </Text>
                          <Text style={styles.itemDetail}>
                            Fazendas:{" "}
                            {u.fazendas
                              ?.map(
                                (fId) =>
                                  fazendas.find((f) => f.id === fId)?.nome ??
                                  fId
                              )
                              .join(", ") || "Nenhuma"}
                          </Text>
                          <Text style={styles.itemDetail}>
                            Modulos:{" "}
                            {u.modulos?.length
                              ? u.modulos
                                  .map((m) =>
                                    m === "iconfi" ? "iConfi" : m === "ifarm" ? "iFarm" : "Abastecimento"
                                  )
                                  .join(", ")
                              : "Nenhum"}
                          </Text>
                        </View>
                        <View style={{ flexDirection: "row", gap: 12 }}>
                          <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => openEditUser(u)}
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
                                type: "user",
                                id: u.id,
                                nome: u.nome,
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
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* User Form Modal */}
      <Modal
        visible={userModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setUserModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalKeyboard}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingUser ? "Editar Usuario" : "Novo Usuario"}
                </Text>
                <TouchableOpacity
                  onPress={() => setUserModalVisible(false)}
                  activeOpacity={0.7}
                >
                  <Feather name="x" size={24} color="#666" />
                </TouchableOpacity>
              </View>
              <ScrollView
                style={{ flexGrow: 0 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.modalForm}>
                  <Text style={styles.label}>Nome *</Text>
                  <Input
                    placeholder="Nome"
                    value={formNome}
                    onChangeText={setFormNome}
                  />

                  <Text style={styles.label}>E-mail *</Text>
                  <Input
                    placeholder="E-mail"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={formEmail}
                    onChangeText={setFormEmail}
                    editable={!editingUser}
                  />

                  {!editingUser && (
                    <>
                      <Text style={styles.label}>Senha *</Text>
                      <Input
                        placeholder="Senha"
                        secureTextEntry
                        value={formSenha}
                        onChangeText={setFormSenha}
                      />
                    </>
                  )}

                  <Text style={styles.label}>Tipo</Text>
                  <View style={styles.toggleRow}>
                    {(["cliente", "gestor", "admin"] as const).map((t) => (
                      <TouchableOpacity
                        key={t}
                        style={[
                          styles.toggleButton,
                          formTipo === t && styles.toggleActive,
                        ]}
                        activeOpacity={0.8}
                        onPress={() => setFormTipo(t)}
                      >
                        <Text
                          style={[
                            styles.toggleText,
                            formTipo === t && styles.toggleTextActive,
                          ]}
                        >
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.label}>Fazendas</Text>
                  {fazendas.map((f) => (
                    <TouchableOpacity
                      key={f.id}
                      style={styles.checkRow}
                      activeOpacity={0.7}
                      onPress={() => toggleFazenda(f.id)}
                    >
                      <Feather
                        name={
                          formFazendas.includes(f.id)
                            ? "check-square"
                            : "square"
                        }
                        size={18}
                        color={
                          formFazendas.includes(f.id) ? "#3366FF" : "#999"
                        }
                      />
                      <Text style={styles.checkLabel}>{f.nome}</Text>
                    </TouchableOpacity>
                  ))}

                  <Text style={styles.label}>Modulos</Text>
                  {ALL_MODULOS.map((moduloId) => {
                    const labels: Record<ModuloId, string> = {
                      iconfi: "iConfi - Confinamento",
                      ifarm: "iFarm - Rebanho e Rastreabilidade",
                      abastecimento: "Abastecimento - Combustivel",
                    };
                    return (
                      <TouchableOpacity
                        key={moduloId}
                        style={styles.checkRow}
                        activeOpacity={0.7}
                        onPress={() => toggleModulo(moduloId)}
                      >
                        <Feather
                          name={
                            formModulos.includes(moduloId)
                              ? "check-square"
                              : "square"
                          }
                          size={18}
                          color={
                            formModulos.includes(moduloId) ? "#3366FF" : "#999"
                          }
                        />
                        <Text style={styles.checkLabel}>{labels[moduloId]}</Text>
                      </TouchableOpacity>
                    );
                  })}

                  <View style={{ marginTop: 16 }}>
                    {saving ? (
                      <ActivityIndicator size="large" color="#3366FF" />
                    ) : (
                      <Button
                        label={editingUser ? "Salvar" : "Cadastrar"}
                        onPress={handleSaveUser}
                      />
                    )}
                  </View>
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Fazenda Form Modal */}
      <Modal
        visible={fazendaModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFazendaModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalKeyboard}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Nova Fazenda</Text>
                <TouchableOpacity
                  onPress={() => setFazendaModalVisible(false)}
                  activeOpacity={0.7}
                >
                  <Feather name="x" size={24} color="#666" />
                </TouchableOpacity>
              </View>
              <View style={styles.modalForm}>
                <Text style={styles.label}>Nome da Fazenda *</Text>
                <Input
                  placeholder="Ex: Fazenda Santa Maria"
                  value={formFazendaNome}
                  onChangeText={setFormFazendaNome}
                />
                <View style={{ marginTop: 16 }}>
                  {savingFazenda ? (
                    <ActivityIndicator size="large" color="#3366FF" />
                  ) : (
                    <Button
                      label="Criar Fazenda"
                      onPress={handleSaveFazenda}
                    />
                  )}
                </View>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ConfirmDialog
        visible={!!deleteTarget}
        title={`Excluir ${deleteTarget?.type === "user" ? "Usuario" : "Fazenda"}`}
        message={`Deseja excluir "${deleteTarget?.nome ?? ""}"?`}
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
  section: {
    marginTop: 32,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#3366FF",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
  },
  emptyText: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    paddingVertical: 16,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  itemInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  itemName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  itemDetail: {
    fontSize: 12,
    color: "#888",
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  modalKeyboard: {
    maxHeight: "90%",
    width: "100%",
    maxWidth: 560,
  },
  modalCard: {
    backgroundColor: "#FDFDFD",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 24,
    maxHeight: "100%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  modalForm: {
    gap: 6,
    paddingBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#444",
    marginTop: 6,
  },
  toggleRow: {
    flexDirection: "row",
    gap: 8,
  },
  toggleButton: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#DCDCDC",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF",
  },
  toggleActive: {
    backgroundColor: "#3366FF",
    borderColor: "#3366FF",
  },
  toggleText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
  },
  toggleTextActive: {
    color: "#FFF",
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  checkLabel: {
    fontSize: 14,
    color: "#1a1a1a",
  },
});
