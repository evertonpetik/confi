/**
 * Fechamento de um processo de mangueiro.
 *
 * Confere o manejado contra o declarado nas GTAs, mostra o que falta, e só
 * então libera a planilha de campo e o pacote da certificadora. A conferência
 * vem antes do download de propósito: erro que passa daqui volta semanas
 * depois como pendência de certificação.
 */
import { DrawerSceneWrapper } from "@/components/drawe-scene-wrapper";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useResponsive } from "@/hooks/useResponsive";
import Aviso from "@/services/alerta";
import BrincoService from "@/services/brincoService";
import EventoService, { semEstornados } from "@/services/eventoService";
import {
  GtaComPdf,
  montarPacoteCertificadora,
  ResumoFechamento,
  resumirFechamento,
} from "@/services/fechamentoProcesso";
import { PesagemFirestoreService } from "@/services/pesagemFirestoreService";
import { gerarXlsxPlanilhaCampo } from "@/services/planilhaCampo";
import { Bovino, Evento, GTA, ProcessoMangueiro } from "@/services/weighing.types";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { salvarArquivo } from "@/services/downloadArquivo";
import { baixarBytes } from "@/services/storageService";

export default function FecharProcesso() {
  const { processoId } = useLocalSearchParams<{ processoId: string }>();
  const { selectedFazendaId } = useAuth();
  const { primaryColor } = useTheme();
  const { containerPadding, titleFontSize, headerPaddingTop, maxWidthContent, isTablet, isDesktop } =
    useResponsive();
  const router = useRouter();
  const fazendaId = selectedFazendaId ?? "";

  const [processo, setProcesso] = useState<ProcessoMangueiro | null>(null);
  const [gtas, setGtas] = useState<GTA[]>([]);
  const [animais, setAnimais] = useState<Bovino[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [resumo, setResumo] = useState<ResumoFechamento | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [gerando, setGerando] = useState<"xlsx" | "pacote" | null>(null);
  const [concluindo, setConcluindo] = useState(false);

  const carregar = useCallback(async () => {
    if (!processoId || !fazendaId) return;
    setCarregando(true);
    try {
      const proc = await BrincoService.obterProcessoMangueiro(processoId, fazendaId);
      if (!proc) return;
      setProcesso(proc);

      const [listaGtas, todosEventos, todosAnimais] = await Promise.all([
        Promise.all((proc.gtaIds ?? []).map((id) => BrincoService.obterGta(id, fazendaId))),
        EventoService.listarDoProcesso(processoId, fazendaId),
        PesagemFirestoreService.listarBovinos(fazendaId),
      ]);

      const gtasProc = listaGtas.filter(Boolean) as GTA[];
      const eventosValidos = semEstornados(todosEventos);

      // Os animais do processo saem dos eventos, não de um filtro no rebanho:
      // é o que garante que um animal desfeito não entre na planilha.
      const idsDoProcesso = new Set(
        eventosValidos.filter((e) => e.tipo === "cadastro").map((e) => e.animalId)
      );
      const animaisProc = todosAnimais.filter((a) => idsDoProcesso.has(a.id) && a.ativo);

      setGtas(gtasProc);
      setEventos(eventosValidos);
      setAnimais(animaisProc);
      setResumo(resumirFechamento(proc, gtasProc, animaisProc, eventosValidos));
    } finally {
      setCarregando(false);
    }
  }, [processoId, fazendaId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const baixarPlanilha = async () => {
    if (!processo) return;
    setGerando("xlsx");
    try {
      const bytes = gerarXlsxPlanilhaCampo(animais);
      await salvarArquivo(
        `planilha-de-campo-${processo.nome.replace(/[^\w-]+/g, "_")}.xlsx`,
        bytes,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
    } catch (e) {
      console.error(e);
      Aviso.alert("Erro", "Não foi possível gerar a planilha.");
    } finally {
      setGerando(null);
    }
  };

  const baixarPacote = async () => {
    if (!processo) return;
    setGerando("pacote");
    try {
      // Os PDFs vivem no Storage; baixa agora para montar o pacote.
      const comPdf: GtaComPdf[] = await Promise.all(
        gtas.map(async (gta) => {
          if (!gta.pdfUrl) return { gta };
          try {
            return { gta, pdf: await baixarBytes(gta.pdfUrl) };
          } catch (e) {
            console.warn("[GTA] falha ao baixar o PDF arquivado:", e);
            return { gta };
          }
        })
      );
      const semPdf = comPdf.filter((g) => !g.pdf).length;

      const pacote = montarPacoteCertificadora(processo, animais, comPdf);
      await salvarArquivo(pacote.nome, pacote.bytes, "application/zip");

      if (semPdf > 0) {
        Aviso.alert(
          "Pacote gerado com ressalva",
          `${semPdf} GTA(s) sem PDF arquivado. Guias digitadas à mão não têm o original — ` +
            "anexe os PDFs manualmente antes de enviar."
        );
      }
    } catch (e) {
      console.error(e);
      Aviso.alert("Erro", "Não foi possível montar o pacote.");
    } finally {
      setGerando(null);
    }
  };

  const concluirProcesso = async () => {
    if (!processo?.id) return;
    setConcluindo(true);
    try {
      await BrincoService.atualizarProcessoMangueiro(
        processo.id,
        { status: "concluido", dataConclusao: new Date().toISOString() },
        fazendaId
      );
      Aviso.alert("Processo concluído", `${animais.length} animais registrados.`, [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch {
      Aviso.alert("Erro", "Não foi possível concluir o processo.");
    } finally {
      setConcluindo(false);
    }
  };

  if (carregando) {
    return (
      <DrawerSceneWrapper>
        <View style={styles.centro}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      </DrawerSceneWrapper>
    );
  }

  if (!processo || !resumo) {
    return (
      <DrawerSceneWrapper>
        <View style={styles.centro}>
          <Text style={styles.vazio}>Processo não encontrado.</Text>
        </View>
      </DrawerSceneWrapper>
    );
  }

  const progresso = resumo.previsto > 0 ? Math.min(1, resumo.manejados / resumo.previsto) : 0;

  return (
    <DrawerSceneWrapper>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View
          style={[
            styles.container,
            { padding: containerPadding },
            isTablet && !isDesktop && { maxWidth: maxWidthContent, alignSelf: "center", width: "100%" },
          ]}
        >
          <View style={[styles.header, { paddingTop: headerPaddingTop }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.btnVoltar}>
              <Feather name="arrow-left" size={20} color="#333" />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.titulo, { fontSize: titleFontSize }]} numberOfLines={1}>
                Fechar processo
              </Text>
              <Text style={styles.subtitulo} numberOfLines={1}>
                {processo.nome}
              </Text>
            </View>
          </View>

          {/* Conferência */}
          <View style={styles.card}>
            <Text style={styles.cardTitulo}>Conferência contra as GTAs</Text>
            <View style={styles.contagemRow}>
              <Text style={styles.contagemGrande}>{resumo.manejados}</Text>
              <Text style={styles.contagemDe}>de {resumo.previsto} previstos</Text>
            </View>
            <View style={styles.barra}>
              <View
                style={[
                  styles.barraPreenchida,
                  { width: `${progresso * 100}%`, backgroundColor: resumo.pronto ? "#2E7D32" : "#FF9800" },
                ]}
              />
            </View>

            {Object.keys(resumo.manejadosPorFaixa).length > 0 && (
              <View style={styles.faixasResumo}>
                {Object.entries(resumo.manejadosPorFaixa).map(([label, qtd]) => (
                  <Text key={label} style={styles.faixaLinha}>
                    {label}: <Text style={styles.faixaQtd}>{qtd}</Text>
                  </Text>
                ))}
              </View>
            )}
          </View>

          {/* Pendências impedem o fechamento */}
          {resumo.pendencias.length > 0 && (
            <View style={[styles.card, styles.cardPendencia]}>
              <View style={styles.cardHeaderIcone}>
                <Feather name="alert-octagon" size={18} color="#C62828" />
                <Text style={[styles.cardTitulo, { color: "#C62828" }]}>Pendências</Text>
              </View>
              {resumo.pendencias.map((p, i) => (
                <Text key={i} style={styles.itemPendencia}>
                  • {p}
                </Text>
              ))}
            </View>
          )}

          {/* Avisos não impedem, mas precisam de olhada */}
          {resumo.avisos.length > 0 && (
            <View style={[styles.card, styles.cardAviso]}>
              <View style={styles.cardHeaderIcone}>
                <Feather name="alert-triangle" size={18} color="#E65100" />
                <Text style={[styles.cardTitulo, { color: "#E65100" }]}>Atenção</Text>
              </View>
              {resumo.avisos.map((a, i) => (
                <Text key={i} style={styles.itemAviso}>
                  • {a}
                </Text>
              ))}
            </View>
          )}

          {/* Animais de terceiros, listados por dono */}
          {resumo.embarque.terceiros.length > 0 && (
            <View style={[styles.card, styles.cardTerceiro]}>
              <View style={styles.cardHeaderIcone}>
                <Feather name="users" size={18} color="#E65100" />
                <Text style={[styles.cardTitulo, { color: "#E65100" }]}>Animais de terceiros</Text>
              </View>
              {resumo.embarque.porProprietario.map((g) => (
                <Text key={g.nome} style={styles.itemAviso}>
                  • {g.animais.length} de {g.nome}
                  {g.cpfCnpj ? ` (${g.cpfCnpj})` : ""}
                </Text>
              ))}
            </View>
          )}

          {/* GTAs do processo */}
          <View style={styles.card}>
            <Text style={styles.cardTitulo}>GTAs ({gtas.length})</Text>
            {gtas.map((g) => (
              <View key={g.id} style={styles.gtaLinha}>
                <Feather
                  name={g.pdfUrl ? "paperclip" : "edit-3"}
                  size={13}
                  color={g.pdfUrl ? "#2E7D32" : "#999"}
                />
                <Text style={styles.gtaTexto}>
                  {g.serie} {g.numero} · {g.total} animais
                  {g.pdfUrl ? "" : " · sem PDF"}
                </Text>
              </View>
            ))}
          </View>

          {/* Downloads */}
          <View style={styles.card}>
            <Text style={styles.cardTitulo}>Enviar à certificadora</Text>

            <TouchableOpacity
              style={[styles.btnDownload, { borderColor: primaryColor }]}
              onPress={baixarPlanilha}
              disabled={gerando !== null || animais.length === 0}
            >
              {gerando === "xlsx" ? (
                <ActivityIndicator size="small" color={primaryColor} />
              ) : (
                <Feather name="file-text" size={18} color={primaryColor} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={[styles.btnDownloadTitulo, { color: primaryColor }]}>
                  Planilha de campo (.xlsx)
                </Text>
                <Text style={styles.btnDownloadDesc}>{animais.length} animais</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnDownload, { borderColor: primaryColor }]}
              onPress={baixarPacote}
              disabled={gerando !== null || animais.length === 0}
            >
              {gerando === "pacote" ? (
                <ActivityIndicator size="small" color={primaryColor} />
              ) : (
                <Feather name="package" size={18} color={primaryColor} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={[styles.btnDownloadTitulo, { color: primaryColor }]}>
                  Pacote completo (.zip)
                </Text>
                <Text style={styles.btnDownloadDesc}>
                  Planilha + {gtas.filter((g) => g.pdfUrl).length} GTA(s) em PDF
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Concluir */}
          <TouchableOpacity
            style={[
              styles.btnConcluir,
              { backgroundColor: resumo.pronto ? "#2E7D32" : "#9E9E9E" },
              concluindo && { opacity: 0.6 },
            ]}
            onPress={
              resumo.pronto
                ? concluirProcesso
                : () =>
                    Aviso.alert(
                      "Processo incompleto",
                      `${resumo.pendencias.join("\n")}\n\nConcluir assim mesmo?`,
                      [
                        { text: "Voltar ao mangueiro", style: "cancel" },
                        { text: "Concluir mesmo assim", style: "destructive", onPress: concluirProcesso },
                      ]
                    )
            }
            disabled={concluindo}
          >
            <Feather name="check-circle" size={18} color="#fff" />
            <Text style={styles.btnConcluirText}>
              {concluindo ? "Concluindo…" : "Concluir processo"}
            </Text>
          </TouchableOpacity>

          {Platform.OS !== "web" && (
            <Text style={styles.notaCompartilhar}>
              Os arquivos abrem na tela de compartilhamento do aparelho.
            </Text>
          )}
        </View>
      </ScrollView>
    </DrawerSceneWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FDFDFD" },
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  vazio: { color: "#999" },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  btnVoltar: { padding: 4 },
  titulo: { fontWeight: "900", color: "#1a1a1a" },
  subtitulo: { fontSize: 13, color: "#888", marginTop: 2 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    padding: 16,
    marginBottom: 12,
  },
  cardPendencia: { borderColor: "#EF9A9A", backgroundColor: "#FFEBEE" },
  cardAviso: { borderColor: "#FFCC80", backgroundColor: "#FFF8E1" },
  cardTerceiro: { borderColor: "#FFCC80", backgroundColor: "#FFF3E0" },
  cardHeaderIcone: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  cardTitulo: { fontSize: 14, fontWeight: "800", color: "#333", marginBottom: 10 },

  contagemRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  contagemGrande: { fontSize: 40, fontWeight: "900", color: "#1a1a1a" },
  contagemDe: { fontSize: 14, color: "#888" },
  barra: { height: 8, backgroundColor: "#EEE", borderRadius: 4, marginTop: 10, overflow: "hidden" },
  barraPreenchida: { height: "100%", borderRadius: 4 },
  faixasResumo: { marginTop: 12, gap: 4 },
  faixaLinha: { fontSize: 12, color: "#666" },
  faixaQtd: { fontWeight: "800", color: "#333" },

  itemPendencia: { fontSize: 13, color: "#C62828", lineHeight: 20 },
  itemAviso: { fontSize: 13, color: "#E65100", lineHeight: 20 },

  gtaLinha: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  gtaTexto: { fontSize: 13, color: "#555" },

  btnDownload: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  btnDownloadTitulo: { fontSize: 14, fontWeight: "700" },
  btnDownloadDesc: { fontSize: 12, color: "#999", marginTop: 1 },

  btnConcluir: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 18,
    borderRadius: 14,
    marginTop: 4,
  },
  btnConcluirText: { fontSize: 16, fontWeight: "800", color: "#fff" },
  notaCompartilhar: { fontSize: 11, color: "#bbb", textAlign: "center", marginTop: 12 },
});
