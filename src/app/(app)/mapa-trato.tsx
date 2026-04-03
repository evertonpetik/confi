import { CargaModal, CargaTrato } from "@/components/CargaModal";
import { DescargaModal, DescargaTrato } from "@/components/DescargaModal";
import { DrawerSceneWrapper } from "@/components/drawe-scene-wrapper";
import { DrawerToggleButton } from "@/components/DrawerToggleButton";
import { Select, SelectOption } from "@/components/Select";
import { useResponsive } from "@/hooks/useResponsive";
import { setDocument } from "@/services/firestoreService";
import {
  buildCalcData,
  calcGmdNRC,
  fetchMapaTratoData,
  getHojeStr,
  type RoteiroCalculado,
  type Vagao,
} from "@/utils/mapaTratoCalc";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
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

// ---- CSV Helpers ----

function normalizeStr(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
}

function parseCSVLine(line: string): string[] {
  const cols: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === "," && !inQuotes) { cols.push(current); current = ""; continue; }
    current += ch;
  }
  cols.push(current);
  return cols.map((c) => c.trim());
}

// ---- Component ----

export default function MapaTrato() {
  const { isTablet, isDesktop, maxWidthContent } = useResponsive();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [vagaoOptions, setVagaoOptions] = useState<SelectOption[]>([]);
  const [vagoes, setVagoes] = useState<Vagao[]>([]);
  const [selectedVagaoId, setSelectedVagaoId] = useState("");

  const [roteirosCalc, setRoteirosCalc] = useState<RoteiroCalculado[]>([]);

  // Modal states
  const [cargaModal, setCargaModal] = useState<{ visible: boolean; index: number }>({
    visible: false,
    index: 0,
  });
  const [descargaModal, setDescargaModal] = useState<{ visible: boolean; index: number }>({
    visible: false,
    index: 0,
  });
  const [historicoCargas, setHistoricoCargas] = useState<Map<string, CargaTrato[]>>(new Map());
  const [historicoDescargas, setHistoricoDescargas] = useState<Map<string, DescargaTrato[]>>(new Map());
  const [percentualMSPorRoteiro, setPercentualMSPorRoteiro] = useState<Map<string, number>>(new Map());

  const [dataSelecionada, setDataSelecionada] = useState(() => new Date());
  const hoje = getHojeStr(dataSelecionada);

  function mudarData(delta: number) {
    setDataSelecionada((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + delta);
      return d;
    });
  }

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [hoje])
  );

  async function fetchData() {
    try {
      setLoading(true);
      const data = await fetchMapaTratoData(hoje);

      setVagoes(data.vagoes);
      setVagaoOptions(
        data.vagoes.map((v) => ({ label: `${v.descricao} (${v.capacidade} kg)`, value: v.id }))
          .sort((a, b) => a.label.localeCompare(b.label))
      );
      if (data.vagoes.length === 1) setSelectedVagaoId(data.vagoes[0].id);

      setRoteirosCalc(
        buildCalcData(data.roteiros, data.dietasMap, data.insumosMap, data.lotesByPiquete, data.vagoes[0]?.capacidade ?? 7000, data.fatorMaps)
      );

      setHistoricoCargas(data.historicoCargas);
      setHistoricoDescargas(data.historicoDescargas);
      setPercentualMSPorRoteiro(data.percentualMSPorRoteiro);
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
    } finally {
      setLoading(false);
    }
  }

  // Recalculate when vagão changes
  function handleVagaoSelect(vagaoId: string) {
    setSelectedVagaoId(vagaoId);
    // We need to rebuild calc with new capacity - but we stored raw data
    // For simplicity, re-fetch if needed. Since we already have roteirosCalc,
    // just recalculate numTratos and per-trato values.
    const vagao = vagoes.find((v) => v.id === vagaoId);
    if (!vagao) return;

    setRoteirosCalc((prev) =>
      prev.map((rc) => {
        const { totalMS, totalMO, dieta, lotes: lotesCalc } = rc;
        const numTratos = totalMO > 0 ? Math.max(rc.roteiro.minTratos ?? 1, Math.ceil(totalMO / vagao.capacidade)) : 0;
        const moPerTrato = numTratos > 0 ? totalMO / numTratos : 0;
        const msPerTrato = numTratos > 0 ? totalMS / numTratos : 0;

        let somaMOInsumos = 0;
        const insumosPrevistos = rc.insumosPrevistos.map((ip, idx) => {
          const di = dieta.insumos[idx];
          if (!di) return ip;
          const msInsumo = msPerTrato * (di.percentual / 100);
          // We need insumo MS% but we don't store it in roteirosCalc...
          // Re-derive from existing previsto ratio
          const oldMsPerTrato = rc.numTratos > 0 ? rc.totalMS / rc.numTratos : 0;
          const oldMsInsumo = oldMsPerTrato * (di.percentual / 100);
          const percMS = oldMsInsumo > 0 ? (oldMsInsumo / ip.previsto) * 100 : 100;
          const moInsumo = percMS > 0 ? msInsumo / (percMS / 100) : 0;
          somaMOInsumos += moInsumo;
          return { ...ip, previsto: moInsumo };
        });

        const aguaPrevista = Math.max(0, moPerTrato - somaMOInsumos);

        const descargaPrevistos = lotesCalc.map((l) => ({
          piqueteId: l.lote.piqueteId,
          piqueteNome: l.lote.piqueteNome,
          loteNumero: l.lote.numero,
          previsto: numTratos > 0 ? l.moLote / numTratos : 0,
        }));

        return { ...rc, numTratos, moPerTrato, insumosPrevistos, aguaPrevista, descargaPrevistos };
      })
    );
  }

  async function handleSaveCarga(index: number, cargas: CargaTrato[]) {
    const rc = roteirosCalc[index];
    if (!rc) return;
    try {
      setSaving(true);

      // Sum realizado per insumo across all tratos
      const realizadoPorInsumo = new Map<string, number>();
      for (const carga of cargas) {
        for (const ins of carga.insumos) {
          realizadoPorInsumo.set(
            ins.insumoId,
            (realizadoPorInsumo.get(ins.insumoId) ?? 0) + ins.realizado
          );
        }
      }

      // Build precoMedio lookup from insumosPrevistos
      const precoMedioMap = new Map<string, number>();
      for (const ip of rc.insumosPrevistos) {
        precoMedioMap.set(ip.insumoId, ip.precoMedio);
      }

      // Generate saida docs for each insumo (idempotent via deterministic ID)
      const saidaPromises: Promise<void>[] = [];
      let custoTotal = 0;
      for (const [insumoId, totalRealizado] of realizadoPorInsumo) {
        if (totalRealizado <= 0) continue;
        const precoMedio = precoMedioMap.get(insumoId) ?? 0;
        custoTotal += totalRealizado * precoMedio;
        const saidaDocId = `${rc.roteiro.id}_${hoje}_${insumoId}`;
        saidaPromises.push(
          setDocument(["insumos", insumoId, "saidas"], saidaDocId, {
            data: hoje,
            quantidade: totalRealizado,
            precoKg: precoMedio,
            origem: "mapa-trato",
            roteiroId: rc.roteiro.id,
            roteiroNumero: rc.roteiro.numero,
          })
        );
      }
      await Promise.all(saidaPromises);

      // Distribute cost proportionally across lotes (based on descarga realizado if available)
      const descargasData = historicoDescargas.get(rc.roteiro.id);
      let custoPorLote: { loteId: string; loteNumero: number; piqueteNome: string; custo: number }[];

      const realizadoPorLote = new Map<string, number>();
      let totalRealizadoDescarga = 0;
      if (descargasData && descargasData.length > 0) {
        for (const descarga of descargasData) {
          for (const item of descarga.itens) {
            const lote = rc.lotes.find((l) => l.lote.piqueteId === item.piqueteId);
            if (lote) {
              realizadoPorLote.set(
                lote.lote.id,
                (realizadoPorLote.get(lote.lote.id) ?? 0) + item.realizado
              );
              totalRealizadoDescarga += item.realizado;
            }
          }
        }
      }

      if (totalRealizadoDescarga > 0) {
        custoPorLote = rc.lotes.map((l) => ({
          loteId: l.lote.id,
          loteNumero: l.lote.numero,
          piqueteNome: l.lote.piqueteNome,
          custo: custoTotal * ((realizadoPorLote.get(l.lote.id) ?? 0) / totalRealizadoDescarga),
        }));
      } else {
        // Fallback to previsto proportion when descarga not yet available
        custoPorLote = rc.lotes.map((l) => ({
          loteId: l.lote.id,
          loteNumero: l.lote.numero,
          piqueteNome: l.lote.piqueteNome,
          custo: rc.totalMO > 0 ? custoTotal * (l.moLote / rc.totalMO) : 0,
        }));
      }

      // Calculate percentualMSFinal from realized amounts
      let totalMSRealizada = 0;
      let totalMORealizada = 0;
      for (const carga of cargas) {
        for (const ins of carga.insumos) {
          totalMSRealizada += ins.realizado * ((ins.percentualMS ?? 100) / 100);
          totalMORealizada += ins.realizado;
        }
        totalMORealizada += carga.aguaRealizada;
      }
      const percentualMSFinal = totalMORealizada > 0 ? (totalMSRealizada / totalMORealizada) * 100 : 0;

      // Save historico with cost data
      const docId = `${rc.roteiro.id}_${hoje}`;
      await setDocument(["historicoMapaTrato"], docId, {
        data: hoje,
        roteiroId: rc.roteiro.id,
        roteiroNumero: rc.roteiro.numero,
        dietaId: rc.dieta.id,
        dietaNome: rc.dieta.nome,
        vagaoId: selectedVagaoId,
        vagaoNome: vagoes.find((v) => v.id === selectedVagaoId)?.descricao ?? "",
        totalMS: rc.totalMS,
        totalMO: rc.totalMO,
        numTratos: rc.numTratos,
        cargas,
        custoTotal,
        custoPorLote,
        percentualMSFinal,
      }, { merge: true });
      setHistoricoCargas((prev) => {
        const next = new Map(prev);
        next.set(rc.roteiro.id, cargas);
        return next;
      });
      setPercentualMSPorRoteiro((prev) => {
        const next = new Map(prev);
        next.set(rc.roteiro.id, percentualMSFinal);
        return next;
      });
      setCargaModal({ visible: false, index: 0 });
    } catch (error) {
      console.error("Erro ao salvar carga:", error);
      Alert.alert("Erro", "Não foi possível salvar a carga.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveDescarga(index: number, descargas: DescargaTrato[]) {
    const rc = roteirosCalc[index];
    if (!rc) return;
    try {
      setSaving(true);
      const docId = `${rc.roteiro.id}_${hoje}`;

      const updateData: Record<string, unknown> = {
        data: hoje,
        roteiroId: rc.roteiro.id,
        roteiroNumero: rc.roteiro.numero,
        dietaId: rc.dieta.id,
        dietaNome: rc.dieta.nome,
        vagaoId: selectedVagaoId,
        vagaoNome: vagoes.find((v) => v.id === selectedVagaoId)?.descricao ?? "",
        totalMS: rc.totalMS,
        totalMO: rc.totalMO,
        numTratos: rc.numTratos,
        descargas,
      };

      // Calculate MS volume per lot using percentualMSFinal from carga
      const percMS = percentualMSPorRoteiro.get(rc.roteiro.id) ?? 0;
      if (percMS > 0) {
        const msPorLote: { loteId: string; loteNumero: number; piqueteNome: string; totalMO: number; previsto: number; totalMS: number; cmsPrevisto: number; cmsRealizado: number; gmdEstimado: number; gmdReal: number }[] = [];
        for (const l of rc.lotes) {
          let totalRealizadoLote = 0;
          for (const descarga of descargas) {
            for (const item of descarga.itens) {
              if (item.piqueteId === l.lote.piqueteId) {
                totalRealizadoLote += item.realizado;
              }
            }
          }
          const totalMS = totalRealizadoLote * (percMS / 100);
          const cmsPrevisto = l.lote.cmsAtual;
          const cmsRealizado = (l.qtdAnimais > 0 && l.pesoMedio > 0 && totalRealizadoLote > 0)
            ? (totalMS / (l.qtdAnimais * l.pesoMedio)) * 100
            : 0;

          // GMD real via NRC
          const cmsAnimal = l.qtdAnimais > 0 ? totalMS / l.qtdAnimais : 0;
          const gmdReal = calcGmdNRC(cmsAnimal, l.pesoMedio, rc.dieta.ndt, l.fatores);

          msPorLote.push({
            loteId: l.lote.id,
            loteNumero: l.lote.numero,
            piqueteNome: l.lote.piqueteNome,
            totalMO: totalRealizadoLote,
            previsto: l.moLote,
            totalMS,
            cmsPrevisto,
            cmsRealizado,
            gmdEstimado: l.lote.gmdEstimado,
            gmdReal: parseFloat(gmdReal.toFixed(4)),
          });
        }
        updateData.msPorLote = msPorLote;
        updateData.percentualMSFinal = percMS;
      }

      // Recalculate custoPorLote based on descarga realizado if carga data exists
      const cargasData = historicoCargas.get(rc.roteiro.id);
      if (cargasData && cargasData.length > 0) {
        const precoMedioMap = new Map<string, number>();
        for (const ip of rc.insumosPrevistos) {
          precoMedioMap.set(ip.insumoId, ip.precoMedio);
        }
        let custoTotal = 0;
        for (const carga of cargasData) {
          for (const ins of carga.insumos) {
            if (ins.realizado > 0) {
              custoTotal += ins.realizado * (precoMedioMap.get(ins.insumoId) ?? 0);
            }
          }
        }

        const realizadoPorLote = new Map<string, number>();
        let totalRealizadoDescarga = 0;
        for (const descarga of descargas) {
          for (const item of descarga.itens) {
            const lote = rc.lotes.find((l) => l.lote.piqueteId === item.piqueteId);
            if (lote) {
              realizadoPorLote.set(
                lote.lote.id,
                (realizadoPorLote.get(lote.lote.id) ?? 0) + item.realizado
              );
              totalRealizadoDescarga += item.realizado;
            }
          }
        }

        if (totalRealizadoDescarga > 0 && custoTotal > 0) {
          updateData.custoTotal = custoTotal;
          updateData.custoPorLote = rc.lotes.map((l) => ({
            loteId: l.lote.id,
            loteNumero: l.lote.numero,
            piqueteNome: l.lote.piqueteNome,
            custo: custoTotal * ((realizadoPorLote.get(l.lote.id) ?? 0) / totalRealizadoDescarga),
          }));
        }
      }

      await setDocument(["historicoMapaTrato"], docId, updateData, { merge: true });
      setHistoricoDescargas((prev) => {
        const next = new Map(prev);
        next.set(rc.roteiro.id, descargas);
        return next;
      });
      setDescargaModal({ visible: false, index: 0 });
    } catch (error) {
      console.error("Erro ao salvar descarga:", error);
      Alert.alert("Erro", "Não foi possível salvar a descarga.");
    } finally {
      setSaving(false);
    }
  }

  async function handleImportCSV() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/csv", "text/comma-separated-values", "*/*"],
        multiple: true,
      });
      if (result.canceled || !result.assets?.length) return;

      let cargaImportada = false;
      let descargaImportada = false;

      for (const asset of result.assets) {
        let content: string;
        if (Platform.OS === "web") {
          const response = await fetch(asset.uri);
          const buf = await response.arrayBuffer();
          // Try UTF-8 first; if replacement chars appear, decode as Latin-1
          content = new TextDecoder("utf-8").decode(buf);
          if (content.includes("\uFFFD")) {
            content = new TextDecoder("iso-8859-1").decode(buf);
          }
        } else {
          const file = new File(asset.uri);
          content = await file.text();
          // Handle non-UTF-8 files (e.g., Latin-1/Windows-1252 common in Brazilian systems)
          if (content.includes("\uFFFD")) {
            const base64 = await file.base64();
            const binary = atob(base64);
            content = "";
            for (let i = 0; i < binary.length; i++) {
              content += String.fromCharCode(binary.charCodeAt(i));
            }
          }
        }

        const lines = content.split("\n").filter((l) => l.trim());
        if (lines.length < 2) continue;

        const header = lines[0];

        if (header.includes("Ingrediente")) {
          // --- Carga CSV ---
          const newCargas = new Map<string, CargaTrato[]>(historicoCargas);

          // Parse all data rows
          type CargaRow = { trato: number; ingrediente: string; roteiro: number; quantidade: number };
          const rows: CargaRow[] = [];
          for (let i = 1; i < lines.length; i++) {
            const cols = parseCSVLine(lines[i]);
            if (cols.length < 5) continue;
            rows.push({
              trato: parseInt(cols[0]) || 1,
              ingrediente: cols[1],
              roteiro: parseInt((cols[3] || "").replace(/\D/g, "")) || 0,
              quantidade: parseFloat(cols[4].replace(/[^\d.-]/g, "")) || 0,
            });
          }

          // Group by roteiro number
          for (const rc of activeRoteiros) {
            const roteiroRows = rows.filter((r) => r.roteiro === rc.roteiro.numero);
            if (roteiroRows.length === 0) continue;

            const cargas: CargaTrato[] = [];
            for (let t = 1; t <= rc.numTratos; t++) {
              const tratoRows = roteiroRows.filter((r) => r.trato === t);
              // Match by normalized ingredient name to handle different ordering and accents
              cargas.push({
                tratoNumero: t,
                insumos: rc.insumosPrevistos.map((ip) => {
                  const match = tratoRows.find(
                    (r) => normalizeStr(r.ingrediente) === normalizeStr(ip.insumoNome)
                  );
                  return {
                    insumoId: ip.insumoId,
                    insumoNome: ip.insumoNome,
                    previsto: ip.previsto,
                    realizado: match?.quantidade ?? 0,
                    percentualMS: ip.percentualMS,
                  };
                }),
                aguaPrevista: rc.aguaPrevista,
                aguaRealizada: tratoRows.find(
                  (r) => normalizeStr(r.ingrediente) === "AGUA"
                )?.quantidade ?? 0,
              });
            }
            newCargas.set(rc.roteiro.id, cargas);
          }

          setHistoricoCargas(newCargas);
          cargaImportada = true;
        } else if (header.includes("Descarga")) {
          // --- Descarga CSV ---
          const newDescargas = new Map<string, DescargaTrato[]>(historicoDescargas);

          type DescargaRow = { trato: number; loteNumero: number; realizado: number };
          const rows: DescargaRow[] = [];
          for (let i = 1; i < lines.length; i++) {
            const cols = parseCSVLine(lines[i]);
            if (cols.length < 4) continue;
            rows.push({
              trato: parseInt(cols[0]) || 1,
              loteNumero: parseInt((cols[1] || "").replace(/\D/g, "")) || 0,
              realizado: parseFloat(cols[3].replace(/[^\d.-]/g, "")) || 0,
            });
          }

          for (const rc of activeRoteiros) {
            // Check if any row matches a lote in this roteiro
            const loteNums = rc.descargaPrevistos.map((dp) => dp.loteNumero);
            const roteiroRows = rows.filter((r) => loteNums.includes(r.loteNumero));
            if (roteiroRows.length === 0) continue;

            const descargas: DescargaTrato[] = [];
            for (let t = 1; t <= rc.numTratos; t++) {
              const tratoRows = roteiroRows.filter((r) => r.trato === t);
              descargas.push({
                tratoNumero: t,
                itens: rc.descargaPrevistos.map((dp) => {
                  const match = tratoRows.find((r) => r.loteNumero === dp.loteNumero);
                  return {
                    piqueteId: dp.piqueteId,
                    piqueteNome: dp.piqueteNome,
                    loteNumero: dp.loteNumero,
                    previsto: dp.previsto,
                    realizado: match?.realizado ?? 0,
                  };
                }),
              });
            }
            newDescargas.set(rc.roteiro.id, descargas);
          }

          setHistoricoDescargas(newDescargas);
          descargaImportada = true;
        }
      }

      const msgs: string[] = [];
      if (cargaImportada) msgs.push("Carga");
      if (descargaImportada) msgs.push("Descarga");
      if (msgs.length > 0) {
        Alert.alert("Importado", `${msgs.join(" e ")} importada com sucesso.`);
      } else {
        Alert.alert("Atenção", "Nenhum arquivo CSV válido foi encontrado.");
      }
    } catch (error) {
      console.error("Erro ao importar CSV:", error);
      Alert.alert("Erro", "Não foi possível importar o CSV.");
    }
  }

  const activeRoteiros = roteirosCalc.filter(
    (rc) => rc.numTratos > 0 && rc.lotes.length > 0
  );

  function generateCSV(): string {
    const MAX_COLS = 10;
    const MAX_INSUMOS = 18;
    const MAX_TRATOS = 10;
    const TOTAL_CSV_COLS = MAX_COLS + 1; // Ingredientes col + 10 data cols

    function padRow(cols: string[]): string {
      const padded = [...cols];
      while (padded.length < TOTAL_CSV_COLS) padded.push(" ");
      return padded.join(",");
    }

    const lines: string[] = [];

    // --- Seção 1: Ingredientes (Carga) - percentuais por dieta ---
    // Collect unique diets from active roteiros
    const uniqueDietas: RoteiroCalculado[] = [];
    const dietasSeen = new Set<string>();
    for (const rc of activeRoteiros) {
      if (!dietasSeen.has(rc.dieta.id)) {
        dietasSeen.add(rc.dieta.id);
        uniqueDietas.push(rc);
      }
    }

    const allInsumoNames: string[] = [];
    for (const rc of uniqueDietas) {
      for (const ip of rc.insumosPrevistos) {
        if (!allInsumoNames.includes(ip.insumoNome)) {
          allInsumoNames.push(ip.insumoNome);
        }
      }
    }

    // Header: Ingredientes, <dieta1>, <dieta2>, ..., - (padded to 10 cols)
    const headerCols: string[] = ["Ingredientes"];
    for (const rc of uniqueDietas) {
      headerCols.push(` ${rc.dieta.nome} `);
    }
    while (headerCols.length < TOTAL_CSV_COLS) headerCols.push(" -   ");
    lines.push(headerCols.join(","));

    // Each insumo row (percentual MO = previsto / moPerTrato * 100)
    for (const nome of allInsumoNames) {
      const cols: string[] = [nome];
      for (const rc of uniqueDietas) {
        const ip = rc.insumosPrevistos.find((i) => i.insumoNome === nome);
        if (ip && rc.moPerTrato > 0) {
          const pctMO = (ip.previsto / rc.moPerTrato) * 100;
          cols.push(` ${pctMO.toFixed(2)} `);
        } else {
          cols.push(" ");
        }
      }
      lines.push(padRow(cols));
    }

    // Filler rows (0) up to MAX_INSUMOS
    const fillCount = Math.max(0, MAX_INSUMOS - allInsumoNames.length);
    for (let i = 0; i < fillCount; i++) {
      const cols: string[] = ["0"];
      lines.push(padRow(cols));
    }

    // Água row (percentual MO)
    const aguaCols: string[] = ["Água"];
    for (const rc of uniqueDietas) {
      if (rc.moPerTrato > 0) {
        const pctAgua = (rc.aguaPrevista / rc.moPerTrato) * 100;
        aguaCols.push(` ${pctAgua.toFixed(2)} `);
      } else {
        aguaCols.push(" ");
      }
    }
    lines.push(padRow(aguaCols));

    // Label row
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mmm = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][now.getMonth()];
    const yyyy = now.getFullYear();
    const hh = String(now.getHours()).padStart(2, "0");
    const mi = String(now.getMinutes()).padStart(2, "0");
    lines.push(padRow([`Tabela Importa2 ${dd}${mmm}${yyyy} ${hh} ${mi}`]));

    // 4 empty rows
    for (let i = 0; i < 4; i++) {
      lines.push(padRow([]));
    }

    // --- Seção 2: Descarga ---
    lines.push(padRow(["Curral", "Lote", "Dieta", "Oferta", "Num_trato", "Roteiro"]));

    for (const rc of activeRoteiros) {
      for (const dp of rc.descargaPrevistos) {
        for (let trato = 1; trato <= MAX_TRATOS; trato++) {
          const isActive = trato <= rc.numTratos;
          const oferta = isActive ? ` ${dp.previsto.toFixed(2)} ` : " -   ";
          const dieta = isActive ? rc.dieta.nome : "0";
          lines.push(
            padRow([
              dp.piqueteNome,
              `Lote ${dp.loteNumero}`,
              dieta,
              oferta,
              ` ${trato} `,
              `Roteiro ${rc.roteiro.numero}`,
            ])
          );
        }
      }
    }

    return lines.join("\n");
  }

  async function handleExportCSV() {
    try {
      const csvContent = generateCSV();
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, "0");
      const mmm = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][now.getMonth()];
      const yyyy = now.getFullYear();
      const hh = String(now.getHours()).padStart(2, "0");
      const mi = String(now.getMinutes()).padStart(2, "0");
      const fileName = `Metas_de_Trato_${dd}${mmm}${yyyy}_${hh}_${mi}.csv`;

      if (Platform.OS === "web") {
        const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        const file = new File(Paths.cache, fileName);
        file.write(csvContent);
        await Sharing.shareAsync(file.uri, {
          mimeType: "text/csv",
          UTI: "public.comma-separated-values-text",
        });
      }
    } catch (error) {
      console.error("Erro ao exportar CSV:", error);
      Alert.alert("Erro", "Não foi possível exportar o CSV.");
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
              <Text style={styles.title}>Mapa de Trato</Text>
              {!isDesktop && <DrawerToggleButton tintColor="#000000" />}
            </View>

            <Text style={styles.subtitle}>
              Selecione o vagão e acompanhe a carga e descarga de cada roteiro.
            </Text>

            <View style={styles.dateRow}>
              <Text style={styles.dateLabel}>Data:</Text>
              <TouchableOpacity onPress={() => mudarData(-1)} style={styles.dateArrow}>
                <Feather name="chevron-left" size={20} color="#3366FF" />
              </TouchableOpacity>
              <Text style={styles.dateValue}>
                {dataSelecionada.toLocaleDateString("pt-BR")}
              </Text>
              <TouchableOpacity onPress={() => mudarData(1)} style={styles.dateArrow}>
                <Feather name="chevron-right" size={20} color="#3366FF" />
              </TouchableOpacity>
              {hoje !== getHojeStr() && (
                <TouchableOpacity onPress={() => setDataSelecionada(new Date())} style={styles.dateHojeBtn}>
                  <Text style={styles.dateHojeBtnText}>Hoje</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Select Vagão */}
            <Text style={styles.sectionLabel}>Vagão</Text>
            <Select
              placeholder="Selecione o vagão"
              value={selectedVagaoId}
              options={vagaoOptions}
              onSelect={handleVagaoSelect}
            />

            {loading ? (
              <ActivityIndicator
                size="large"
                color="#3366FF"
                style={{ marginTop: 32 }}
              />
            ) : !selectedVagaoId ? (
              <Text style={styles.emptyText}>
                Selecione um vagão para ver os roteiros.
              </Text>
            ) : activeRoteiros.length === 0 ? (
              <Text style={styles.emptyText}>
                Nenhum roteiro com lotes ativos encontrado.
              </Text>
            ) : (
              <>
                <View style={styles.csvButtonsRow}>
                  <TouchableOpacity
                    style={styles.exportButton}
                    activeOpacity={0.8}
                    onPress={handleExportCSV}
                  >
                    <Feather name="file-text" size={18} color="#FFF" />
                    <Text style={styles.exportButtonLabel}>Exportar CSV</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.importButton}
                    activeOpacity={0.8}
                    onPress={handleImportCSV}
                  >
                    <Feather name="upload" size={18} color="#FFF" />
                    <Text style={styles.exportButtonLabel}>Importar Realizados</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.list}>
                  {activeRoteiros.map((rc, index) => {
                    const hasCarga = historicoCargas.has(rc.roteiro.id);
                    const hasDescarga = historicoDescargas.has(rc.roteiro.id);

                    return (
                      <View key={rc.roteiro.id} style={styles.roteiroCard}>
                        <View style={styles.cardHeader}>
                          <Text style={styles.cardTitle}>
                            Roteiro {rc.roteiro.numero}
                          </Text>
                          {hasCarga && (
                            <View style={styles.checkBadge}>
                              <Feather name="check" size={12} color="#FFF" />
                              <Text style={styles.checkBadgeText}>Carga</Text>
                            </View>
                          )}
                          {hasDescarga && (
                            <View style={[styles.checkBadge, styles.checkBadgeDescarga]}>
                              <Feather name="check" size={12} color="#FFF" />
                              <Text style={styles.checkBadgeText}>Descarga</Text>
                            </View>
                          )}
                        </View>

                        <Text style={styles.cardSubText}>
                          Dieta: {rc.dieta.nome}
                        </Text>
                        <Text style={styles.cardSubText}>
                          Piquetes:{" "}
                          {rc.roteiro.piquetes.map((p) => p.piqueteNome).join(", ")}
                        </Text>

                        <View style={styles.cardStatsRow}>
                          <View style={styles.cardStat}>
                            <Text style={styles.cardStatLabel}>MO Total</Text>
                            <Text style={styles.cardStatValue}>
                              {Math.round(rc.totalMO)} kg
                            </Text>
                          </View>
                          <View style={styles.cardStat}>
                            <Text style={styles.cardStatLabel}>Tratos</Text>
                            <Text style={styles.cardStatValue}>
                              {rc.numTratos}
                            </Text>
                          </View>
                          <View style={styles.cardStat}>
                            <Text style={styles.cardStatLabel}>MO/Trato</Text>
                            <Text style={styles.cardStatValue}>
                              {Math.round(rc.moPerTrato)} kg
                            </Text>
                          </View>
                        </View>

                        <View style={styles.cardActions}>
                          <TouchableOpacity
                            style={[styles.actionBtn, styles.actionBtnCarga]}
                            activeOpacity={0.8}
                            onPress={() =>
                              setCargaModal({ visible: true, index })
                            }
                          >
                            <Feather name="download" size={16} color="#FFF" />
                            <Text style={styles.actionBtnText}>Carga</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.actionBtn, styles.actionBtnDescarga]}
                            activeOpacity={0.8}
                            onPress={() =>
                              setDescargaModal({ visible: true, index })
                            }
                          >
                            <Feather name="upload" size={16} color="#FFF" />
                            <Text style={styles.actionBtnText}>Descarga</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Carga Modal */}
      {cargaModal.visible && activeRoteiros[cargaModal.index] && (
        <CargaModal
          visible
          roteiroNumero={activeRoteiros[cargaModal.index].roteiro.numero}
          numTratos={activeRoteiros[cargaModal.index].numTratos}
          insumosPrevistos={activeRoteiros[cargaModal.index].insumosPrevistos}
          aguaPrevista={activeRoteiros[cargaModal.index].aguaPrevista}
          cargas={historicoCargas.get(activeRoteiros[cargaModal.index].roteiro.id) ?? []}
          onSave={(cargas) => handleSaveCarga(cargaModal.index, cargas)}
          onClose={() => setCargaModal({ visible: false, index: 0 })}
        />
      )}

      {/* Descarga Modal */}
      {descargaModal.visible && activeRoteiros[descargaModal.index] && (
        <DescargaModal
          visible
          roteiroNumero={activeRoteiros[descargaModal.index].roteiro.numero}
          numTratos={activeRoteiros[descargaModal.index].numTratos}
          descargaPrevistos={activeRoteiros[descargaModal.index].descargaPrevistos}
          descargas={
            historicoDescargas.get(activeRoteiros[descargaModal.index].roteiro.id) ?? []
          }
          percentualMSFinal={percentualMSPorRoteiro.get(activeRoteiros[descargaModal.index].roteiro.id) ?? 0}
          lotesInfo={activeRoteiros[descargaModal.index].lotes.map((l) => ({
            piqueteId: l.lote.piqueteId,
            cmsAtual: l.lote.cmsAtual,
            qtdAnimais: l.qtdAnimais,
            pesoMedio: l.pesoMedio,
            gmdEstimado: l.lote.gmdEstimado,
            fatores: l.fatores,
          }))}
          ndt={activeRoteiros[descargaModal.index].dieta.ndt}
          onSave={(descargas) =>
            handleSaveDescarga(descargaModal.index, descargas)
          }
          onClose={() => setDescargaModal({ visible: false, index: 0 })}
        />
      )}
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
  dateArrow: {
    padding: 4,
  },
  dateHojeBtn: {
    backgroundColor: "#3366FF",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 4,
  },
  dateHojeBtnText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "700",
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#444",
    marginTop: 20,
    marginBottom: 6,
  },
  emptyText: {
    textAlign: "center",
    marginTop: 32,
    fontSize: 16,
    color: "#999",
  },
  list: {
    marginTop: 24,
    gap: 16,
  },
  roteiroCard: {
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    padding: 16,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  checkBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#4CAF50",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  checkBadgeDescarga: {
    backgroundColor: "#FF9800",
  },
  checkBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFF",
  },
  cardSubText: {
    fontSize: 13,
    color: "#888",
    marginTop: 2,
  },
  cardStatsRow: {
    flexDirection: "row",
    marginTop: 12,
    gap: 16,
  },
  cardStat: {
    alignItems: "center",
  },
  cardStatLabel: {
    fontSize: 11,
    color: "#999",
  },
  cardStatValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  cardActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 42,
    borderRadius: 8,
    gap: 6,
  },
  actionBtnCarga: {
    backgroundColor: "#3366FF",
  },
  actionBtnDescarga: {
    backgroundColor: "#FF9800",
  },
  actionBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
  },
  csvButtonsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 20,
  },
  exportButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4CAF50",
    borderRadius: 8,
    height: 44,
    gap: 8,
  },
  importButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3366FF",
    borderRadius: 8,
    height: 44,
    gap: 8,
  },
  exportButtonLabel: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "600",
  },
});
