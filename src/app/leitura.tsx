import { DrawerSceneWrapper } from "@/components/drawe-scene-wrapper";
import { useResponsive } from "@/hooks/useResponsive";
import { Feather } from "@expo/vector-icons";
import { DrawerToggleButton } from "@react-navigation/drawer";
import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
} from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
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

const CMS_INICIAL = 1.3;
const CMS_BASE = 2.6;

type NotaLeitura = {
  descricao: string;
  fator: number;
};

type LoteComPiquete = {
  id: string;
  numero: number;
  piqueteId: string;
  piqueteNome: string;
  dietaNome: string;
  cmsAtual: number;
  ultimaLeituraData: string;
};

type LeituraHoje = {
  loteId: string;
  nota: string;
  fator: number;
  cmsAnterior: number;
  cmsNovo: number;
};

export default function Leitura() {
  const { isTablet, maxWidthContent } = useResponsive();
  const [lotes, setLotes] = useState<LoteComPiquete[]>([]);
  const [notas, setNotas] = useState<NotaLeitura[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [leiturasHoje, setLeiturasHoje] = useState<Map<string, LeituraHoje>>(
    new Map()
  );

  const hoje = new Date().toISOString().split("T")[0];

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const [lotesSnap, notasSnap] = await Promise.all([
        getDocs(collection(db, "lotes")),
        getDocs(collection(db, "notaLeitura")),
      ]);

      // Notas de leitura
      const notasData: NotaLeitura[] = notasSnap.docs
        .map((d) => ({
          descricao: d.data().descricao as string,
          fator: d.data().fator as number,
        }))
        .sort(
          (a, b) => parseInt(a.descricao) - parseInt(b.descricao)
        );
      setNotas(notasData);

      // Lotes com piquete vinculado
      const lotesComPiquete: LoteComPiquete[] = [];
      const leiturasHojeMap = new Map<string, LeituraHoje>();

      for (const loteDoc of lotesSnap.docs) {
        const data = loteDoc.data();
        if (!data.piqueteId || data.ativo === false) continue;

        // Buscar ultima leitura
        const leiturasRef = collection(
          db,
          "lotes",
          loteDoc.id,
          "leituras"
        );
        const q = query(leiturasRef, orderBy("data", "desc"), limit(1));
        const leituraSnap = await getDocs(q);

        let cmsAtual = CMS_INICIAL;
        let ultimaLeituraData = "";

        if (!leituraSnap.empty) {
          const ultimaLeitura = leituraSnap.docs[0].data();
          cmsAtual = ultimaLeitura.cmsNovo ?? CMS_INICIAL;
          ultimaLeituraData = ultimaLeitura.data ?? "";

          // Se a ultima leitura é de hoje, marcar como ja feita
          if (ultimaLeitura.data === hoje) {
            leiturasHojeMap.set(loteDoc.id, {
              loteId: loteDoc.id,
              nota: ultimaLeitura.nota,
              fator: ultimaLeitura.fator,
              cmsAnterior: ultimaLeitura.cmsAnterior,
              cmsNovo: ultimaLeitura.cmsNovo,
            });
          }
        }

        lotesComPiquete.push({
          id: loteDoc.id,
          numero: data.numero ?? 0,
          piqueteId: data.piqueteId ?? "",
          piqueteNome: data.piqueteNome ?? "",
          dietaNome: data.dietaNome ?? "",
          cmsAtual,
          ultimaLeituraData,
        });
      }

      lotesComPiquete.sort((a, b) => {
        const numA = parseInt(a.piqueteNome.replace(/\D/g, "")) || 0;
        const numB = parseInt(b.piqueteNome.replace(/\D/g, "")) || 0;
        return numA - numB;
      });

      setLotes(lotesComPiquete);
      setLeiturasHoje(leiturasHojeMap);
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleSelectNota = useCallback(
    async (lote: LoteComPiquete, nota: NotaLeitura) => {
      const loteId = lote.id;
      if (saving) return;

      // CMS anterior: se ja tem leitura de hoje, usar o cmsAnterior original
      // senão, usar o cmsAtual do lote
      const leituraExistente = leiturasHoje.get(loteId);
      const cmsAnterior = leituraExistente
        ? leituraExistente.cmsAnterior
        : lote.cmsAtual;
      const cmsNovo = parseFloat(
        (cmsAnterior + CMS_BASE * (nota.fator - 1)).toFixed(4)
      );

      try {
        setSaving(loteId);

        await addDoc(collection(db, "lotes", loteId, "leituras"), {
          data: hoje,
          nota: nota.descricao,
          fator: nota.fator,
          cmsAnterior,
          cmsNovo,
        });

        // Atualizar estado local
        setLeiturasHoje((prev) => {
          const next = new Map(prev);
          next.set(loteId, {
            loteId,
            nota: nota.descricao,
            fator: nota.fator,
            cmsAnterior,
            cmsNovo,
          });
          return next;
        });

        setLotes((prev) =>
          prev.map((l) =>
            l.id === loteId ? { ...l, cmsAtual: cmsNovo, ultimaLeituraData: hoje } : l
          )
        );
      } catch (error) {
        console.error("Erro ao salvar leitura:", error);
        Alert.alert("Erro", "Não foi possível salvar a leitura.");
      } finally {
        setSaving(null);
      }
    },
    [saving, leiturasHoje, hoje]
  );

  function formatCms(cms: number): string {
    return `${cms.toFixed(2)}%`;
  }

  const handleAjusteFino = useCallback(
    async (lote: LoteComPiquete, delta: number) => {
      const loteId = lote.id;
      if (saving) return;

      const cmsNovo = parseFloat((lote.cmsAtual + delta).toFixed(4));
      if (cmsNovo <= 0) return;

      try {
        setSaving(loteId);

        await addDoc(collection(db, "lotes", loteId, "leituras"), {
          data: hoje,
          nota: delta > 0 ? "Ajuste +" : "Ajuste -",
          fator: 0,
          cmsAnterior: lote.cmsAtual,
          cmsNovo,
        });

        setLotes((prev) =>
          prev.map((l) =>
            l.id === loteId
              ? { ...l, cmsAtual: cmsNovo, ultimaLeituraData: hoje }
              : l
          )
        );
      } catch (error) {
        console.error("Erro ao salvar ajuste:", error);
        Alert.alert("Erro", "Não foi possível salvar o ajuste.");
      } finally {
        setSaving(null);
      }
    },
    [saving, hoje]
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
              <Text style={styles.title}>Leitura de Cocho</Text>
              <DrawerToggleButton tintColor="#000000" />
            </View>

            <Text style={styles.subtitle}>
              Avalie o score de cocho de cada lote. A nota selecionada
              ajustará o % CMS (Consumo de Matéria Seca).
            </Text>

            <View style={styles.dateRow}>
              <Text style={styles.dateLabel}>Data:</Text>
              <Text style={styles.dateValue}>
                {new Date().toLocaleDateString("pt-BR")}
              </Text>
            </View>

            {loading ? (
              <ActivityIndicator
                size="large"
                color="#3366FF"
                style={{ marginTop: 32 }}
              />
            ) : lotes.length === 0 ? (
              <Text style={styles.emptyText}>
                Nenhum lote com piquete vinculado encontrado.
              </Text>
            ) : (
              <View style={styles.list}>
                {/* Cabecalho legenda notas */}
                <View style={styles.legendRow}>
                  <View style={styles.legendInfo}>
                    <Text style={styles.legendText}>Piquete / Lote</Text>
                  </View>
                  <View style={styles.legendNotas}>
                    {notas.map((n) => (
                      <View key={n.descricao} style={styles.legendNotaItem}>
                        <Text style={styles.legendNotaText}>
                          {n.descricao}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>

                {lotes.map((lote) => {
                  const leituraHoje = leiturasHoje.get(lote.id);
                  const isSaving = saving === lote.id;

                  return (
                    <View key={lote.id} style={styles.loteRow}>
                      <View style={styles.loteInfo}>
                        <Text style={styles.piqueteNome}>
                          {lote.piqueteNome}
                        </Text>
                        <Text style={styles.loteNumero}>
                          Lote {lote.numero}
                        </Text>
                        <View style={styles.cmsRow}>
                          <TouchableOpacity
                            style={styles.ajusteButton}
                            activeOpacity={0.7}
                            disabled={isSaving}
                            onPress={() => handleAjusteFino(lote, -0.01)}
                          >
                            <Feather name="minus" size={14} color="#E53935" />
                          </TouchableOpacity>
                          <Text style={styles.cmsText}>
                            {formatCms(lote.cmsAtual)}
                          </Text>
                          <TouchableOpacity
                            style={styles.ajusteButton}
                            activeOpacity={0.7}
                            disabled={isSaving}
                            onPress={() => handleAjusteFino(lote, 0.01)}
                          >
                            <Feather name="plus" size={14} color="#4CAF50" />
                          </TouchableOpacity>
                        </View>
                      </View>
                      <View style={styles.notasRow}>
                        {notas.map((nota) => {
                          const isSelected =
                            leituraHoje?.nota === nota.descricao;
                          const corStyle =
                            nota.fator > 1
                              ? styles.notaAumento
                              : nota.fator === 1
                                ? styles.notaManter
                                : styles.notaReducao;
                          const corSelectedStyle =
                            nota.fator > 1
                              ? styles.notaAumentoSelected
                              : nota.fator === 1
                                ? styles.notaManterSelected
                                : styles.notaReducaoSelected;
                          const textCorStyle =
                            nota.fator > 1
                              ? styles.notaAumentoText
                              : nota.fator === 1
                                ? styles.notaManterText
                                : styles.notaReducaoText;
                          return (
                            <TouchableOpacity
                              key={nota.descricao}
                              style={[
                                styles.notaButton,
                                corStyle,
                                isSelected && corSelectedStyle,
                              ]}
                              activeOpacity={0.7}
                              disabled={isSaving}
                              onPress={() => handleSelectNota(lote, nota)}
                            >
                              <Text
                                style={[
                                  styles.notaButtonText,
                                  textCorStyle,
                                  isSelected && styles.notaButtonTextSelected,
                                ]}
                              >
                                {nota.descricao}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    gap: 8,
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#444",
  },
  dateValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  emptyText: {
    textAlign: "center",
    marginTop: 32,
    fontSize: 16,
    color: "#999",
  },
  list: {
    marginTop: 24,
    gap: 8,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#ECECEC",
  },
  legendInfo: {
    flex: 1,
  },
  legendText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#999",
  },
  legendNotas: {
    flexDirection: "row",
    gap: 6,
  },
  legendNotaItem: {
    width: 40,
    alignItems: "center",
  },
  legendNotaText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#999",
  },
  loteRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    padding: 12,
  },
  loteInfo: {
    flex: 1,
  },
  piqueteNome: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  loteNumero: {
    fontSize: 13,
    color: "#888",
    marginTop: 1,
  },
  cmsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  cmsText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#3366FF",
  },
  ajusteButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#DCDCDC",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF",
  },
  notasRow: {
    flexDirection: "row",
    gap: 6,
  },
  notaButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  // Aumento (fator > 1) - verde
  notaAumento: {
    borderColor: "#4CAF50",
    backgroundColor: "#E8F5E9",
  },
  notaAumentoSelected: {
    backgroundColor: "#4CAF50",
    borderColor: "#388E3C",
  },
  notaAumentoText: {
    color: "#2E7D32",
  },
  // Manter (fator === 1) - laranja
  notaManter: {
    borderColor: "#FF9800",
    backgroundColor: "#FFF3E0",
  },
  notaManterSelected: {
    backgroundColor: "#FF9800",
    borderColor: "#F57C00",
  },
  notaManterText: {
    color: "#E65100",
  },
  // Redução (fator < 1) - vermelho
  notaReducao: {
    borderColor: "#E53935",
    backgroundColor: "#FFEBEE",
  },
  notaReducaoSelected: {
    backgroundColor: "#E53935",
    borderColor: "#C62828",
  },
  notaReducaoText: {
    color: "#C62828",
  },
  notaButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
  notaButtonTextSelected: {
    color: "#FFF",
  },
});
