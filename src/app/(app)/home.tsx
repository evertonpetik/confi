import { DrawerSceneWrapper } from "@/components/drawe-scene-wrapper";
import { DrawerToggleButton } from "@/components/DrawerToggleButton";
import { calcularEstoque } from "@/components/InsumoCard";
import { Movimentacao } from "@/components/LoteCard";
import { AgendarEmbarqueModal, AgendarEmbarqueLote } from "@/components/AgendarEmbarqueModal";
import { Roteiro, RoteiroPiquete } from "@/components/RoteiroCard";
import {
  TransferenciaFormData,
  TransferenciaLoteModal,
} from "@/components/TransferenciaLoteModal";
import { useTheme } from "@/contexts/ThemeContext";
import { useResponsive } from "@/hooks/useResponsive";
import { proximoEmbarqueAgendado, somarEmbarquesAgendadosNaData } from "@/services/embarqueAgendado";
import {
  fsLimit,
  fsOrderBy,
  getCollection,
  queryCollection,
  updateDocument,
} from "@/services/firestoreService";
import { transferirEntreLotes } from "@/services/transferenciaLote";
import {
  calcularAutonomiaDias,
  calcularConsumoUltimoDia,
  isEstoqueBaixo,
} from "@/utils/insumoAutonomia";
import { calcPesoMedio, CMS_INICIAL } from "@/utils/mapaTratoCalc";
import { compararPiquetes } from "@/utils/piqueteOrdenacao";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// ---- Types ----

type LoteReportRow = {
  loteId: string;
  piquete: string;
  piqueteId: string;
  loteNumero: number;
  dieta: string;
  quantidade: number;
  produtor: string;
  categoria: string;
  dataEntrada: string;
  pesoEntrada: number;
  diasTrato: number;
  raca: string;
  consMOCab: number;
  consMSCab: number;
  cmsPctPV: number;
  consMOCabPrev: number;
  consMSCabPrev: number;
  cmsPctPVPrev: number;
  leituraCocho: string;
  gmdEstimado: number;
  pesoHojeProjetado: number;
  gmdRealMedio: number;
  pesoReal: number;
  cmsPctPVMedio: number;
  pesoPrevistoHoje: number;
  embarqueAgendadoData: string;
};

// ---- Heatmap de cores (vermelho -> amarelo -> verde), estilo escala 3 cores do Excel ----

const HEATMAP_LOW = { r: 248, g: 105, b: 107 }; // vermelho
const HEATMAP_MID = { r: 255, g: 235, b: 132 }; // amarelo
const HEATMAP_HIGH = { r: 99, g: 190, b: 123 }; // verde

const HEATMAP_COLUMNS: (keyof LoteReportRow)[] = ["cmsPctPV", "cmsPctPVPrev", "cmsPctPVMedio"];

function getHeatmapColor(value: number, min: number, max: number): string {
  if (max <= min) return `rgb(${HEATMAP_MID.r}, ${HEATMAP_MID.g}, ${HEATMAP_MID.b})`;
  const ratio = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const [from, to, t] =
    ratio < 0.5
      ? ([HEATMAP_LOW, HEATMAP_MID, ratio / 0.5] as const)
      : ([HEATMAP_MID, HEATMAP_HIGH, (ratio - 0.5) / 0.5] as const);
  const r = Math.round(from.r + (to.r - from.r) * t);
  const g = Math.round(from.g + (to.g - from.g) * t);
  const b = Math.round(from.b + (to.b - from.b) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

function getColumnRange(rows: LoteReportRow[], key: keyof LoteReportRow): { min: number; max: number } {
  const values = rows
    .map((r) => r[key])
    .filter((v): v is number => typeof v === "number" && v > 0);
  if (values.length === 0) return { min: 0, max: 0 };
  return { min: Math.min(...values), max: Math.max(...values) };
}

function formatPercent(value: number): string {
  return value > 0 ? `${value.toFixed(2).replace(".", ",")}%` : "-";
}

// ---- Column filter modal ----

type ColumnFilterModalProps = {
  columnLabel: string;
  values: string[];
  selectedValues: Set<string>;
  onToggleValue: (value: string) => void;
  onClose: () => void;
};

function ColumnFilterModal({ columnLabel, values, selectedValues, onToggleValue, onClose }: ColumnFilterModalProps) {
  const { primaryColor } = useTheme();
  const [search, setSearch] = useState("");

  const filteredValues = values.filter((v) => v.toLowerCase().includes(search.toLowerCase()));

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.filterModalOverlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.filterModalSheet}>
          <View style={styles.filterModalHeader}>
            <Text style={styles.filterModalHeaderTitle}>Filtrar: {columnLabel}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={22} color="#333" />
            </TouchableOpacity>
          </View>

          <View style={styles.filterModalSearchWrapper}>
            <Feather name="search" size={16} color="#999" style={styles.filterModalSearchIcon} />
            <TextInput
              style={styles.filterModalSearchInput}
              placeholder="Buscar valor..."
              value={search}
              onChangeText={setSearch}
            />
          </View>

          <FlatList
            data={filteredValues}
            keyExtractor={(item) => item}
            renderItem={({ item }) => {
              const isSelected = selectedValues.has(item);
              return (
                <TouchableOpacity
                  style={styles.filterModalOption}
                  onPress={() => onToggleValue(item)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.filterModalCheckbox,
                      isSelected && { backgroundColor: primaryColor, borderColor: primaryColor },
                    ]}
                  >
                    {isSelected && <Feather name="check" size={12} color="#FFF" />}
                  </View>
                  <Text style={styles.filterModalOptionText} numberOfLines={1}>{item}</Text>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={<Text style={styles.filterModalEmptyText}>Nenhum valor encontrado</Text>}
            style={{ maxHeight: 320 }}
          />

          <TouchableOpacity
            style={[styles.filterModalConfirmButton, { backgroundColor: primaryColor }]}
            onPress={onClose}
          >
            <Text style={styles.filterModalConfirmButtonText}>Confirmar ({selectedValues.size})</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---- Trocar roteiro modal ----

type TrocarRoteiroModalProps = {
  piqueteNome: string;
  roteiros: Roteiro[];
  roteiroAtualId: string | undefined;
  onSelect: (roteiroId: string) => void;
  onClose: () => void;
};

function TrocarRoteiroModal({ piqueteNome, roteiros, roteiroAtualId, onSelect, onClose }: TrocarRoteiroModalProps) {
  const { primaryColor } = useTheme();

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.filterModalOverlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.filterModalSheet}>
          <View style={styles.filterModalHeader}>
            <Text style={styles.filterModalHeaderTitle} numberOfLines={1}>
              Trocar roteiro — Piquete {piqueteNome}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={22} color="#333" />
            </TouchableOpacity>
          </View>

          <FlatList
            data={roteiros}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const isAtual = item.id === roteiroAtualId;
              return (
                <TouchableOpacity
                  style={styles.filterModalOption}
                  onPress={() => onSelect(item.id)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.roteiroOptionTitle, isAtual && { color: primaryColor }]} numberOfLines={1}>
                      Roteiro {item.numero}
                    </Text>
                    <Text style={styles.roteiroOptionSubtitle} numberOfLines={1}>
                      Dieta: {item.dietaNome || "-"}
                    </Text>
                  </View>
                  {isAtual && <Feather name="check" size={18} color={primaryColor} />}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={<Text style={styles.filterModalEmptyText}>Nenhum roteiro encontrado</Text>}
            style={{ maxHeight: 400 }}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---- Component ----

export default function Home() {
  const { primaryColor } = useTheme();
  const { isTablet, isDesktop, maxWidthContent, containerPadding, titleFontSize, headerPaddingTop, cardValueFontSize } = useResponsive();
  const [lotesAtivos, setLotesAtivos] = useState(0);
  const [totalAnimais, setTotalAnimais] = useState(0);
  const [totalMortes, setTotalMortes] = useState(0);
  const [totalVendas, setTotalVendas] = useState(0);
  const [totalEntradas, setTotalEntradas] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reportRows, setReportRows] = useState<LoteReportRow[]>([]);
  const [insumosVencidos, setInsumosVencidos] = useState<string[]>([]);
  const [insumosEstoqueBaixo, setInsumosEstoqueBaixo] = useState<
    { id: string; nome: string; estoque: number; autonomiaDias: number }[]
  >([]);
  const [sortKey, setSortKey] = useState<keyof LoteReportRow | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [columnFilters, setColumnFilters] = useState<Partial<Record<keyof LoteReportRow, Set<string>>>>({});
  const [filterModalColumn, setFilterModalColumn] = useState<keyof LoteReportRow | null>(null);
  const [roteiros, setRoteiros] = useState<Roteiro[]>([]);
  const [trocaRoteiroPiquete, setTrocaRoteiroPiquete] = useState<{ piqueteId: string; piqueteNome: string } | null>(null);
  const [transferLote, setTransferLote] = useState<{
    id: string;
    numero: number;
    piqueteId: string;
    qtdAtual: number;
    pesoPrevisto: number;
  } | null>(null);
  const [embarqueLote, setEmbarqueLote] = useState<AgendarEmbarqueLote | null>(null);
  const [embarquesHoje, setEmbarquesHoje] = useState<
    { loteId: string; loteNumero: number; piqueteNome: string; quantidade: number; qtdAtual: number; total: boolean }[]
  >([]);

  useFocusEffect(
    useCallback(() => {
      fetchDashboard();
    }, [])
  );

  async function fetchDashboard() {
    try {
      setLoading(true);
      const [lotesSnap, histSnap, insumosSnap, parametrosSnap, roteirosSnap, dietasSnap] = await Promise.all([
        getCollection("lotes"),
        getCollection("historicoMapaTrato"),
        getCollection("insumos"),
        getCollection("parametros"),
        getCollection("roteiros"),
        getCollection("dietas"),
      ]);

      // dietaId -> percentualMS (para calcular MO previsto a partir da MS prevista)
      const dietaPercMSMap = new Map<string, number>();
      for (const dDoc of dietasSnap.docs) {
        dietaPercMSMap.set(dDoc.id, dDoc.data().percentualMS ?? 50);
      }

      // Build piqueteId -> dietaNome / percentualMS maps from roteiros
      const piqueteDietaMap = new Map<string, string>();
      const piquetePercMSMap = new Map<string, number>();
      const roteirosAtivos: Roteiro[] = [];
      for (const rDoc of roteirosSnap.docs) {
        const rData = rDoc.data();
        const dietaNome = (rData.dietaNome as string) ?? "";
        const percMSDieta = dietaPercMSMap.get(rData.dietaId as string) ?? 0;
        const piquetes = (rData.piquetes ?? []) as RoteiroPiquete[];
        for (const p of piquetes) {
          if (p.piqueteId && dietaNome) {
            piqueteDietaMap.set(p.piqueteId, dietaNome);
          }
          if (p.piqueteId && percMSDieta > 0) {
            piquetePercMSMap.set(p.piqueteId, percMSDieta);
          }
        }
        if (rData.ativo !== false) {
          roteirosAtivos.push({
            id: rDoc.id,
            numero: rData.numero ?? 0,
            dietaId: rData.dietaId ?? "",
            dietaNome,
            piquetes,
            minTratos: rData.minTratos ?? 1,
            ativo: rData.ativo ?? true,
          });
        }
      }
      roteirosAtivos.sort((a, b) => a.numero - b.numero);
      setRoteiros(roteirosAtivos);

      // Verificar conferências de MS vencidas
      const tempoMSParam = parametrosSnap.docs.find(
        (d) => d.data().descricao === "tempoMS"
      );
      const tempoMSDias = tempoMSParam ? Number(tempoMSParam.data().valor) : 0;

      if (tempoMSDias > 0) {
        const hojeMs = new Date().getTime();
        const vencidos: string[] = [];

        const insumosComMS = insumosSnap.docs.filter((d) => d.data().materiaSecaVariavel);
        const confSnaps = await Promise.all(
          insumosComMS.map((insumoDoc) => getCollection("insumos", insumoDoc.id, "conferencias"))
        );

        insumosComMS.forEach((insumoDoc, idx) => {
          const insumoData = insumoDoc.data();
          const confSnap = confSnaps[idx];

          if (confSnap.empty) {
            vencidos.push(insumoData.nome ?? "Sem nome");
            return;
          }

          // Encontrar data mais recente
          let maisRecente = "";
          for (const cDoc of confSnap.docs) {
            const cData = cDoc.data().data as string;
            if (cData > maisRecente) maisRecente = cData;
          }

          if (maisRecente) {
            const dataConf = new Date(maisRecente + "T00:00:00").getTime();
            const diffDias = Math.floor((hojeMs - dataConf) / 86400000);
            if (diffDias >= tempoMSDias) {
              vencidos.push(insumoData.nome ?? "Sem nome");
            }
          }
        });

        setInsumosVencidos(vencidos);
      } else {
        setInsumosVencidos([]);
      }

      // Calcular autonomia de estoque de todos os insumos
      {
        const [comprasSnaps, saidasSnaps] = await Promise.all([
          Promise.all(
            insumosSnap.docs.map((insumoDoc) => getCollection("insumos", insumoDoc.id, "compras"))
          ),
          Promise.all(
            insumosSnap.docs.map((insumoDoc) => getCollection("insumos", insumoDoc.id, "saidas"))
          ),
        ]);

        const baixo: { id: string; nome: string; estoque: number; autonomiaDias: number }[] = [];
        insumosSnap.docs.forEach((insumoDoc, idx) => {
          const insumoData = insumoDoc.data();
          const compras = comprasSnaps[idx].docs.map((d) => d.data() as { quantidade: number; precoKg: number; data: string });
          const saidas = saidasSnaps[idx].docs.map((d) => d.data() as { quantidade: number; precoKg: number; data: string });
          const estoque = calcularEstoque(compras as any, saidas as any);
          const consumoUltimoDia = calcularConsumoUltimoDia(saidas as any).quantidade;
          const autonomiaDias = calcularAutonomiaDias(estoque, consumoUltimoDia);
          if (isEstoqueBaixo(autonomiaDias, insumoData.autonomiaMinimaDias)) {
            baixo.push({
              id: insumoDoc.id,
              nome: insumoData.nome ?? "Sem nome",
              estoque,
              autonomiaDias: autonomiaDias as number,
            });
          }
        });
        baixo.sort((a, b) => a.autonomiaDias - b.autonomiaDias);
        setInsumosEstoqueBaixo(baixo);
      }

      // Build historico lookups: loteId -> { gmdReal[], msPorLote (ontem) }
      const formatDateStr = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const hoje = formatDateStr(new Date());
      const ontem = (() => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return formatDateStr(d);
      })();
      // soma só acumula ganhos > 0, mas todo dia em que o lote passou pelo
      // trato conta no denominador — dias de GMD zero diluem a média.
      const gmdRealByLote = new Map<string, { soma: number; dias: Set<string> }>();
      const cmsByLote = new Map<string, number[]>();
      const ontemMOByLote = new Map<string, number>();
      const ontemMSByLote = new Map<string, number>();
      const cmsRealizadoOntemByLote = new Map<string, number>();

      for (const hDoc of histSnap.docs) {
        const h = hDoc.data();
        const msPorLote = h.msPorLote as { loteId: string; totalMO?: number; totalMS?: number; gmdReal?: number; cmsRealizado?: number }[] | undefined;
        if (!msPorLote) continue;
        for (const ml of msPorLote) {
          if (h.data) {
            const gmdInfo = gmdRealByLote.get(ml.loteId) ?? { soma: 0, dias: new Set<string>() };
            gmdInfo.dias.add(h.data as string);
            if (ml.gmdReal != null && ml.gmdReal > 0) {
              gmdInfo.soma += ml.gmdReal;
            }
            gmdRealByLote.set(ml.loteId, gmdInfo);
          }
          if (ml.cmsRealizado != null && ml.cmsRealizado > 0) {
            const prev = cmsByLote.get(ml.loteId) ?? [];
            prev.push(ml.cmsRealizado);
            cmsByLote.set(ml.loteId, prev);
          }
          // Trato de hoje ainda em execucao: consumo exibido e o realizado de ontem
          if (h.data === ontem) {
            if (ml.totalMO != null && ml.totalMO > 0) {
              ontemMOByLote.set(ml.loteId, (ontemMOByLote.get(ml.loteId) ?? 0) + ml.totalMO);
            }
            if (ml.totalMS != null && ml.totalMS > 0) {
              ontemMSByLote.set(ml.loteId, (ontemMSByLote.get(ml.loteId) ?? 0) + ml.totalMS);
            }
            if (ml.cmsRealizado != null && ml.cmsRealizado > 0) {
              cmsRealizadoOntemByLote.set(ml.loteId, ml.cmsRealizado);
            }
          }
        }
      }

      const lotesAtivosDocs = lotesSnap.docs.filter((d) => d.data().ativo === true);

      const [movSnaps, leitSnaps, embarqueSnaps] = await Promise.all([
        Promise.all(lotesAtivosDocs.map((loteDoc) => getCollection("lotes", loteDoc.id, "movimentacoes"))),
        Promise.all(
          lotesAtivosDocs.map((loteDoc) =>
            queryCollection(
              ["lotes", loteDoc.id, "leituras"],
              [fsOrderBy("data", "desc"), fsLimit(1)]
            ).catch(() => null)
          )
        ),
        Promise.all(lotesAtivosDocs.map((loteDoc) => getCollection("lotes", loteDoc.id, "embarquesAgendados"))),
      ]);

      const embarquesHojeList: {
        loteId: string;
        loteNumero: number;
        piqueteNome: string;
        quantidade: number;
        qtdAtual: number;
        total: boolean;
      }[] = [];

      let ativos = 0;
      let animais = 0;
      let mortes = 0;
      let vendas = 0;
      let entradas = 0;
      const rows: LoteReportRow[] = [];

      lotesAtivosDocs.forEach((loteDoc, idx) => {
        const ld = loteDoc.data();
        ativos++;

        const movSnap = movSnaps[idx];
        const movs: Movimentacao[] = movSnap.docs.map((m) => ({
          id: m.id,
          ...(m.data() as Omit<Movimentacao, "id">),
        }));

        // Dashboard totals
        let qtdAtual = 0;
        for (const m of movs) {
          if (m.evento === "Entrada") {
            qtdAtual += m.quantidade;
            entradas += m.quantidade;
          } else {
            qtdAtual -= m.quantidade;
            if (m.movimentacao === "Morte") mortes += m.quantidade;
            if (m.movimentacao === "Venda") vendas += m.quantidade;
          }
        }
        animais += qtdAtual;

        const embarqueDocs = embarqueSnaps[idx].docs.map((e) => ({
          data: e.data().data as string,
          quantidade: e.data().quantidade as number,
          status: e.data().status as "agendado" | "cancelado",
        }));
        const quantidadeAgendadaHoje = somarEmbarquesAgendadosNaData(embarqueDocs, hoje);
        const proximoEmbarque = proximoEmbarqueAgendado(embarqueDocs, hoje);
        if (quantidadeAgendadaHoje > 0) {
          embarquesHojeList.push({
            loteId: loteDoc.id,
            loteNumero: ld.numero ?? 0,
            piqueteNome: ld.piqueteNome ?? "",
            quantidade: quantidadeAgendadaHoje,
            qtdAtual,
            total: quantidadeAgendadaHoje >= qtdAtual,
          });
        }

        // First entry date and peso
        const entradasMov = movs
          .filter((m) => m.evento === "Entrada")
          .sort((a, b) => a.data.localeCompare(b.data));
        const primeiraEntrada = entradasMov[0];
        const dataEntrada = primeiraEntrada?.data ?? "";
        const totalAnimaisEntrada = entradasMov.reduce((a, m) => a + m.quantidade, 0);
        const pesoEntrada = totalAnimaisEntrada > 0
          ? entradasMov.reduce((a, m) => a + m.quantidade * m.pesoMedio, 0) / totalAnimaisEntrada
          : 0;

        // Dias de trato
        const hojeDate = new Date();
        const dataEntradaDate = dataEntrada ? new Date(dataEntrada + "T00:00:00") : hojeDate;
        const diasTrato = Math.max(0, Math.floor((hojeDate.getTime() - dataEntradaDate.getTime()) / 86400000));

        // Peso hoje projetado (peso medio initial + gmdEstimado * dias)
        const gmdEst = ld.gmdEstimado ?? 0;
        const pesoHojeProjetado = pesoEntrada + gmdEst * diasTrato;

        // Last leitura de cocho
        let leituraCocho = "-";
        let cmsAtual = 0;
        let leituraData = "";
        const leitSnap = leitSnaps[idx];
        if (leitSnap && !leitSnap.empty) {
          const l = leitSnap.docs[0].data();
          leituraCocho = l.nota ?? "-";
          cmsAtual = l.cmsNovo ?? 0;
          leituraData = l.data ?? "";
        }

        // Consumo realizado de ontem (MO e MS por cabeca)
        const totalMOOntem = ontemMOByLote.get(loteDoc.id) ?? 0;
        const totalMSOntem = ontemMSByLote.get(loteDoc.id) ?? 0;
        const consMOCab = qtdAtual > 0 ? totalMOOntem / qtdAtual : 0;
        const consMSCab = qtdAtual > 0 ? totalMSOntem / qtdAtual : 0;

        // CMS % PV (ontem)
        const cmsPctPV = pesoHojeProjetado > 0 ? (consMSCab / pesoHojeProjetado) * 100 : cmsAtual;

        // Previsto de hoje: mesma logica do mapa de trato
        // CMS previsto: leitura de hoje > CMS realizado de ontem > ultima leitura > CMS inicial
        const cmsOntemRealizado = cmsRealizadoOntemByLote.get(loteDoc.id) ?? 0;
        let cmsPrevPct = CMS_INICIAL;
        if (leituraData === hoje && cmsAtual > 0) {
          cmsPrevPct = cmsAtual;
        } else if (cmsOntemRealizado > 0) {
          cmsPrevPct = cmsOntemRealizado;
        } else if (cmsAtual > 0) {
          cmsPrevPct = cmsAtual;
        }
        const pesoMedioAtual = calcPesoMedio(movs, gmdEst);
        const percMSDieta = ld.piqueteId ? piquetePercMSMap.get(ld.piqueteId) ?? 0 : 0;
        const consMSCabPrev = pesoMedioAtual > 0 ? pesoMedioAtual * (cmsPrevPct / 100) : 0;
        const consMOCabPrev = percMSDieta > 0 ? consMSCabPrev / (percMSDieta / 100) : 0;
        const cmsPctPVPrev = consMSCabPrev > 0 ? cmsPrevPct : 0;

        // GMD real medio: soma dos ganhos / dias de trato no historico
        const gmdInfo = gmdRealByLote.get(loteDoc.id);
        const somaGmd = gmdInfo?.soma ?? 0;
        const diasGmd = gmdInfo?.dias.size ?? 0;
        const gmdRealMedio = diasGmd > 0 ? somaGmd / diasGmd : 0;

        // Peso real
        const pesoReal = somaGmd > 0 ? pesoEntrada + somaGmd : 0;

        // CMS %PV medio
        const cmsArr = cmsByLote.get(loteDoc.id) ?? [];
        const cmsPctPVMedio = cmsArr.length > 0 ? cmsArr.reduce((a, c) => a + c, 0) / cmsArr.length : 0;

        rows.push({
          loteId: loteDoc.id,
          piquete: ld.piqueteNome ?? "-",
          piqueteId: ld.piqueteId ?? "",
          loteNumero: ld.numero ?? 0,
          dieta: (ld.piqueteId ? piqueteDietaMap.get(ld.piqueteId) : undefined) ?? "-",
          quantidade: qtdAtual,
          produtor: ld.produtor ?? "-",
          categoria: ld.categoria ?? "-",
          dataEntrada: dataEntrada ? new Date(dataEntrada + "T00:00:00").toLocaleDateString("pt-BR") : "-",
          pesoEntrada,
          diasTrato,
          raca: ld.raca ?? "-",
          consMOCab,
          consMSCab,
          cmsPctPV,
          consMOCabPrev,
          consMSCabPrev,
          cmsPctPVPrev,
          leituraCocho,
          gmdEstimado: gmdEst,
          pesoHojeProjetado,
          gmdRealMedio,
          pesoReal,
          cmsPctPVMedio,
          pesoPrevistoHoje: pesoMedioAtual,
          embarqueAgendadoData: proximoEmbarque?.data ?? "",
        });
      });

      rows.sort((a, b) => compararPiquetes(a.piquete, b.piquete));
      setReportRows(rows);
      setEmbarquesHoje(embarquesHojeList);
      setLotesAtivos(ativos);
      setTotalAnimais(animais);
      setTotalMortes(mortes);
      setTotalVendas(vendas);
      setTotalEntradas(entradas);
    } catch (error) {
      console.error("Erro ao buscar dashboard:", error);
    } finally {
      setLoading(false);
    }
  }

  const cardBasis = isDesktop ? ("30%" as const) : ("47%" as const);

  // Table column definitions
  const columns: { key: keyof LoteReportRow; label: string; width: number; format?: (v: LoteReportRow) => string }[] = [
    { key: "piquete", label: "Piquete", width: 100 },
    { key: "loteNumero", label: "Lote", width: 70, format: (r) => `${r.loteNumero}` },
    { key: "dieta", label: "Dieta", width: 100 },
    { key: "quantidade", label: "Qtde", width: 60, format: (r) => `${r.quantidade}` },
    { key: "produtor", label: "Produtor", width: 110 },
    { key: "categoria", label: "Categoria", width: 100 },
    { key: "dataEntrada", label: "Dt Entrada", width: 90 },
    { key: "pesoEntrada", label: "Peso Ent.", width: 80, format: (r) => r.pesoEntrada > 0 ? r.pesoEntrada.toFixed(1) : "-" },
    { key: "diasTrato", label: "Dias", width: 55, format: (r) => `${r.diasTrato}` },
    { key: "raca", label: "Raca", width: 110 },
    { key: "consMOCab", label: "MO/cab Ontem", width: 80, format: (r) => r.consMOCab > 0 ? r.consMOCab.toFixed(1) : "-" },
    { key: "consMSCab", label: "MS/cab Ontem", width: 80, format: (r) => r.consMSCab > 0 ? r.consMSCab.toFixed(2) : "-" },
    { key: "cmsPctPV", label: "CMS %PV Ontem", width: 80, format: (r) => formatPercent(r.cmsPctPV) },
    { key: "consMOCabPrev", label: "MO/cab Prev.", width: 80, format: (r) => r.consMOCabPrev > 0 ? r.consMOCabPrev.toFixed(1) : "-" },
    { key: "consMSCabPrev", label: "MS/cab Prev.", width: 80, format: (r) => r.consMSCabPrev > 0 ? r.consMSCabPrev.toFixed(2) : "-" },
    { key: "cmsPctPVPrev", label: "CMS %PV Prev.", width: 80, format: (r) => formatPercent(r.cmsPctPVPrev) },
    { key: "leituraCocho", label: "Leit. Cocho", width: 80 },
    { key: "gmdEstimado", label: "GMD Est.", width: 75, format: (r) => r.gmdEstimado > 0 ? r.gmdEstimado.toFixed(3) : "-" },
    { key: "pesoHojeProjetado", label: "Peso Proj.", width: 80, format: (r) => r.pesoHojeProjetado > 0 ? r.pesoHojeProjetado.toFixed(1) : "-" },
    { key: "gmdRealMedio", label: "GMD Real", width: 75, format: (r) => r.gmdRealMedio > 0 ? r.gmdRealMedio.toFixed(3) : "-" },
    { key: "pesoReal", label: "Peso Real", width: 80, format: (r) => r.pesoReal > 0 ? r.pesoReal.toFixed(1) : "-" },
    { key: "cmsPctPVMedio", label: "CMS %PV Med", width: 90, format: (r) => formatPercent(r.cmsPctPVMedio) },
  ];

  function getCellValue(row: LoteReportRow, col: typeof columns[number]): string {
    if (col.format) return col.format(row);
    return String(row[col.key]);
  }

  function getUniqueColumnValues(col: typeof columns[number]): string[] {
    const values = new Set(reportRows.map((row) => getCellValue(row, col)));
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }

  function getFilteredRows(rows: LoteReportRow[]): LoteReportRow[] {
    const activeFilters = Object.entries(columnFilters) as [keyof LoteReportRow, Set<string>][];
    if (activeFilters.length === 0) return rows;
    return rows.filter((row) =>
      activeFilters.every(([key, allowedValues]) => {
        const col = columns.find((c) => c.key === key);
        if (!col) return true;
        return allowedValues.has(getCellValue(row, col));
      })
    );
  }

  function getSortedRows(rows: LoteReportRow[]): LoteReportRow[] {
    const sorted = [...rows];
    if (!sortKey) {
      sorted.sort((a, b) => compararPiquetes(a.piquete, b.piquete));
      return sorted;
    }
    sorted.sort((a, b) => {
      const valueA = a[sortKey];
      const valueB = b[sortKey];
      let comparison = 0;
      if (typeof valueA === "number" && typeof valueB === "number") {
        comparison = valueA - valueB;
      } else {
        comparison = String(valueA).localeCompare(String(valueB));
      }
      return sortDir === "asc" ? comparison : -comparison;
    });
    return sorted;
  }

  function handleSortPress(key: keyof LoteReportRow) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function handleToggleFilterValue(key: keyof LoteReportRow, value: string, allValues: string[]) {
    setColumnFilters((prev) => {
      const current = prev[key] ?? new Set(allValues);
      const next = new Set(current);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      const updated = { ...prev };
      if (next.size === allValues.length) {
        delete updated[key];
      } else {
        updated[key] = next;
      }
      return updated;
    });
  }

  const visibleRows = getSortedRows(getFilteredRows(reportRows));

  const heatmapRanges = new Map(
    HEATMAP_COLUMNS.map((key) => [key, getColumnRange(visibleRows, key)])
  );

  function getCellBackgroundColor(row: LoteReportRow, col: typeof columns[number]): string | undefined {
    if (!HEATMAP_COLUMNS.includes(col.key)) return undefined;
    const value = row[col.key];
    if (typeof value !== "number" || value <= 0) return undefined;
    const range = heatmapRanges.get(col.key);
    if (!range) return undefined;
    return getHeatmapColor(value, range.min, range.max);
  }

  function buildReportHtml(rows: LoteReportRow[]): string {
    const escapeHtml = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const htmlHeatmapRanges = new Map(
      HEATMAP_COLUMNS.map((key) => [key, getColumnRange(rows, key)])
    );
    const headerCells = columns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join("");
    const bodyRows = rows
      .map((row) => {
        const cells = columns
          .map((c) => {
            const value = row[c.key];
            let styleAttr = "";
            if (HEATMAP_COLUMNS.includes(c.key) && typeof value === "number" && value > 0) {
              const range = htmlHeatmapRanges.get(c.key)!;
              const bg = getHeatmapColor(value, range.min, range.max);
              styleAttr = ` style="background-color: ${bg};"`;
            }
            return `<td${styleAttr}>${escapeHtml(getCellValue(row, c))}</td>`;
          })
          .join("");
        return `<tr>${cells}</tr>`;
      })
      .join("");
    const dataGeracao = new Date().toLocaleDateString("pt-BR");
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: A4 landscape; margin: 8mm; }
  body { font-family: Helvetica, Arial, sans-serif; margin: 0; }
  h1 { font-size: 13px; margin: 0 0 6px 0; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th, td { border: 0.5px solid #BBB; padding: 2px 3px; font-size: 6.5px; text-align: left; overflow: hidden; word-wrap: break-word; }
  th { background-color: ${primaryColor}; color: #FFF; font-weight: bold; }
  tr:nth-child(even) td { background-color: #F5F7FA; }
</style>
</head>
<body>
<h1>Relatório de Lotes Ativos — ${dataGeracao}</h1>
<table>
<thead><tr>${headerCells}</tr></thead>
<tbody>${bodyRows}</tbody>
</table>
</body>
</html>`;
  }

  async function handleGerarPdf() {
    try {
      const html = buildReportHtml(visibleRows);

      if (Platform.OS === "web") {
        const win = window.open("", "_blank");
        if (!win) {
          Alert.alert("Erro", "Permita pop-ups para gerar o PDF.");
          return;
        }
        win.document.write(html);
        win.document.close();
        win.focus();
        win.print();
        return;
      }

      // A4 paisagem em pontos (72 dpi) para caber todas as colunas em uma pagina
      const { uri } = await Print.printToFileAsync({ html, width: 842, height: 595 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: "Relatório de Lotes Ativos",
          UTI: "com.adobe.pdf",
        });
      }
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      Alert.alert("Erro", "Não foi possível gerar o PDF.");
    }
  }

  async function handleTrocarRoteiro(novoRoteiroId: string) {
    if (!trocaRoteiroPiquete) return;
    const { piqueteId, piqueteNome } = trocaRoteiroPiquete;

    const roteiroOrigem = roteiros.find((r) => r.piquetes.some((p) => p.piqueteId === piqueteId));
    const roteiroDestino = roteiros.find((r) => r.id === novoRoteiroId);

    if (!roteiroDestino || roteiroOrigem?.id === roteiroDestino.id) {
      setTrocaRoteiroPiquete(null);
      return;
    }

    const novosPiquetesDestino = [...roteiroDestino.piquetes, { piqueteId, piqueteNome }].sort((a, b) =>
      compararPiquetes(a.piqueteNome, b.piqueteNome)
    );
    const novosPiquetesOrigem = roteiroOrigem
      ? roteiroOrigem.piquetes.filter((p) => p.piqueteId !== piqueteId)
      : null;

    try {
      await Promise.all([
        updateDocument(["roteiros"], roteiroDestino.id, { piquetes: novosPiquetesDestino }),
        ...(roteiroOrigem && novosPiquetesOrigem
          ? [updateDocument(["roteiros"], roteiroOrigem.id, { piquetes: novosPiquetesOrigem })]
          : []),
      ]);
      setTrocaRoteiroPiquete(null);
      await fetchDashboard();
    } catch (error) {
      console.error("Erro ao trocar roteiro do piquete:", error);
      Alert.alert("Erro", "Não foi possível trocar o roteiro do piquete.");
    }
  }

  async function handleTransferirLote(form: TransferenciaFormData) {
    if (!transferLote) return;
    const destino = reportRows.find((r) => r.loteId === form.destinoId);
    if (!destino) return;
    try {
      const { origemInativado } = await transferirEntreLotes({
        origemId: transferLote.id,
        origemNumero: transferLote.numero,
        origemPiqueteId: transferLote.piqueteId,
        destinoId: form.destinoId,
        destinoNumero: destino.loteNumero,
        quantidade: form.quantidade,
        pesoMedio: form.pesoMedio,
        data: form.data,
        observacao: form.observacao,
        qtdAtualOrigem: transferLote.qtdAtual,
      });
      const numeroOrigem = transferLote.numero;
      setTransferLote(null);
      await fetchDashboard();
      Alert.alert(
        "Transferência realizada",
        origemInativado
          ? `${form.quantidade} animais transferidos para o Lote ${destino.loteNumero}. O Lote ${numeroOrigem} foi inativado pois o saldo chegou a zero.`
          : `${form.quantidade} animais transferidos para o Lote ${destino.loteNumero}.`
      );
    } catch (error) {
      console.error("Erro ao transferir entre lotes:", error);
      Alert.alert("Erro", "Não foi possível realizar a transferência.");
    }
  }

  const roteiroAtualId = trocaRoteiroPiquete
    ? roteiros.find((r) => r.piquetes.some((p) => p.piqueteId === trocaRoteiroPiquete.piqueteId))?.id
    : undefined;

  const filterModalCol = filterModalColumn ? columns.find((c) => c.key === filterModalColumn) : null;
  const filterModalValues = filterModalCol ? getUniqueColumnValues(filterModalCol) : [];
  const filterModalSelected = filterModalColumn
    ? columnFilters[filterModalColumn] ?? new Set(filterModalValues)
    : new Set<string>();

  return (
    <DrawerSceneWrapper>
      <>
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

            {insumosVencidos.length > 0 && (
              <View style={styles.alertBanner}>
                <Feather name="alert-circle" size={18} color="#FFF" />
                <Text style={styles.alertBannerText}>
                  Conferencia de MS pendente: {insumosVencidos.join(", ")}
                </Text>
              </View>
            )}

            {insumosEstoqueBaixo.length > 0 && (
              <View style={styles.estoqueBaixoCard}>
                <View style={styles.estoqueBaixoHeader}>
                  <Feather name="alert-triangle" size={18} color="#E65100" />
                  <Text style={styles.estoqueBaixoTitle}>Insumos com estoque baixo</Text>
                </View>
                {insumosEstoqueBaixo.map((item) => (
                  <View key={item.id} style={styles.estoqueBaixoItem}>
                    <Text style={styles.estoqueBaixoNome} numberOfLines={1}>{item.nome}</Text>
                    <Text style={styles.estoqueBaixoDetalhe}>
                      {item.estoque.toLocaleString("pt-BR")} kg · Autonomia: {Math.floor(item.autonomiaDias)} dias
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {embarquesHoje.length > 0 && (
              <View style={styles.estoqueBaixoCard}>
                <View style={styles.estoqueBaixoHeader}>
                  <Feather name="truck" size={18} color="#E65100" />
                  <Text style={styles.estoqueBaixoTitle}>Embarques agendados para hoje</Text>
                </View>
                {embarquesHoje.map((item) => (
                  <View key={item.loteId} style={styles.estoqueBaixoItem}>
                    <Text style={styles.estoqueBaixoNome} numberOfLines={1}>
                      Lote {item.loteNumero} — {item.piqueteNome}
                    </Text>
                    <Text style={styles.estoqueBaixoDetalhe}>
                      {item.total
                        ? "Embarque hoje (lote inteiro) — removido do mapa de trato"
                        : `Saída parcial de ${item.quantidade} de ${item.qtdAtual} animais`}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <View style={[styles.header, { paddingTop: headerPaddingTop }]}>
              <Text style={[styles.title, { fontSize: titleFontSize, flex: 1 }]} numberOfLines={1}>Dashboard</Text>
              {!isDesktop && <DrawerToggleButton tintColor="#000000" />}
            </View>

            <Text style={styles.subtitle}>
              Visao geral do seu confinamento.
            </Text>



            {loading ? (
              <ActivityIndicator
                size="large"
                color={primaryColor}
                style={{ marginTop: 48 }}
              />
            ) : (
              <>
                {/* Report Table */}
                {reportRows.length > 0 && (
                  <View style={styles.tableSection}>
                    <View style={styles.tableTitleRow}>
                      <Text style={styles.tableTitle}>Relatorio de Lotes Ativos</Text>
                      <TouchableOpacity
                        style={[styles.pdfButton, { backgroundColor: primaryColor }]}
                        onPress={handleGerarPdf}
                        activeOpacity={0.7}
                      >
                        <Feather name="file-text" size={14} color="#FFF" />
                        <Text style={styles.pdfButtonText}>PDF</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.tableContainer}>
                      <ScrollView horizontal showsHorizontalScrollIndicator>
                        <View>
                          {/* Header */}
                          <View style={[styles.tableHeaderRow, { backgroundColor: primaryColor }]}>
                            {columns.map((col) => {
                              const isSorted = sortKey === col.key;
                              const isFiltered = !!columnFilters[col.key];
                              return (
                                <TouchableOpacity
                                  key={col.key}
                                  style={[styles.tableHeaderCell, styles.tableHeaderCellTouchable, { width: col.width }]}
                                  onPress={() => handleSortPress(col.key)}
                                  activeOpacity={0.7}
                                >
                                  <Text style={styles.tableHeaderText} numberOfLines={2}>{col.label}</Text>
                                  <View style={styles.tableHeaderIcons}>
                                    {isSorted && (
                                      <Feather
                                        name={sortDir === "asc" ? "chevron-up" : "chevron-down"}
                                        size={12}
                                        color="#FFF"
                                      />
                                    )}
                                    <TouchableOpacity
                                      onPress={(e) => {
                                        e.stopPropagation();
                                        setFilterModalColumn(col.key);
                                      }}
                                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                    >
                                      <Feather
                                        name="filter"
                                        size={12}
                                        color={isFiltered ? "#FFD700" : "#FFF"}
                                      />
                                    </TouchableOpacity>
                                  </View>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                          {/* Rows */}
                          {visibleRows.map((row, i) => (
                            <View
                              key={row.loteNumero}
                              style={[
                                styles.tableDataRow,
                                i % 2 === 1 && styles.tableDataRowAlt,
                                !!row.embarqueAgendadoData && styles.tableDataRowEmbarque,
                              ]}
                            >
                              {columns.map((col) => {
                                const heatmapBg = getCellBackgroundColor(row, col);
                                return (
                                <View key={col.key} style={[styles.tableDataCell, { width: col.width }, heatmapBg ? { backgroundColor: heatmapBg } : null]}>
                                  {col.key === "loteNumero" ? (
                                    <View style={styles.dietaCell}>
                                      <Text
                                        style={[
                                          styles.tableDataText,
                                          { flex: 1 },
                                          !!row.embarqueAgendadoData && styles.tableDataTextEmbarque,
                                        ]}
                                        numberOfLines={1}
                                      >
                                        {getCellValue(row, col)}
                                      </Text>
                                      <TouchableOpacity
                                        onPress={() =>
                                          setTransferLote({
                                            id: row.loteId,
                                            numero: row.loteNumero,
                                            piqueteId: row.piqueteId,
                                            qtdAtual: row.quantidade,
                                            pesoPrevisto: row.pesoPrevistoHoje,
                                          })
                                        }
                                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                      >
                                        <Feather name="corner-up-right" size={13} color={primaryColor} />
                                      </TouchableOpacity>
                                      <TouchableOpacity
                                        onPress={() =>
                                          setEmbarqueLote({
                                            id: row.loteId,
                                            numero: row.loteNumero,
                                            qtdAtual: row.quantidade,
                                          })
                                        }
                                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                      >
                                        <Feather name="truck" size={13} color="#E65100" />
                                      </TouchableOpacity>
                                    </View>
                                  ) : col.key === "dieta" ? (
                                    <View style={styles.dietaCell}>
                                      <Text style={[styles.tableDataText, { flex: 1 }]} numberOfLines={1}>
                                        {getCellValue(row, col)}
                                      </Text>
                                      {!!row.piqueteId && (
                                        <TouchableOpacity
                                          onPress={() =>
                                            setTrocaRoteiroPiquete({ piqueteId: row.piqueteId, piqueteNome: row.piquete })
                                          }
                                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                        >
                                          <Feather name="repeat" size={13} color={primaryColor} />
                                        </TouchableOpacity>
                                      )}
                                    </View>
                                  ) : (
                                    <Text style={styles.tableDataText} numberOfLines={1}>
                                      {getCellValue(row, col)}
                                    </Text>
                                  )}
                                </View>
                                );
                              })}
                            </View>
                          ))}
                        </View>
                      </ScrollView>
                    </View>
                  </View>
                )}

                {/* Dashboard Cards */}
                <View style={styles.cardsContainer}>
                  <View style={[styles.card, styles.cardBlue, { flexBasis: cardBasis }]}>
                    <View style={styles.cardIcon}>
                      <Feather name="layers" size={24} color={primaryColor} />
                    </View>
                    <Text style={[styles.cardValue, { fontSize: cardValueFontSize }]} adjustsFontSizeToFit numberOfLines={1}>{lotesAtivos}</Text>
                    <Text style={styles.cardLabel} numberOfLines={2}>Lotes Ativos</Text>
                  </View>

                  <View style={[styles.card, styles.cardGreen, { flexBasis: cardBasis }]}>
                    <View style={styles.cardIcon}>
                      <Feather name="bar-chart-2" size={24} color="#2E7D32" />
                    </View>
                    <Text style={[styles.cardValue, { fontSize: cardValueFontSize }]} adjustsFontSizeToFit numberOfLines={1}>{totalAnimais}</Text>
                    <Text style={styles.cardLabel} numberOfLines={2}>Total de Animais</Text>
                  </View>

                  <View style={[styles.card, styles.cardTeal, { flexBasis: cardBasis }]}>
                    <View style={styles.cardIcon}>
                      <Feather name="log-in" size={24} color="#00796B" />
                    </View>
                    <Text style={[styles.cardValue, { fontSize: cardValueFontSize }]} adjustsFontSizeToFit numberOfLines={1}>{totalEntradas}</Text>
                    <Text style={styles.cardLabel} numberOfLines={2}>Entradas</Text>
                  </View>

                  <View style={[styles.card, styles.cardOrange, { flexBasis: cardBasis }]}>
                    <View style={styles.cardIcon}>
                      <Feather name="dollar-sign" size={24} color="#E65100" />
                    </View>
                    <Text style={[styles.cardValue, { fontSize: cardValueFontSize }]} adjustsFontSizeToFit numberOfLines={1}>{totalVendas}</Text>
                    <Text style={styles.cardLabel} numberOfLines={2}>Vendas</Text>
                  </View>

                  <View style={[styles.card, styles.cardRed, { flexBasis: cardBasis }]}>
                    <View style={styles.cardIcon}>
                      <Feather name="alert-triangle" size={24} color="#C62828" />
                    </View>
                    <Text style={[styles.cardValue, { fontSize: cardValueFontSize }]} adjustsFontSizeToFit numberOfLines={1}>{totalMortes}</Text>
                    <Text style={styles.cardLabel} numberOfLines={2}>Mortes</Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      {filterModalCol && (
        <ColumnFilterModal
          columnLabel={filterModalCol.label}
          values={filterModalValues}
          selectedValues={filterModalSelected}
          onToggleValue={(value) => handleToggleFilterValue(filterModalCol.key, value, filterModalValues)}
          onClose={() => setFilterModalColumn(null)}
        />
      )}
      {transferLote && (
        <TransferenciaLoteModal
          visible
          origem={transferLote}
          lotesDisponiveis={reportRows
            .filter((r) => r.loteId !== transferLote.id)
            .map((r) => ({
              id: r.loteId,
              numero: r.loteNumero,
              piqueteNome: r.piquete === "-" ? "" : r.piquete,
              produtor: r.produtor === "-" ? "" : r.produtor,
            }))}
          onConfirm={handleTransferirLote}
          onClose={() => setTransferLote(null)}
        />
      )}
      <AgendarEmbarqueModal
        visible={!!embarqueLote}
        lote={embarqueLote}
        onClose={() => {
          setEmbarqueLote(null);
          fetchDashboard();
        }}
      />
      {trocaRoteiroPiquete && (
        <TrocarRoteiroModal
          piqueteNome={trocaRoteiroPiquete.piqueteNome}
          roteiros={roteiros}
          roteiroAtualId={roteiroAtualId}
          onSelect={handleTrocarRoteiro}
          onClose={() => setTrocaRoteiroPiquete(null)}
        />
      )}
      </>
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
  // ---- Alert Banner ----
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E65100",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 16,
    gap: 10,
  },
  alertBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: "#FFF",
  },
  // ---- Estoque Baixo Card ----
  estoqueBaixoCard: {
    backgroundColor: "#FFF3E0",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 16,
    gap: 8,
  },
  estoqueBaixoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  estoqueBaixoTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#E65100",
  },
  estoqueBaixoItem: {
    paddingVertical: 4,
  },
  estoqueBaixoNome: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  estoqueBaixoDetalhe: {
    fontSize: 12,
    color: "#666",
  },
  // ---- Report Table ----
  tableSection: {
    marginTop: 24,
    marginBottom: 8,
  },
  tableTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  tableTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  pdfButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  pdfButtonText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "700",
  },
  tableContainer: {
    borderWidth: 1,
    borderColor: "#DCDCDC",
    borderRadius: 8,
    overflow: "hidden",
  },
  tableHeaderRow: {
    flexDirection: "row",
  },
  tableHeaderCell: {
    paddingHorizontal: 6,
    paddingVertical: 10,
    justifyContent: "center",
  },
  tableHeaderCellTouchable: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
  },
  tableHeaderIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  tableHeaderText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFF",
  },
  tableDataRow: {
    flexDirection: "row",
    backgroundColor: "#FFF",
  },
  tableDataRowAlt: {
    backgroundColor: "#F5F7FA",
  },
  tableDataRowEmbarque: {
    backgroundColor: "#FFF3E0",
    borderLeftWidth: 3,
    borderLeftColor: "#E65100",
  },
  tableDataCell: {
    paddingHorizontal: 6,
    paddingVertical: 8,
    justifyContent: "center",
  },
  tableDataText: {
    fontSize: 11,
    color: "#1a1a1a",
  },
  tableDataTextEmbarque: {
    color: "#E65100",
    fontWeight: "700",
  },
  dietaCell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  roteiroOptionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  roteiroOptionSubtitle: {
    fontSize: 13,
    color: "#888",
    marginTop: 2,
  },
  filterModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  filterModalSheet: {
    backgroundColor: "#FDFDFD",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "70%",
    paddingBottom: 24,
    width: "100%",
    maxWidth: 560,
  },
  filterModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 12,
  },
  filterModalHeaderTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  filterModalSearchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 24,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#DCDCDC",
    borderRadius: 8,
    height: 40,
    paddingHorizontal: 10,
  },
  filterModalSearchIcon: {
    marginRight: 8,
  },
  filterModalSearchInput: {
    flex: 1,
    fontSize: 15,
    color: "#1a1a1a",
  },
  filterModalOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ECECEC",
    gap: 12,
  },
  filterModalCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#DCDCDC",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF",
  },
  filterModalOptionText: {
    fontSize: 16,
    color: "#1a1a1a",
  },
  filterModalConfirmButton: {
    marginHorizontal: 24,
    marginTop: 12,
    height: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  filterModalConfirmButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
  filterModalEmptyText: {
    textAlign: "center",
    padding: 24,
    fontSize: 15,
    color: "#999",
  },
  // ---- Dashboard Cards ----
  cardsContainer: {
    marginTop: 32,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  card: {
    flexGrow: 1,
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    minWidth: 120,
  },
  cardBlue: {
    backgroundColor: "#EEF2FF",
  },
  cardGreen: {
    backgroundColor: "#E8F5E9",
  },
  cardRed: {
    backgroundColor: "#FFEBEE",
  },
  cardTeal: {
    backgroundColor: "#E0F2F1",
  },
  cardOrange: {
    backgroundColor: "#FFF3E0",
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  cardValue: {
    fontSize: 32,
    fontWeight: "900",
    color: "#1a1a1a",
  },
  cardLabel: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
    textAlign: "center",
  },
});
