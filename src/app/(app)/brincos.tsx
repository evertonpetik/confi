import { useAuth } from "@/contexts/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import BrincoService, {
  brincoByIndex,
  calcularTotalBrincos,
  controleFromBrinco,
} from "../../services/brincoService";
import { LocalAnimal, PedidoBrinco, RegimeAnimal } from "../../services/weighing.types";

// ─── Constantes ───────────────────────────────────────────────────────────────

const FABRICAS = ["Animalltag", "Zee Tags", "Allflex", "Datamars", "Outra"];

const TIPOS_LOCAL = [
  { value: "piquete", label: "Piquete" },
  { value: "baia", label: "Baia" },
  { value: "curral", label: "Curral" },
  { value: "pasto", label: "Pasto" },
  { value: "outro", label: "Outro" },
] as const;

const REGIMES = [
  { value: RegimeAnimal.PASTO, label: "Pasto" },
  { value: RegimeAnimal.CONFINAMENTO, label: "Confinamento" },
  { value: RegimeAnimal.BOITEL, label: "Boitel" },
  { value: RegimeAnimal.SEMI_CONFINAMENTO, label: "Semi-Confinamento" },
] as const;

// ─── Utilitários ──────────────────────────────────────────────────────────────

function validarBrinco15(s: string): boolean {
  return /^\d{15}$/.test(s);
}

// ─── Tipos internos ───────────────────────────────────────────────────────────

type Tab = "pedidos" | "locais";

interface FormPedido {
  fabrica: string;
  numeroPedidoMapa: string;
  brincoInicial: string;
  brincoFinal: string;
}

interface FormLocal {
  nome: string;
  tipo: LocalAnimal["tipo"];
  regime: RegimeAnimal;
  capacidade: string;
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function BrincosPage() {
  const { selectedFazendaId } = useAuth();
  const fazendaId = selectedFazendaId ?? "";

  const [tab, setTab] = useState<Tab>("pedidos");
  const [pedidos, setPedidos] = useState<PedidoBrinco[]>([]);
  const [locais, setLocais] = useState<LocalAnimal[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal de pedido
  const [showPedidoModal, setShowPedidoModal] = useState(false);
  const [formPedido, setFormPedido] = useState<FormPedido>({
    fabrica: FABRICAS[0],
    numeroPedidoMapa: "",
    brincoInicial: "",
    brincoFinal: "",
  });
  const [salvandoPedido, setSalvandoPedido] = useState(false);

  // Modal de local
  const [showLocalModal, setShowLocalModal] = useState(false);
  const [editandoLocal, setEditandoLocal] = useState<LocalAnimal | null>(null);
  const [formLocal, setFormLocal] = useState<FormLocal>({
    nome: "",
    tipo: "piquete",
    regime: RegimeAnimal.PASTO,
    capacidade: "",
  });
  const [salvandoLocal, setSalvandoLocal] = useState(false);

  // ─── Carregamento ────────────────────────────────────────────────────────────

  const carregarPedidos = useCallback(async () => {
    if (!fazendaId) return;
    setLoading(true);
    try {
      const lista = await BrincoService.listarPedidos(fazendaId);
      setPedidos(lista);
    } catch (e) {
      console.error("Erro ao listar pedidos:", e);
    } finally {
      setLoading(false);
    }
  }, [fazendaId]);

  const carregarLocais = useCallback(async () => {
    if (!fazendaId) return;
    setLoading(true);
    try {
      const lista = await BrincoService.listarLocais(fazendaId);
      setLocais(lista);
    } catch (e) {
      console.error("Erro ao listar locais:", e);
    } finally {
      setLoading(false);
    }
  }, [fazendaId]);

  useEffect(() => {
    if (tab === "pedidos") carregarPedidos();
    else carregarLocais();
  }, [tab, carregarPedidos, carregarLocais]);

  // ─── Salvar pedido ────────────────────────────────────────────────────────────

  const salvarPedido = async () => {
    const { fabrica, numeroPedidoMapa, brincoInicial, brincoFinal } = formPedido;
    if (!numeroPedidoMapa.trim()) {
      Alert.alert("Campo obrigatório", "Informe o número do pedido MAPA.");
      return;
    }
    if (!validarBrinco15(brincoInicial)) {
      Alert.alert("Brinco inválido", "O brinco inicial deve ter exatamente 15 dígitos.");
      return;
    }
    if (!validarBrinco15(brincoFinal)) {
      Alert.alert("Brinco inválido", "O brinco final deve ter exatamente 15 dígitos.");
      return;
    }
    if (BigInt(brincoFinal) <= BigInt(brincoInicial)) {
      Alert.alert("Intervalo inválido", "O brinco final deve ser maior que o brinco inicial.");
      return;
    }

    setSalvandoPedido(true);
    try {
      const total = calcularTotalBrincos(brincoInicial, brincoFinal);
      await BrincoService.cadastrarPedido(
        {
          fabrica,
          numeroPedidoMapa: numeroPedidoMapa.trim(),
          brincoInicial,
          brincoFinal,
          controleInicial: controleFromBrinco(brincoInicial),
          controleFinal: controleFromBrinco(brincoFinal),
          brincosTotal: total,
          proximoIndice: 0,
          ativo: true,
          farmedaId: fazendaId,
        },
        fazendaId
      );
      setShowPedidoModal(false);
      setFormPedido({ fabrica: FABRICAS[0], numeroPedidoMapa: "", brincoInicial: "", brincoFinal: "" });
      await carregarPedidos();
    } catch (e) {
      Alert.alert("Erro", "Não foi possível salvar o pedido.");
    } finally {
      setSalvandoPedido(false);
    }
  };

  // ─── Salvar local ─────────────────────────────────────────────────────────────

  const salvarLocal = async () => {
    if (!formLocal.nome.trim()) {
      Alert.alert("Campo obrigatório", "Informe o nome do local.");
      return;
    }
    setSalvandoLocal(true);
    try {
      const local: LocalAnimal = {
        ...(editandoLocal?.id ? { id: editandoLocal.id } : {}),
        nome: formLocal.nome.trim(),
        tipo: formLocal.tipo,
        regime: formLocal.regime,
        capacidade: formLocal.capacidade ? parseInt(formLocal.capacidade, 10) : undefined,
        ativo: true,
        farmedaId: fazendaId,
      };
      await BrincoService.salvarLocal(local, fazendaId);
      setShowLocalModal(false);
      setEditandoLocal(null);
      setFormLocal({ nome: "", tipo: "piquete", regime: RegimeAnimal.PASTO, capacidade: "" });
      await carregarLocais();
    } catch (e) {
      Alert.alert("Erro", "Não foi possível salvar o local.");
    } finally {
      setSalvandoLocal(false);
    }
  };

  const editarLocal = (local: LocalAnimal) => {
    setEditandoLocal(local);
    setFormLocal({
      nome: local.nome,
      tipo: local.tipo,
      regime: local.regime,
      capacidade: local.capacidade?.toString() ?? "",
    });
    setShowLocalModal(true);
  };

  const excluirLocal = (local: LocalAnimal) => {
    Alert.alert(
      "Excluir local",
      `Deseja desativar "${local.nome}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              await BrincoService.excluirLocal(local.id!, fazendaId);
              await carregarLocais();
            } catch {
              Alert.alert("Erro", "Não foi possível excluir.");
            }
          },
        },
      ]
    );
  };

  // ─── Renderização auxiliar ───────────────────────────────────────────────────

  const brincoPreview = (() => {
    const { brincoInicial, brincoFinal } = formPedido;
    if (!validarBrinco15(brincoInicial) || !validarBrinco15(brincoFinal)) return null;
    if (BigInt(brincoFinal) <= BigInt(brincoInicial)) return null;
    const total = calcularTotalBrincos(brincoInicial, brincoFinal);
    return {
      total,
      controleInicial: controleFromBrinco(brincoInicial),
      controleFinal: controleFromBrinco(brincoFinal),
    };
  })();

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.titulo}>Brincos SISBOV</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {(["pedidos", "locais"] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tabItem, tab === t && styles.tabItemActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === "pedidos" ? "Pedidos de Brinco" : "Locais"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Conteúdo */}
      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} size="large" color="#2196F3" />
      ) : tab === "pedidos" ? (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <TouchableOpacity style={styles.btnNovo} onPress={() => setShowPedidoModal(true)}>
            <Ionicons name="add-circle" size={20} color="#fff" />
            <Text style={styles.btnNovoText}>Novo Pedido</Text>
          </TouchableOpacity>

          {pedidos.length === 0 && (
            <Text style={styles.vazio}>Nenhum pedido cadastrado.</Text>
          )}

          {pedidos.map((p) => {
            const utilizados = p.proximoIndice;
            const disponiveis = p.brincosTotal - utilizados;
            const pct = Math.round((utilizados / p.brincosTotal) * 100);
            const proximo = brincoByIndex(p.brincoInicial, p.proximoIndice);

            return (
              <View key={p.id} style={styles.card}>
                <View style={styles.cardRow}>
                  <Text style={styles.cardLabel}>{p.fabrica}</Text>
                  <Text style={[styles.badgeStatus, p.ativo ? styles.badgeAtivo : styles.badgeInativo]}>
                    {p.ativo ? "Ativo" : "Inativo"}
                  </Text>
                </View>
                <Text style={styles.cardSub}>Pedido MAPA: {p.numeroPedidoMapa}</Text>
                <Text style={styles.cardSub}>
                  Brincos: {p.controleInicial} → {p.controleFinal}
                </Text>

                <View style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <Text style={styles.statNum}>{p.brincosTotal}</Text>
                    <Text style={styles.statLabel}>Total</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={[styles.statNum, { color: "#4CAF50" }]}>{disponiveis}</Text>
                    <Text style={styles.statLabel}>Disponíveis</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={[styles.statNum, { color: "#FF9800" }]}>{utilizados}</Text>
                    <Text style={styles.statLabel}>Utilizados</Text>
                  </View>
                </View>

                {/* Barra de progresso */}
                <View style={styles.barBg}>
                  <View style={[styles.barFill, { width: `${pct}%` as any }]} />
                </View>
                <Text style={styles.barLabel}>{pct}% utilizado</Text>

                {disponiveis > 0 && (
                  <Text style={styles.proximo}>
                    Próximo brinco: <Text style={styles.proximoNum}>{proximo}</Text>{" "}
                    (controle: {controleFromBrinco(proximo)})
                  </Text>
                )}
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <TouchableOpacity
            style={styles.btnNovo}
            onPress={() => {
              setEditandoLocal(null);
              setFormLocal({ nome: "", tipo: "piquete", regime: RegimeAnimal.PASTO, capacidade: "" });
              setShowLocalModal(true);
            }}
          >
            <Ionicons name="add-circle" size={20} color="#fff" />
            <Text style={styles.btnNovoText}>Novo Local</Text>
          </TouchableOpacity>

          {locais.length === 0 && (
            <Text style={styles.vazio}>Nenhum local cadastrado.</Text>
          )}

          {locais.map((l) => (
            <View key={l.id} style={styles.card}>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>{l.nome}</Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TouchableOpacity onPress={() => editarLocal(l)}>
                    <Ionicons name="pencil" size={18} color="#2196F3" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => excluirLocal(l)}>
                    <Ionicons name="trash" size={18} color="#F44336" />
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={styles.cardSub}>
                Tipo: {TIPOS_LOCAL.find((t) => t.value === l.tipo)?.label ?? l.tipo} ·{" "}
                Regime: {REGIMES.find((r) => r.value === l.regime)?.label ?? l.regime}
              </Text>
              {l.capacidade != null && (
                <Text style={styles.cardSub}>Capacidade: {l.capacidade} animais</Text>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {/* ─── Modal: Pedido de Brinco ──────────────────────────────────────────── */}
      <Modal visible={showPedidoModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>Novo Pedido de Brinco</Text>
            <ScrollView>
              <Text style={styles.label}>Fábrica</Text>
              <View style={styles.row}>
                {FABRICAS.map((f) => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.chip, formPedido.fabrica === f && styles.chipActive]}
                    onPress={() => setFormPedido((prev) => ({ ...prev, fabrica: f }))}
                  >
                    <Text style={[styles.chipText, formPedido.fabrica === f && styles.chipTextActive]}>
                      {f}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Nº Pedido MAPA *</Text>
              <TextInput
                style={styles.input}
                value={formPedido.numeroPedidoMapa}
                onChangeText={(v) => setFormPedido((prev) => ({ ...prev, numeroPedidoMapa: v }))}
                placeholder="Ex: 2024/001234"
                keyboardType="default"
              />

              <Text style={styles.label}>Brinco Inicial (15 dígitos) *</Text>
              <TextInput
                style={styles.input}
                value={formPedido.brincoInicial}
                onChangeText={(v) => setFormPedido((prev) => ({ ...prev, brincoInicial: v.replace(/\D/g, "") }))}
                placeholder="105500508077691"
                keyboardType="numeric"
                maxLength={15}
              />

              <Text style={styles.label}>Brinco Final (15 dígitos) *</Text>
              <TextInput
                style={styles.input}
                value={formPedido.brincoFinal}
                onChangeText={(v) => setFormPedido((prev) => ({ ...prev, brincoFinal: v.replace(/\D/g, "") }))}
                placeholder="105500508097684"
                keyboardType="numeric"
                maxLength={15}
              />

              {brincoPreview && (
                <View style={styles.previewBox}>
                  <Text style={styles.previewTitle}>Prévia do lote</Text>
                  <Text style={styles.previewRow}>
                    Total de brincos:{" "}
                    <Text style={styles.previewVal}>{brincoPreview.total}</Text>
                  </Text>
                  <Text style={styles.previewRow}>
                    Controles:{" "}
                    <Text style={styles.previewVal}>
                      {brincoPreview.controleInicial} → {brincoPreview.controleFinal}
                    </Text>
                  </Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.btnModal, styles.btnCancelar]}
                onPress={() => setShowPedidoModal(false)}
              >
                <Text style={styles.btnCancelarText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnModal, styles.btnSalvar, salvandoPedido && styles.btnDisabled]}
                onPress={salvarPedido}
                disabled={salvandoPedido}
              >
                {salvandoPedido ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.btnSalvarText}>Salvar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Modal: Local ─────────────────────────────────────────────────────── */}
      <Modal visible={showLocalModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>
              {editandoLocal ? "Editar Local" : "Novo Local"}
            </Text>
            <ScrollView>
              <Text style={styles.label}>Nome *</Text>
              <TextInput
                style={styles.input}
                value={formLocal.nome}
                onChangeText={(v) => setFormLocal((prev) => ({ ...prev, nome: v }))}
                placeholder="Ex: Piquete 1, Baia 10"
              />

              <Text style={styles.label}>Tipo</Text>
              <View style={styles.row}>
                {TIPOS_LOCAL.map((t) => (
                  <TouchableOpacity
                    key={t.value}
                    style={[styles.chip, formLocal.tipo === t.value && styles.chipActive]}
                    onPress={() => setFormLocal((prev) => ({ ...prev, tipo: t.value }))}
                  >
                    <Text style={[styles.chipText, formLocal.tipo === t.value && styles.chipTextActive]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Regime</Text>
              <View style={styles.row}>
                {REGIMES.map((r) => (
                  <TouchableOpacity
                    key={r.value}
                    style={[styles.chip, formLocal.regime === r.value && styles.chipActive]}
                    onPress={() => setFormLocal((prev) => ({ ...prev, regime: r.value }))}
                  >
                    <Text style={[styles.chipText, formLocal.regime === r.value && styles.chipTextActive]}>
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Capacidade (animais)</Text>
              <TextInput
                style={styles.input}
                value={formLocal.capacidade}
                onChangeText={(v) => setFormLocal((prev) => ({ ...prev, capacidade: v.replace(/\D/g, "") }))}
                placeholder="Opcional"
                keyboardType="numeric"
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.btnModal, styles.btnCancelar]}
                onPress={() => {
                  setShowLocalModal(false);
                  setEditandoLocal(null);
                }}
              >
                <Text style={styles.btnCancelarText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnModal, styles.btnSalvar, salvandoLocal && styles.btnDisabled]}
                onPress={salvarLocal}
                disabled={salvandoLocal}
              >
                {salvandoLocal ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.btnSalvarText}>Salvar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F5" },
  header: {
    backgroundColor: "#795548",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 56 : 16,
    paddingBottom: 12,
  },
  titulo: { fontSize: 20, fontWeight: "700", color: "#fff" },
  tabBar: { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E0E0E0" },
  tabItem: { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabItemActive: { borderBottomWidth: 3, borderBottomColor: "#795548" },
  tabText: { fontSize: 14, color: "#757575" },
  tabTextActive: { color: "#795548", fontWeight: "700" },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },
  vazio: { textAlign: "center", color: "#9E9E9E", marginTop: 32 },
  btnNovo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#795548",
    padding: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  btnNovoText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    boxShadow: "0px 1px 4px rgba(0,0,0,0.12)",
    gap: 6,
  } as any,
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardLabel: { fontSize: 15, fontWeight: "700", color: "#333" },
  cardSub: { fontSize: 13, color: "#616161" },
  badgeStatus: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, fontSize: 11, fontWeight: "700" },
  badgeAtivo: { backgroundColor: "#E8F5E9", color: "#2E7D32" },
  badgeInativo: { backgroundColor: "#FFEBEE", color: "#C62828" },
  statsRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  statBox: { flex: 1, alignItems: "center", backgroundColor: "#F5F5F5", borderRadius: 8, padding: 8 },
  statNum: { fontSize: 18, fontWeight: "700", color: "#333" },
  statLabel: { fontSize: 11, color: "#9E9E9E", marginTop: 2 },
  barBg: { height: 8, backgroundColor: "#E0E0E0", borderRadius: 4, overflow: "hidden", marginTop: 4 },
  barFill: { height: 8, backgroundColor: "#795548", borderRadius: 4 },
  barLabel: { fontSize: 11, color: "#757575", textAlign: "right" },
  proximo: { fontSize: 12, color: "#616161", marginTop: 2 },
  proximoNum: { fontWeight: "700", color: "#795548" },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "90%",
  },
  modalTitulo: { fontSize: 18, fontWeight: "700", color: "#333", marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "600", color: "#555", marginTop: 12, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    backgroundColor: "#FAFAFA",
    color: "#333",
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    backgroundColor: "#F5F5F5",
  },
  chipActive: { backgroundColor: "#795548", borderColor: "#795548" },
  chipText: { fontSize: 13, color: "#555" },
  chipTextActive: { color: "#fff", fontWeight: "700" },
  previewBox: {
    backgroundColor: "#FFF8F5",
    borderWidth: 1,
    borderColor: "#FFCCBC",
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  previewTitle: { fontWeight: "700", color: "#BF360C", marginBottom: 4 },
  previewRow: { fontSize: 13, color: "#555", marginTop: 2 },
  previewVal: { fontWeight: "700", color: "#333" },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 20 },
  btnModal: { flex: 1, padding: 14, borderRadius: 8, alignItems: "center" },
  btnCancelar: { backgroundColor: "#EEE" },
  btnCancelarText: { color: "#555", fontWeight: "700" },
  btnSalvar: { backgroundColor: "#795548" },
  btnSalvarText: { color: "#fff", fontWeight: "700" },
  btnDisabled: { opacity: 0.5 },
});
