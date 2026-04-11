import { CargaTrato } from "@/components/CargaModal";
import { DescargaTrato } from "@/components/DescargaModal";
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
  type MapaTratoFetchResult,
  type RoteiroCalculado,
  type Vagao,
} from "@/utils/mapaTratoCalc";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// ---- Types ----

type Step =
  | "SELECT_VAGAO"
  | "SELECT_ROTEIRO"
  | "LOADING"
  | "CARREGAMENTO"
  | "DESCARREGAMENTO"
  | "CONCLUIDO";

type CargaItem = {
  insumoId: string;
  insumoNome: string;
  previsto: number;
  realizado: number;
  precoMedio: number;
  percentualMS: number;
};

type DescargaItem = {
  piqueteId: string;
  piqueteNome: string;
  loteNumero: number;
  previsto: number;
  realizado: number;
};

// ---- Component ----

export default function Tratador() {
  const { isTablet, isDesktop, maxWidthContent, containerPadding, titleFontSize, headerPaddingTop, isSmallPhone } = useResponsive();
  const [step, setStep] = useState<Step>("SELECT_VAGAO");
  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  // Data
  const [vagoes, setVagoes] = useState<Vagao[]>([]);
  const [vagaoOptions, setVagaoOptions] = useState<SelectOption[]>([]);
  const [selectedVagaoId, setSelectedVagaoId] = useState("");
  const [roteiroOptions, setRoteiroOptions] = useState<SelectOption[]>([]);
  const [selectedRoteiroId, setSelectedRoteiroId] = useState("");
  const dataRef = useRef<MapaTratoFetchResult | null>(null);

  // Calculated
  const [rc, setRc] = useState<RoteiroCalculado | null>(null);

  // Trato tracking
  const [currentTratoNumero, setCurrentTratoNumero] = useState(1);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);

  // Carga
  const [cargaItems, setCargaItems] = useState<CargaItem[]>([]);
  const [aguaPrevista, setAguaPrevista] = useState(0);
  const [aguaRealizada, setAguaRealizada] = useState(0);
  const [allCargas, setAllCargas] = useState<CargaTrato[]>([]);

  // Descarga
  const [descargaItems, setDescargaItems] = useState<DescargaItem[]>([]);
  const [allDescargas, setAllDescargas] = useState<DescargaTrato[]>([]);

  // Historico
  const [, setHistoricoCargas] = useState<CargaTrato[]>([]);
  const [, setHistoricoDescargas] = useState<DescargaTrato[]>([]);
  const [percentualMSFinal, setPercentualMSFinal] = useState(0);

  const inputRef = useRef<TextInput>(null);
  const hoje = getHojeStr();

  // ---- Load vagoes on focus ----
  useFocusEffect(
    useCallback(() => {
      loadVagoes();
    }, [])
  );

  async function loadVagoes() {
    try {
      setLoadingData(true);
      const data = await fetchMapaTratoData();
      dataRef.current = data;
      setVagoes(data.vagoes);
      setVagaoOptions(
        data.vagoes
          .map((v) => ({ label: `${v.descricao} (${v.capacidade} kg)`, value: v.id }))
          .sort((a, b) => a.label.localeCompare(b.label))
      );
      if (data.vagoes.length === 1) setSelectedVagaoId(data.vagoes[0].id);

      // Build roteiro options
      const allCalc = buildCalcData(
        data.roteiros,
        data.dietasMap,
        data.insumosMap,
        data.lotesByPiquete,
        data.vagoes[0]?.capacidade ?? 7000,
        data.fatorMaps
      );
      const active = allCalc.filter((r) => r.numTratos > 0 && r.lotes.length > 0);
      setRoteiroOptions(
        active.map((r) => ({
          label: `Roteiro ${r.roteiro.numero} - ${r.dieta.nome}`,
          value: r.roteiro.id,
        }))
      );
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      Alert.alert("Erro", "Não foi possível carregar os dados.");
    } finally {
      setLoadingData(false);
    }
  }

  // ---- Handlers ----

  function handleVagaoConfirm() {
    if (!selectedVagaoId) return;
    setStep("SELECT_ROTEIRO");
  }

  function handleRoteiroConfirm() {
    if (!selectedRoteiroId || !dataRef.current) return;
    setStep("LOADING");

    const data = dataRef.current;
    const vagao = vagoes.find((v) => v.id === selectedVagaoId);
    const cap = vagao?.capacidade ?? 7000;

    const allCalc = buildCalcData(
      data.roteiros,
      data.dietasMap,
      data.insumosMap,
      data.lotesByPiquete,
      cap,
      data.fatorMaps
    );

    const selected = allCalc.find((r) => r.roteiro.id === selectedRoteiroId);
    if (!selected || selected.numTratos === 0) {
      Alert.alert("Atenção", "Roteiro sem lotes ativos ou sem tratos.");
      setStep("SELECT_ROTEIRO");
      return;
    }

    setRc(selected);

    // Load existing historico for this roteiro
    const existingCargas = data.historicoCargas.get(selectedRoteiroId) ?? [];
    const existingDescargas = data.historicoDescargas.get(selectedRoteiroId) ?? [];
    const existingMS = data.percentualMSPorRoteiro.get(selectedRoteiroId) ?? 0;

    setHistoricoCargas(existingCargas);
    setHistoricoDescargas(existingDescargas);
    setAllCargas([...existingCargas]);
    setAllDescargas([...existingDescargas]);
    setPercentualMSFinal(existingMS);

    // Auto-detect next trato
    const { tratoNumero, startAt } = detectNextTrato(
      selected.numTratos,
      existingCargas,
      existingDescargas
    );

    setCurrentTratoNumero(tratoNumero);

    if (startAt === "CONCLUIDO") {
      setStep("CONCLUIDO");
      return;
    }

    if (startAt === "CARREGAMENTO") {
      initCarga(selected, tratoNumero);
      setStep("CARREGAMENTO");
    } else {
      initDescarga(selected, tratoNumero);
      setStep("DESCARREGAMENTO");
    }
  }

  function detectNextTrato(
    numTratos: number,
    cargas: CargaTrato[],
    descargas: DescargaTrato[]
  ): { tratoNumero: number; startAt: "CARREGAMENTO" | "DESCARREGAMENTO" | "CONCLUIDO" } {
    for (let t = 1; t <= numTratos; t++) {
      const carga = cargas.find((c) => c.tratoNumero === t);
      const descarga = descargas.find((d) => d.tratoNumero === t);

      const cargaDone = carga && carga.insumos.some((i) => i.realizado > 0);
      const descargaDone = descarga && descarga.itens.some((i) => i.realizado > 0);

      if (!cargaDone) return { tratoNumero: t, startAt: "CARREGAMENTO" };
      if (!descargaDone) return { tratoNumero: t, startAt: "DESCARREGAMENTO" };
    }
    return { tratoNumero: numTratos, startAt: "CONCLUIDO" };
  }

  function initCarga(rotCalc: RoteiroCalculado, _tratoNum: number) {
    const items: CargaItem[] = rotCalc.insumosPrevistos.map((ip) => ({
      insumoId: ip.insumoId,
      insumoNome: ip.insumoNome,
      previsto: ip.previsto,
      realizado: Math.round(ip.previsto),
      precoMedio: ip.precoMedio,
      percentualMS: ip.percentualMS,
    }));
    setCargaItems(items);
    setAguaPrevista(rotCalc.aguaPrevista);
    setAguaRealizada(Math.round(rotCalc.aguaPrevista));
    setCurrentItemIndex(0);
  }

  function initDescarga(rotCalc: RoteiroCalculado, _tratoNum: number) {
    const items: DescargaItem[] = rotCalc.descargaPrevistos.map((dp) => ({
      piqueteId: dp.piqueteId,
      piqueteNome: dp.piqueteNome,
      loteNumero: dp.loteNumero,
      previsto: dp.previsto,
      realizado: Math.round(dp.previsto),
    }));
    setDescargaItems(items);
    setCurrentItemIndex(0);
  }

  // ---- Navigation ----

  function handlePrev() {
    if (currentItemIndex > 0) {
      setCurrentItemIndex((p) => p - 1);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  function handleNext() {
    const totalItems =
      step === "CARREGAMENTO" ? cargaItems.length + 1 : descargaItems.length; // +1 for water in carga

    if (currentItemIndex < totalItems - 1) {
      setCurrentItemIndex((p) => p + 1);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  // ---- Carga value update ----

  function updateCargaRealizado(value: string) {
    const num = parseFloat(value) || 0;
    if (currentItemIndex < cargaItems.length) {
      setCargaItems((prev) => {
        const next = [...prev];
        next[currentItemIndex] = { ...next[currentItemIndex], realizado: num };
        return next;
      });
    } else {
      // Water item
      setAguaRealizada(num);
    }
  }

  // ---- Descarga value update ----

  function updateDescargaRealizado(value: string) {
    const num = parseFloat(value) || 0;
    setDescargaItems((prev) => {
      const next = [...prev];
      next[currentItemIndex] = { ...next[currentItemIndex], realizado: num };
      return next;
    });
  }

  // ---- Save Carga ----

  async function handleSaveCarga() {
    if (!rc) return;
    try {
      setSaving(true);

      const cargaTrato: CargaTrato = {
        tratoNumero: currentTratoNumero,
        insumos: cargaItems.map((ci) => ({
          insumoId: ci.insumoId,
          insumoNome: ci.insumoNome,
          previsto: ci.previsto,
          realizado: ci.realizado,
          percentualMS: ci.percentualMS,
        })),
        aguaPrevista,
        aguaRealizada,
      };

      // Build full cargas array
      const updatedCargas = [
        ...allCargas.filter((c) => c.tratoNumero !== currentTratoNumero),
        cargaTrato,
      ].sort((a, b) => a.tratoNumero - b.tratoNumero);
      setAllCargas(updatedCargas);

      // Sum realizado per insumo across ALL tratos
      const realizadoPorInsumo = new Map<string, number>();
      for (const carga of updatedCargas) {
        for (const ins of carga.insumos) {
          realizadoPorInsumo.set(
            ins.insumoId,
            (realizadoPorInsumo.get(ins.insumoId) ?? 0) + ins.realizado
          );
        }
      }

      // Build precoMedio lookup
      const precoMedioMap = new Map<string, number>();
      for (const ip of rc.insumosPrevistos) {
        precoMedioMap.set(ip.insumoId, ip.precoMedio);
      }

      // Generate saida docs
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
            origem: "tratador",
            roteiroId: rc.roteiro.id,
            roteiroNumero: rc.roteiro.numero,
          })
        );
      }
      await Promise.all(saidaPromises);

      // Distribute cost proportionally (fallback to previsto)
      const custoPorLote = rc.lotes.map((l) => ({
        loteId: l.lote.id,
        loteNumero: l.lote.numero,
        piqueteNome: l.lote.piqueteNome,
        custo: rc.totalMO > 0 ? custoTotal * (l.moLote / rc.totalMO) : 0,
      }));

      // Calculate percentualMSFinal
      let totalMSRealizada = 0;
      let totalMORealizada = 0;
      for (const carga of updatedCargas) {
        for (const ins of carga.insumos) {
          totalMSRealizada += ins.realizado * ((ins.percentualMS ?? 100) / 100);
          totalMORealizada += ins.realizado;
        }
        totalMORealizada += carga.aguaRealizada;
      }
      const percMSFinal = totalMORealizada > 0 ? (totalMSRealizada / totalMORealizada) * 100 : 0;
      setPercentualMSFinal(percMSFinal);

      const vagao = vagoes.find((v) => v.id === selectedVagaoId);
      const docId = `${rc.roteiro.id}_${hoje}`;
      await setDocument(
        ["historicoMapaTrato"], docId,
        {
          data: hoje,
          roteiroId: rc.roteiro.id,
          roteiroNumero: rc.roteiro.numero,
          dietaId: rc.dieta.id,
          dietaNome: rc.dieta.nome,
          vagaoId: selectedVagaoId,
          vagaoNome: vagao?.descricao ?? "",
          totalMS: rc.totalMS,
          totalMO: rc.totalMO,
          numTratos: rc.numTratos,
          cargas: updatedCargas,
          custoTotal,
          custoPorLote,
          percentualMSFinal: percMSFinal,
        },
        { merge: true }
      );

      // Move to descarga
      initDescarga(rc, currentTratoNumero);
      setStep("DESCARREGAMENTO");
    } catch (error) {
      console.error("Erro ao salvar carga:", error);
      Alert.alert("Erro", "Não foi possível salvar a carga.");
    } finally {
      setSaving(false);
    }
  }

  // ---- Save Descarga ----

  async function handleSaveDescarga() {
    if (!rc) return;
    try {
      setSaving(true);

      const descargaTrato: DescargaTrato = {
        tratoNumero: currentTratoNumero,
        itens: descargaItems.map((di) => ({
          piqueteId: di.piqueteId,
          piqueteNome: di.piqueteNome,
          loteNumero: di.loteNumero,
          previsto: di.previsto,
          realizado: di.realizado,
        })),
      };

      const updatedDescargas = [
        ...allDescargas.filter((d) => d.tratoNumero !== currentTratoNumero),
        descargaTrato,
      ].sort((a, b) => a.tratoNumero - b.tratoNumero);
      setAllDescargas(updatedDescargas);

      const vagao = vagoes.find((v) => v.id === selectedVagaoId);
      const docId = `${rc.roteiro.id}_${hoje}`;

      const updateData: Record<string, unknown> = {
        data: hoje,
        roteiroId: rc.roteiro.id,
        roteiroNumero: rc.roteiro.numero,
        dietaId: rc.dieta.id,
        dietaNome: rc.dieta.nome,
        vagaoId: selectedVagaoId,
        vagaoNome: vagao?.descricao ?? "",
        totalMS: rc.totalMS,
        totalMO: rc.totalMO,
        numTratos: rc.numTratos,
        descargas: updatedDescargas,
      };

      // Calculate MS per lote
      const percMS = percentualMSFinal;
      if (percMS > 0) {
        const msPorLote: Record<string, unknown>[] = [];
        for (const l of rc.lotes) {
          let totalRealizadoLote = 0;
          for (const descarga of updatedDescargas) {
            for (const item of descarga.itens) {
              if (item.piqueteId === l.lote.piqueteId) {
                totalRealizadoLote += item.realizado;
              }
            }
          }
          const totalMS = totalRealizadoLote * (percMS / 100);
          const cmsPrevisto = l.lote.cmsAtual;
          const cmsRealizado =
            l.qtdAnimais > 0 && l.pesoMedio > 0 && totalRealizadoLote > 0
              ? (totalMS / (l.qtdAnimais * l.pesoMedio)) * 100
              : 0;

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

      // Recalculate custoPorLote based on descarga realizado
      if (allCargas.length > 0) {
        const precoMedioMap = new Map<string, number>();
        for (const ip of rc.insumosPrevistos) {
          precoMedioMap.set(ip.insumoId, ip.precoMedio);
        }
        let custoTotal = 0;
        for (const carga of allCargas) {
          for (const ins of carga.insumos) {
            if (ins.realizado > 0) {
              custoTotal += ins.realizado * (precoMedioMap.get(ins.insumoId) ?? 0);
            }
          }
        }

        const realizadoPorLote = new Map<string, number>();
        let totalRealizadoDescarga = 0;
        for (const descarga of updatedDescargas) {
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
            custo:
              custoTotal * ((realizadoPorLote.get(l.lote.id) ?? 0) / totalRealizadoDescarga),
          }));
        }
      }

      await setDocument(["historicoMapaTrato"], docId, updateData, { merge: true });

      // Check if more tratos
      if (currentTratoNumero < rc.numTratos) {
        setStep("CONCLUIDO");
      } else {
        setStep("CONCLUIDO");
      }
    } catch (error) {
      console.error("Erro ao salvar descarga:", error);
      Alert.alert("Erro", "Não foi possível salvar a descarga.");
    } finally {
      setSaving(false);
    }
  }

  // ---- Next trato from concluido ----

  function handleNextTrato() {
    if (!rc) return;
    const nextTrato = currentTratoNumero + 1;
    if (nextTrato <= rc.numTratos) {
      setCurrentTratoNumero(nextTrato);
      initCarga(rc, nextTrato);
      setStep("CARREGAMENTO");
    }
  }

  function handleFinish() {
    setSelectedRoteiroId("");
    setRc(null);
    setAllCargas([]);
    setAllDescargas([]);
    // Re-fetch data to get updated historico
    setLoadingData(true);
    setStep("SELECT_ROTEIRO");
    reloadData();
  }

  function handleBackToVagao() {
    setSelectedVagaoId("");
    setSelectedRoteiroId("");
    setRc(null);
    // Re-fetch data to get updated historico
    setLoadingData(true);
    setStep("SELECT_VAGAO");
    reloadData();
  }

  function handleExit() {
    setStep("SELECT_VAGAO");
    setSelectedVagaoId("");
    setSelectedRoteiroId("");
    setRc(null);
    setAllCargas([]);
    setAllDescargas([]);
    setCargaItems([]);
    setDescargaItems([]);
    // Re-fetch data to get updated historico
    setLoadingData(true);
    reloadData();
  }

  async function reloadData() {
    try {
      const data = await fetchMapaTratoData();
      dataRef.current = data;
      setVagoes(data.vagoes);
      setVagaoOptions(
        data.vagoes
          .map((v) => ({ label: `${v.descricao} (${v.capacidade} kg)`, value: v.id }))
          .sort((a, b) => a.label.localeCompare(b.label))
      );
      if (data.vagoes.length === 1) setSelectedVagaoId(data.vagoes[0].id);

      const allCalc = buildCalcData(
        data.roteiros,
        data.dietasMap,
        data.insumosMap,
        data.lotesByPiquete,
        data.vagoes[0]?.capacidade ?? 7000,
        data.fatorMaps
      );
      const active = allCalc.filter((r) => r.numTratos > 0 && r.lotes.length > 0);
      setRoteiroOptions(
        active.map((r) => ({
          label: `Roteiro ${r.roteiro.numero} - ${r.dieta.nome}`,
          value: r.roteiro.id,
        }))
      );
    } catch (error) {
      console.error("Erro ao recarregar dados:", error);
    } finally {
      setLoadingData(false);
    }
  }

  // ---- Render helpers ----

  function renderDots(current: number, total: number) {
    const dots = [];
    for (let i = 0; i < total; i++) {
      dots.push(
        <View
          key={i}
          style={[
            styles.dot,
            i < current
              ? styles.dotCompleted
              : i === current
                ? styles.dotActive
                : styles.dotPending,
          ]}
        />
      );
    }
    return <View style={styles.dotsRow}>{dots}</View>;
  }

  // ---- Get current item info ----

  function getCurrentCargaInfo(): { label: string; previsto: number; realizado: number } {
    if (currentItemIndex < cargaItems.length) {
      const item = cargaItems[currentItemIndex];
      return {
        label: item.insumoNome,
        previsto: item.previsto,
        realizado: item.realizado,
      };
    }
    // Water (last item)
    return { label: "Agua", previsto: aguaPrevista, realizado: aguaRealizada };
  }

  function getCurrentDescargaInfo(): { label: string; previsto: number; realizado: number } {
    const item = descargaItems[currentItemIndex];
    if (!item) return { label: "", previsto: 0, realizado: 0 };
    return {
      label: `${item.piqueteNome}\nLote ${item.loteNumero}`,
      previsto: item.previsto,
      realizado: item.realizado,
    };
  }

  // ---- Render ----

  // SELECT_VAGAO
  if (step === "SELECT_VAGAO") {
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
                <Text style={[styles.title, { fontSize: titleFontSize, flex: 1 }]} numberOfLines={1}>Tratador</Text>
                {!isDesktop && <DrawerToggleButton tintColor="#000000" />}
              </View>
              {loadingData ? (
                <ActivityIndicator size="large" color="#3366FF" style={{ marginTop: 48 }} />
              ) : (
                <>
                  <Text style={styles.stepLabel}>Selecione o Vagao</Text>
                  <View style={styles.selectWrapper}>
                    <Select
                      placeholder="Selecione o vagao"
                      value={selectedVagaoId}
                      options={vagaoOptions}
                      onSelect={setSelectedVagaoId}
                    />
                  </View>
                  {selectedVagaoId ? (
                    <TouchableOpacity style={styles.bigButton} activeOpacity={0.8} onPress={handleVagaoConfirm}>
                      <Text style={styles.bigButtonText}>Continuar</Text>
                      <Feather name="arrow-right" size={24} color="#FFF" />
                    </TouchableOpacity>
                  ) : null}
                </>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </DrawerSceneWrapper>
    );
  }

  // SELECT_ROTEIRO
  if (step === "SELECT_ROTEIRO") {
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
                <Text style={[styles.title, { fontSize: titleFontSize, flex: 1 }]} numberOfLines={1}>Tratador</Text>
                {!isDesktop && <DrawerToggleButton tintColor="#000000" />}
              </View>
              <Text style={styles.subtitle}>
                Vagao: {vagoes.find((v) => v.id === selectedVagaoId)?.descricao ?? ""}
              </Text>
              <Text style={styles.stepLabel}>Selecione o Roteiro</Text>
              <View style={styles.selectWrapper}>
                <Select
                  placeholder="Selecione o roteiro"
                  value={selectedRoteiroId}
                  options={roteiroOptions}
                  onSelect={setSelectedRoteiroId}
                />
              </View>
              {selectedRoteiroId ? (
                <TouchableOpacity style={styles.bigButton} activeOpacity={0.8} onPress={handleRoteiroConfirm}>
                  <Text style={styles.bigButtonText}>Iniciar</Text>
                  <Feather name="play" size={24} color="#FFF" />
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={styles.backLink} activeOpacity={0.7} onPress={handleBackToVagao}>
                <Feather name="arrow-left" size={20} color="#666" />
                <Text style={styles.backLinkText}>Voltar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </DrawerSceneWrapper>
    );
  }

  // LOADING
  if (step === "LOADING") {
    return (
      <DrawerSceneWrapper>
        <View style={styles.fullScreenCenter}>
          <ActivityIndicator size="large" color="#3366FF" />
          <Text style={styles.loadingText}>Carregando dados...</Text>
        </View>
      </DrawerSceneWrapper>
    );
  }

  // CARREGAMENTO
  if (step === "CARREGAMENTO") {
    const totalItems = cargaItems.length + 1; // +1 for water
    const info = getCurrentCargaInfo();
    const isLast = currentItemIndex === totalItems - 1;
    const isFirst = currentItemIndex === 0;

    return (
      <DrawerSceneWrapper>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.select({ ios: "padding", android: "height" })}
        >
          <View style={styles.playerContainer}>
            {/* Header */}
            <View style={styles.playerHeader}>
              <View style={styles.headerTopRow}>
                <TouchableOpacity style={styles.exitButton} onPress={handleExit} activeOpacity={0.7}>
                  <Feather name="x" size={24} color="rgba(255,255,255,0.8)" />
                </TouchableOpacity>
              </View>
              <Text style={styles.playerTitle}>Carregamento</Text>
              <Text style={styles.playerSubtitle}>
                Trato {currentTratoNumero}/{rc?.numTratos ?? 1} - Roteiro{" "}
                {rc?.roteiro.numero ?? ""}
              </Text>
            </View>

            {/* Content */}
            <View style={[styles.playerContent, isSmallPhone && { paddingHorizontal: 16 }]}>
              {renderDots(currentItemIndex, totalItems)}

              <Text style={styles.playerItemCount}>
                {currentItemIndex + 1} de {totalItems}
              </Text>

              <Text style={styles.playerItemName}>{info.label.toUpperCase()}</Text>

              <Text style={styles.playerPrevisto}>
                Previsto: {Math.round(info.previsto)} kg
              </Text>

              <View style={styles.inputContainer}>
                <TextInput
                  ref={inputRef}
                  style={[styles.playerInput, isSmallPhone && { width: 180 }]}
                  value={String(info.realizado)}
                  onChangeText={updateCargaRealizado}
                  keyboardType="numeric"
                  selectTextOnFocus
                />
                <Text style={styles.inputUnit}>kg</Text>
              </View>
            </View>

            {/* Controls */}
            <View style={styles.playerControls}>
              <TouchableOpacity
                style={[styles.navButton, isFirst && styles.navButtonDisabled]}
                activeOpacity={0.8}
                onPress={handlePrev}
                disabled={isFirst}
              >
                <Feather name="skip-back" size={28} color={isFirst ? "#CCC" : "#1a1a1a"} />
              </TouchableOpacity>

              {isLast ? (
                <TouchableOpacity
                  style={[styles.centerButton, styles.saveButton]}
                  activeOpacity={0.8}
                  onPress={handleSaveCarga}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <>
                      <Feather name="check" size={24} color="#FFF" />
                      <Text style={styles.centerButtonText}>Salvar Carga</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.centerButton}
                  activeOpacity={0.8}
                  onPress={handleNext}
                >
                  <Text style={styles.centerButtonText}>Proximo</Text>
                  <Feather name="arrow-right" size={24} color="#FFF" />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.navButton, isLast && styles.navButtonDisabled]}
                activeOpacity={0.8}
                onPress={handleNext}
                disabled={isLast}
              >
                <Feather name="skip-forward" size={28} color={isLast ? "#CCC" : "#1a1a1a"} />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </DrawerSceneWrapper>
    );
  }

  // DESCARREGAMENTO
  if (step === "DESCARREGAMENTO") {
    const totalItems = descargaItems.length;
    const info = getCurrentDescargaInfo();
    const isLast = currentItemIndex === totalItems - 1;
    const isFirst = currentItemIndex === 0;

    return (
      <DrawerSceneWrapper>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.select({ ios: "padding", android: "height" })}
        >
          <View style={styles.playerContainer}>
            {/* Header */}
            <View style={[styles.playerHeader, styles.playerHeaderDescarga]}>
              <View style={styles.headerTopRow}>
                <TouchableOpacity style={styles.exitButton} onPress={handleExit} activeOpacity={0.7}>
                  <Feather name="x" size={24} color="rgba(255,255,255,0.8)" />
                </TouchableOpacity>
              </View>
              <Text style={styles.playerTitle}>Descarregamento</Text>
              <Text style={styles.playerSubtitle}>
                Trato {currentTratoNumero}/{rc?.numTratos ?? 1} - Roteiro{" "}
                {rc?.roteiro.numero ?? ""}
              </Text>
            </View>

            {/* Content */}
            <View style={[styles.playerContent, isSmallPhone && { paddingHorizontal: 16 }]}>
              {renderDots(currentItemIndex, totalItems)}

              <Text style={styles.playerItemCount}>
                {currentItemIndex + 1} de {totalItems}
              </Text>

              <Text style={styles.playerItemName}>{info.label.toUpperCase()}</Text>

              <Text style={styles.playerPrevisto}>
                Previsto: {Math.round(info.previsto)} kg
              </Text>

              <View style={styles.inputContainer}>
                <TextInput
                  ref={inputRef}
                  style={[styles.playerInput, isSmallPhone && { width: 180 }]}
                  value={String(info.realizado)}
                  onChangeText={updateDescargaRealizado}
                  keyboardType="numeric"
                  selectTextOnFocus
                />
                <Text style={styles.inputUnit}>kg</Text>
              </View>
            </View>

            {/* Controls */}
            <View style={styles.playerControls}>
              <TouchableOpacity
                style={[styles.navButton, isFirst && styles.navButtonDisabled]}
                activeOpacity={0.8}
                onPress={handlePrev}
                disabled={isFirst}
              >
                <Feather name="skip-back" size={28} color={isFirst ? "#CCC" : "#1a1a1a"} />
              </TouchableOpacity>

              {isLast ? (
                <TouchableOpacity
                  style={[styles.centerButton, styles.saveButtonDescarga]}
                  activeOpacity={0.8}
                  onPress={handleSaveDescarga}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <>
                      <Feather name="check" size={24} color="#FFF" />
                      <Text style={styles.centerButtonText}>Salvar Descarga</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.centerButton, styles.centerButtonDescarga]}
                  activeOpacity={0.8}
                  onPress={handleNext}
                >
                  <Text style={styles.centerButtonText}>Proximo</Text>
                  <Feather name="arrow-right" size={24} color="#FFF" />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.navButton, isLast && styles.navButtonDisabled]}
                activeOpacity={0.8}
                onPress={handleNext}
                disabled={isLast}
              >
                <Feather name="skip-forward" size={28} color={isLast ? "#CCC" : "#1a1a1a"} />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </DrawerSceneWrapper>
    );
  }

  // CONCLUIDO
  if (step === "CONCLUIDO") {
    const hasMoreTratos = rc ? currentTratoNumero < rc.numTratos : false;
    const allDone = rc ? currentTratoNumero >= rc.numTratos : true;

    return (
      <DrawerSceneWrapper>
        <View style={styles.fullScreenCenter}>
          <View style={styles.checkCircle}>
            <Feather name="check" size={64} color="#FFF" />
          </View>
          <Text style={styles.concluidoTitle}>
            Trato {currentTratoNumero} Concluido!
          </Text>
          <Text style={styles.concluidoSubtitle}>
            Roteiro {rc?.roteiro.numero ?? ""} - {rc?.dieta.nome ?? ""}
          </Text>
          <Text style={styles.concluidoInfo}>
            {allDone
              ? "Todos os tratos deste roteiro foram realizados."
              : `Faltam ${rc!.numTratos - currentTratoNumero} trato(s). Voce pode continuar agora ou sair e voltar depois.`}
          </Text>

          {hasMoreTratos && (
            <TouchableOpacity
              style={[styles.bigButton, { marginTop: 24 }]}
              activeOpacity={0.8}
              onPress={handleNextTrato}
            >
              <Feather name="skip-forward" size={24} color="#FFF" />
              <Text style={styles.bigButtonText}>Proximo Trato</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.bigButton, styles.finishButton, { marginTop: hasMoreTratos ? 12 : 24 }]}
            activeOpacity={0.8}
            onPress={handleFinish}
          >
            <Feather name="check-circle" size={24} color="#FFF" />
            <Text style={styles.bigButtonText}>{allDone ? "Finalizar" : "Sair"}</Text>
          </TouchableOpacity>
        </View>
      </DrawerSceneWrapper>
    );
  }

  return null;
}

// ---- Styles ----

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FDFDFD",
    padding: 32,
  },
  fullScreenCenter: {
    flex: 1,
    backgroundColor: "#FDFDFD",
    justifyContent: "center",
    alignItems: "center",
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
  stepLabel: {
    fontSize: 22,
    fontWeight: "600",
    color: "#444",
    marginTop: 24,
    marginBottom: 16,
  },
  selectWrapper: {
    width: "100%",
    maxWidth: 400,
  },
  bigButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3366FF",
    height: 56,
    borderRadius: 16,
    paddingHorizontal: 32,
    gap: 12,
    marginTop: 24,
    width: "100%",
    maxWidth: 400,
  },
  bigButtonText: {
    color: "#FFF",
    fontSize: 20,
    fontWeight: "700",
  },
  finishButton: {
    backgroundColor: "#666",
  },
  backLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 24,
  },
  backLinkText: {
    fontSize: 16,
    color: "#666",
  },
  loadingText: {
    fontSize: 18,
    color: "#666",
    marginTop: 16,
  },

  // Player
  playerContainer: {
    flex: 1,
    backgroundColor: "#FDFDFD",
  },
  playerHeader: {
    backgroundColor: "#3366FF",
    paddingTop: 48,
    paddingBottom: 20,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  headerTopRow: {
    alignSelf: "stretch",
    flexDirection: "row",
    justifyContent: "flex-start",
    marginBottom: 8,
  },
  exitButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  playerHeaderDescarga: {
    backgroundColor: "#FF9800",
  },
  playerTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#FFF",
  },
  playerSubtitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },
  playerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  playerItemCount: {
    fontSize: 14,
    color: "#999",
    marginTop: 16,
    marginBottom: 8,
  },
  playerItemName: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1a1a1a",
    textAlign: "center",
    marginBottom: 12,
  },
  playerPrevisto: {
    fontSize: 18,
    color: "#3366FF",
    fontWeight: "600",
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  playerInput: {
    fontSize: 44,
    fontWeight: "700",
    color: "#1a1a1a",
    textAlign: "center",
    borderWidth: 2,
    borderColor: "#E0E0E0",
    borderRadius: 16,
    height: 80,
    width: 220,
    backgroundColor: "#F8F8F8",
  },
  inputUnit: {
    fontSize: 24,
    color: "#888",
    fontWeight: "600",
  },

  // Dots
  dotsRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  dotCompleted: {
    backgroundColor: "#4CAF50",
  },
  dotActive: {
    backgroundColor: "#3366FF",
  },
  dotPending: {
    backgroundColor: "#E0E0E0",
  },

  // Controls
  playerControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingBottom: 40,
    paddingTop: 16,
    gap: 12,
  },
  navButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F0F0F0",
    alignItems: "center",
    justifyContent: "center",
  },
  navButtonDisabled: {
    opacity: 0.4,
  },
  centerButton: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#3366FF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    maxWidth: 280,
  },
  centerButtonDescarga: {
    backgroundColor: "#FF9800",
  },
  centerButtonText: {
    color: "#FFF",
    fontSize: 20,
    fontWeight: "700",
  },
  saveButton: {
    backgroundColor: "#4CAF50",
  },
  saveButtonDescarga: {
    backgroundColor: "#4CAF50",
  },

  // Concluido
  checkCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#4CAF50",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  concluidoTitle: {
    fontSize: 32,
    fontWeight: "900",
    color: "#1a1a1a",
  },
  concluidoSubtitle: {
    fontSize: 18,
    color: "#888",
    marginTop: 8,
  },
  concluidoInfo: {
    fontSize: 15,
    color: "#666",
    marginTop: 16,
    textAlign: "center",
    paddingHorizontal: 24,
  },
});
