import { DatePickerInput } from "@/components/DatePickerInput";
import { Input } from "@/components/Input";
import { ConferenciaMS, Insumo, PesagemMS } from "@/components/InsumoCard";
import { avisar, confirmar } from "@/services/alerta";
import {
  calcPercentualMS,
  calcPesoLiquido,
  calcResultadoSecagem,
  formatarGramas,
  formatarMS,
  isConferenciaFinalizada,
  proximoTempoPesagem,
} from "@/utils/materiaSecaCalc";
import { Feather } from "@expo/vector-icons";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export type ConferenciaMSDados = Omit<ConferenciaMS, "id">;

type ConferenciaMSModalProps = {
  visible: boolean;
  insumo: Insumo | null;
  onAddConferencia: (insumoId: string, conferencia: ConferenciaMSDados) => void | Promise<void>;
  onUpdateConferencia: (
    insumoId: string,
    conferenciaId: string,
    conferencia: ConferenciaMSDados
  ) => void | Promise<void>;
  onDeleteConferencia: (insumoId: string, conferenciaId: string) => void;
  onClose: () => void;
};

type Modo = "lista" | "secagem" | "direto";

type PesagemForm = { tempoMin: string; pesoBruto: string };

type SecagemForm = {
  data: Date;
  tara: string;
  pesoInicialBruto: string;
  pesagens: PesagemForm[];
  observacao: string;
};

type DiretoForm = { data: Date; percentualMS: string };

function dateToISO(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isoToDate(iso: string): Date {
  const d = new Date(iso + "T00:00:00");
  return isNaN(d.getTime()) ? new Date() : d;
}

function formatarData(iso: string): string {
  const partes = iso.split("-");
  return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : iso;
}

/** Converte "1.306" / "1306,5" / "1306" em número; null quando inválido. */
function parseNum(valor: string): number | null {
  const limpo = valor.trim().replace(/\./g, "").replace(",", ".");
  if (!limpo) return null;
  const n = parseFloat(limpo);
  return isNaN(n) ? null : n;
}

function numToStr(n: number | undefined): string {
  return n === undefined || n === null ? "" : String(n).replace(".", ",");
}

function getEmptySecagem(): SecagemForm {
  return { data: new Date(), tara: "", pesoInicialBruto: "", pesagens: [], observacao: "" };
}

function getEmptyDireto(): DiretoForm {
  return { data: new Date(), percentualMS: "" };
}

function secagemFromConferencia(c: ConferenciaMS): SecagemForm {
  return {
    data: isoToDate(c.data),
    tara: numToStr(c.tara),
    pesoInicialBruto: numToStr(c.pesoInicialBruto),
    pesagens: (c.pesagens ?? []).map((p) => ({
      tempoMin: String(p.tempoMin),
      pesoBruto: numToStr(p.pesoBruto),
    })),
    observacao: c.observacao ?? "",
  };
}

/** Pesagens com peso preenchido e válido; linhas vazias são ignoradas. */
function pesagensValidas(form: SecagemForm): PesagemMS[] {
  const resultado: PesagemMS[] = [];
  form.pesagens.forEach((p, idx) => {
    const peso = parseNum(p.pesoBruto);
    if (peso === null) return;
    const tempo = parseNum(p.tempoMin) ?? (idx === 0 ? 60 : 10);
    resultado.push({ tempoMin: tempo, pesoBruto: peso });
  });
  return resultado;
}

export function ConferenciaMSModal({
  visible,
  insumo,
  onAddConferencia,
  onUpdateConferencia,
  onDeleteConferencia,
  onClose,
}: ConferenciaMSModalProps) {
  const [modo, setModo] = useState<Modo>("lista");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [secagem, setSecagem] = useState<SecagemForm>(getEmptySecagem);
  const [direto, setDireto] = useState<DiretoForm>(getEmptyDireto);
  const [expandidoId, setExpandidoId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  if (!insumo) return null;

  // Captura o id num const: o estreitamento de `insumo` não sobrevive
  // dentro dos handlers (o TS não garante que a prop siga não-nula).
  const insumoId = insumo.id;
  const conferenciasOrdenadas = [...insumo.conferencias].sort((a, b) =>
    b.data.localeCompare(a.data)
  );
  const emAndamento = conferenciasOrdenadas.filter((c) => !isConferenciaFinalizada(c));
  const finalizadas = conferenciasOrdenadas.filter(isConferenciaFinalizada);

  // ---- Navegação interna ----

  function voltarParaLista() {
    setModo("lista");
    setEditandoId(null);
    setSecagem(getEmptySecagem());
    setDireto(getEmptyDireto());
  }

  function iniciarSecagem() {
    setEditandoId(null);
    setSecagem(getEmptySecagem());
    setModo("secagem");
  }

  function continuarSecagem(c: ConferenciaMS) {
    setEditandoId(c.id);
    setSecagem(secagemFromConferencia(c));
    setModo("secagem");
  }

  function iniciarDireto() {
    setDireto(getEmptyDireto());
    setModo("direto");
  }

  function fechar() {
    voltarParaLista();
    setExpandidoId(null);
    onClose();
  }

  // ---- Secagem ----

  const tara = parseNum(secagem.tara);
  const pesoInicialBruto = parseNum(secagem.pesoInicialBruto);
  const basesValidas = tara !== null && pesoInicialBruto !== null && tara >= 0;
  const pesoInicialLiquido = basesValidas ? calcPesoLiquido(pesoInicialBruto, tara) : null;
  const resultado = basesValidas
    ? calcResultadoSecagem(tara, pesoInicialBruto, pesagensValidas(secagem))
    : null;

  function adicionarPesagem() {
    setSecagem((p) => ({
      ...p,
      pesagens: [
        ...p.pesagens,
        { tempoMin: String(proximoTempoPesagem(pesagensValidas(p))), pesoBruto: "" },
      ],
    }));
  }

  function alterarPesagem(idx: number, campo: keyof PesagemForm, valor: string) {
    setSecagem((p) => ({
      ...p,
      pesagens: p.pesagens.map((row, i) => (i === idx ? { ...row, [campo]: valor } : row)),
    }));
  }

  function removerPesagem(idx: number) {
    setSecagem((p) => ({ ...p, pesagens: p.pesagens.filter((_, i) => i !== idx) }));
  }

  function validarBases(): boolean {
    if (tara === null || pesoInicialBruto === null) {
      avisar("Atenção", "Informe a tara e o peso inicial bruto.");
      return false;
    }
    if (tara < 0) {
      avisar("Atenção", "A tara não pode ser negativa.");
      return false;
    }
    if (pesoInicialBruto <= tara) {
      avisar("Atenção", "O peso inicial bruto deve ser maior que a tara.");
      return false;
    }
    return true;
  }

  function montarDadosSecagem(finalizada: boolean): ConferenciaMSDados | null {
    if (!validarBases() || tara === null || pesoInicialBruto === null) return null;
    const pesagens = pesagensValidas(secagem);
    const res = calcResultadoSecagem(tara, pesoInicialBruto, pesagens);
    const dados: ConferenciaMSDados = {
      data: dateToISO(secagem.data),
      percentualMS: res.percentualMSFinal ?? 0,
      tara,
      pesoInicialBruto,
      pesagens,
      finalizada,
    };
    const obs = secagem.observacao.trim();
    if (obs) dados.observacao = obs;
    return dados;
  }

  async function persistir(dados: ConferenciaMSDados) {
    setSalvando(true);
    try {
      if (editandoId) await onUpdateConferencia(insumoId, editandoId, dados);
      else await onAddConferencia(insumoId, dados);
      voltarParaLista();
    } finally {
      setSalvando(false);
    }
  }

  function salvarEmAndamento() {
    const dados = montarDadosSecagem(false);
    if (!dados) return;
    void persistir(dados);
  }

  function finalizarSecagem() {
    const dados = montarDadosSecagem(true);
    if (!dados || !resultado) return;
    if (dados.pesagens!.length === 0) {
      avisar("Atenção", "Registre ao menos uma pesagem antes de finalizar.");
      return;
    }
    const pms = resultado.percentualMSFinal;
    if (pms === null || pms < 0 || pms > 100) {
      avisar(
        "Atenção",
        "A %MS final ficou fora de 0 a 100. Confira a tara, o peso inicial e a última pesagem."
      );
      return;
    }
    if (!resultado.estabilizou) {
      confirmar(
        "Peso ainda não estabilizou",
        "A regra é repetir a pesagem até duas leituras iguais. Deseja finalizar mesmo assim com " +
          `${formatarMS(pms)}?`,
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Finalizar", onPress: () => void persistir(dados) },
        ]
      );
      return;
    }
    void persistir(dados);
  }

  // ---- Direto ----

  function salvarDireto() {
    const pms = parseNum(direto.percentualMS);
    if (pms === null) {
      avisar("Atenção", "Informe o percentual de MS.");
      return;
    }
    if (pms < 0 || pms > 100) {
      avisar("Atenção", "Percentual de MS deve ser um número entre 0 e 100.");
      return;
    }
    void persistir({ data: dateToISO(direto.data), percentualMS: pms, finalizada: true });
  }

  function confirmarExclusao(c: ConferenciaMS) {
    confirmar(
      "Excluir conferência",
      `Excluir a conferência de ${formatarData(c.data)} (${formatarMS(c.percentualMS)})?`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Excluir", style: "destructive", onPress: () => onDeleteConferencia(insumoId, c.id) },
      ]
    );
  }

  // ---- Render ----

  function renderItemConferencia(c: ConferenciaMS) {
    const finalizada = isConferenciaFinalizada(c);
    const temSecagem = c.tara !== undefined && c.pesoInicialBruto !== undefined;
    const expandido = expandidoId === c.id;
    const res =
      temSecagem && c.tara !== undefined && c.pesoInicialBruto !== undefined
        ? calcResultadoSecagem(c.tara, c.pesoInicialBruto, c.pesagens ?? [])
        : null;

    return (
      <View key={c.id} style={[styles.confItem, !finalizada && styles.confItemAndamento]}>
        <TouchableOpacity
          style={styles.confItemContent}
          activeOpacity={temSecagem ? 0.7 : 1}
          onPress={() => temSecagem && setExpandidoId(expandido ? null : c.id)}
        >
          <View style={styles.confItemTopRow}>
            <Text style={styles.confItemDate}>{formatarData(c.data)}</Text>
            {!finalizada ? (
              <View style={styles.badgeAndamento}>
                <Text style={styles.badgeAndamentoText}>Em andamento</Text>
              </View>
            ) : (
              <Text style={styles.confItemMS}>{formatarMS(c.percentualMS)}</Text>
            )}
          </View>
          {temSecagem ? (
            <Text style={styles.confItemDetails}>
              Tara {formatarGramas(c.tara ?? null)} · Inicial{" "}
              {formatarGramas(c.pesoInicialBruto ?? null)} · {c.pesagens?.length ?? 0}{" "}
              {(c.pesagens?.length ?? 0) === 1 ? "pesagem" : "pesagens"}
              {!finalizada && res?.percentualMSFinal !== null && res
                ? ` · parcial ${formatarMS(res.percentualMSFinal)}`
                : ""}
            </Text>
          ) : (
            <Text style={styles.confItemDetails}>Informada diretamente</Text>
          )}
          {c.observacao ? <Text style={styles.confItemObs}>{c.observacao}</Text> : null}

          {expandido && res && (
            <View style={styles.tabela}>
              <View style={styles.tabelaHeader}>
                <Text style={[styles.tabelaCel, styles.tabelaCelTempo, styles.tabelaHeaderText]}>Tempo</Text>
                <Text style={[styles.tabelaCel, styles.tabelaHeaderText]}>Peso</Text>
                <Text style={[styles.tabelaCel, styles.tabelaHeaderText]}>%MS</Text>
              </View>
              {res.etapas.map((e) => (
                <View key={e.indice} style={styles.tabelaLinha}>
                  <Text style={[styles.tabelaCel, styles.tabelaCelTempo]}>{e.tempoMin} min</Text>
                  <Text style={styles.tabelaCel}>{formatarGramas(e.pesoBruto)}</Text>
                  <Text style={styles.tabelaCel}>{formatarMS(e.percentualMS)}</Text>
                </View>
              ))}
              <Text style={styles.tabelaRodape}>
                Líquido inicial {formatarGramas(res.pesoInicialLiquido)}
                {res.estabilizou ? " · peso estabilizou" : ""}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.confItemActions}>
          {!finalizada && (
            <TouchableOpacity
              style={[styles.confActionBtn, styles.confContinuarBtn]}
              activeOpacity={0.7}
              onPress={() => continuarSecagem(c)}
            >
              <Feather name="play" size={16} color="#FFF" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.confActionBtn}
            activeOpacity={0.7}
            onPress={() => confirmarExclusao(c)}
          >
            <Feather name="trash-2" size={16} color="#E53935" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  function renderLista() {
    return (
      <>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>MS Atual</Text>
            <Text style={styles.statValue}>{formatarMS(insumo!.percentualMateriaSeca)}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Conferências</Text>
            <Text style={styles.statValue}>{finalizadas.length}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Última</Text>
            <Text style={styles.statValue}>
              {finalizadas[0] ? formatarData(finalizadas[0].data) : "-"}
            </Text>
          </View>
        </View>

        <View style={styles.acoesRow}>
          <TouchableOpacity style={styles.addButton} activeOpacity={0.8} onPress={iniciarSecagem}>
            <Feather name="thermometer" size={18} color="#FFF" />
            <Text style={styles.addButtonLabel}>Nova Secagem</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.8} onPress={iniciarDireto}>
            <Feather name="edit-3" size={18} color="#E65100" />
            <Text style={styles.secondaryButtonLabel}>Informar %MS</Text>
          </TouchableOpacity>
        </View>

        {emAndamento.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Em andamento</Text>
            <View style={styles.confList}>{emAndamento.map(renderItemConferencia)}</View>
          </>
        )}

        <Text style={styles.sectionTitle}>Histórico</Text>
        {finalizadas.length === 0 ? (
          <Text style={styles.emptyText}>Nenhuma conferência registrada.</Text>
        ) : (
          <View style={styles.confList}>{finalizadas.map(renderItemConferencia)}</View>
        )}
      </>
    );
  }

  function renderSecagem() {
    return (
      <View style={styles.form}>
        <Text style={styles.label}>Data</Text>
        <DatePickerInput
          value={secagem.data}
          onChange={(date) => setSecagem((p) => ({ ...p, data: date || new Date() }))}
        />

        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>Tara (g)</Text>
            <Input
              placeholder="Ex: 1306"
              value={secagem.tara}
              onChangeText={(v) => setSecagem((p) => ({ ...p, tara: v }))}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Peso Inicial Bruto (g)</Text>
            <Input
              placeholder="Ex: 1605"
              value={secagem.pesoInicialBruto}
              onChangeText={(v) => setSecagem((p) => ({ ...p, pesoInicialBruto: v }))}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>Peso Inicial Líquido</Text>
          <Text
            style={[
              styles.infoValue,
              pesoInicialLiquido !== null && pesoInicialLiquido <= 0 && styles.infoValueErro,
            ]}
          >
            {formatarGramas(pesoInicialLiquido)}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Pesagens</Text>
        <Text style={styles.hint}>
          Primeira pesagem após 60 min; depois a cada 10 min, até duas leituras iguais.
        </Text>

        <View style={styles.tabelaHeader}>
          <Text style={[styles.tabelaCel, styles.tabelaCelTempo, styles.tabelaHeaderText]}>Tempo (min)</Text>
          <Text style={[styles.tabelaCel, styles.tabelaHeaderText]}>Peso (g)</Text>
          <Text style={[styles.tabelaCel, styles.tabelaCelMS, styles.tabelaHeaderText]}>%MS</Text>
          <View style={styles.tabelaCelAcao} />
        </View>

        {secagem.pesagens.map((p, idx) => {
          const peso = parseNum(p.pesoBruto);
          const pms =
            basesValidas && peso !== null
              ? calcPercentualMS(tara, pesoInicialBruto, peso)
              : null;
          return (
            <View key={idx} style={styles.pesagemRow}>
              <Input
                style={[styles.pesagemInput, styles.tabelaCelTempo]}
                value={p.tempoMin}
                onChangeText={(v) => alterarPesagem(idx, "tempoMin", v)}
                keyboardType="number-pad"
              />
              <Input
                style={styles.pesagemInput}
                placeholder="Ex: 1510"
                value={p.pesoBruto}
                onChangeText={(v) => alterarPesagem(idx, "pesoBruto", v)}
                keyboardType="decimal-pad"
              />
              <Text style={[styles.tabelaCel, styles.tabelaCelMS, styles.pesagemMS]}>
                {formatarMS(pms)}
              </Text>
              <TouchableOpacity
                style={styles.tabelaCelAcao}
                activeOpacity={0.7}
                onPress={() => removerPesagem(idx)}
              >
                <Feather name="x" size={18} color="#999" />
              </TouchableOpacity>
            </View>
          );
        })}

        <TouchableOpacity style={styles.addPesagemBtn} activeOpacity={0.7} onPress={adicionarPesagem}>
          <Feather name="plus" size={18} color="#E65100" />
          <Text style={styles.addPesagemLabel}>
            Adicionar pesagem ({proximoTempoPesagem(pesagensValidas(secagem))} min)
          </Text>
        </TouchableOpacity>

        <View style={[styles.finalBox, resultado?.estabilizou && styles.finalBoxOk]}>
          <View style={styles.finalCol}>
            <Text style={styles.finalLabel}>FINAL</Text>
            <Text style={styles.finalValue}>{formatarGramas(resultado?.pesoFinalBruto ?? null)}</Text>
          </View>
          <View style={styles.finalCol}>
            <Text style={styles.finalLabel}>%MS</Text>
            <Text style={styles.finalValue}>{formatarMS(resultado?.percentualMSFinal ?? null)}</Text>
          </View>
          <View style={[styles.finalCol, { flex: 1.4 }]}>
            <Text style={styles.finalLabel}>Status</Text>
            <Text style={styles.finalStatus}>
              {!resultado || resultado.etapas.length === 0
                ? "Aguardando pesagens"
                : resultado.estabilizou
                  ? "Peso estabilizou"
                  : "Ainda secando"}
            </Text>
          </View>
        </View>

        <Text style={styles.label}>Observação (opcional)</Text>
        <Input
          placeholder="Ex: amostra do silo 2"
          value={secagem.observacao}
          onChangeText={(v) => setSecagem((p) => ({ ...p, observacao: v }))}
        />

        <View style={styles.buttonWrapper}>
          <TouchableOpacity
            style={[styles.addButton, salvando && styles.disabled]}
            activeOpacity={0.8}
            disabled={salvando}
            onPress={finalizarSecagem}
          >
            <Feather name="check" size={18} color="#FFF" />
            <Text style={styles.addButtonLabel}>Finalizar Conferência</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryButton, salvando && styles.disabled]}
            activeOpacity={0.8}
            disabled={salvando}
            onPress={salvarEmAndamento}
          >
            <Feather name="save" size={18} color="#E65100" />
            <Text style={styles.secondaryButtonLabel}>Salvar e continuar depois</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkButton} activeOpacity={0.7} onPress={voltarParaLista}>
            <Text style={styles.linkButtonLabel}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  function renderDireto() {
    return (
      <View style={styles.form}>
        <Text style={styles.label}>Data</Text>
        <DatePickerInput
          value={direto.data}
          onChange={(date) => setDireto((p) => ({ ...p, data: date || new Date() }))}
        />

        <Text style={styles.label}>Percentual de MS (%)</Text>
        <Input
          placeholder="Ex: 33,5"
          value={direto.percentualMS}
          onChangeText={(v) => setDireto((p) => ({ ...p, percentualMS: v }))}
          keyboardType="decimal-pad"
        />

        <View style={styles.buttonWrapper}>
          <TouchableOpacity
            style={[styles.addButton, salvando && styles.disabled]}
            activeOpacity={0.8}
            disabled={salvando}
            onPress={salvarDireto}
          >
            <Feather name="plus" size={18} color="#FFF" />
            <Text style={styles.addButtonLabel}>Adicionar Conferência</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkButton} activeOpacity={0.7} onPress={voltarParaLista}>
            <Text style={styles.linkButtonLabel}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const titulo =
    modo === "lista"
      ? `Conferências MS - ${insumo.nome}`
      : modo === "secagem"
        ? editandoId
          ? `Continuar secagem - ${insumo.nome}`
          : `Nova secagem - ${insumo.nome}`
        : `Informar %MS - ${insumo.nome}`;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={fechar}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.select({ ios: "padding", android: undefined })}
        >
          <View style={styles.card}>
            <View style={styles.header}>
              {modo !== "lista" && (
                <TouchableOpacity onPress={voltarParaLista} activeOpacity={0.7} style={styles.backBtn}>
                  <Feather name="arrow-left" size={22} color="#666" />
                </TouchableOpacity>
              )}
              <Text style={styles.title} numberOfLines={2}>
                {titulo}
              </Text>
              <TouchableOpacity onPress={fechar} activeOpacity={0.7}>
                <Feather name="x" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {modo === "lista" && renderLista()}
              {modo === "secagem" && renderSecagem()}
              {modo === "direto" && renderDireto()}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  keyboardView: {
    maxHeight: "92%",
    width: "100%",
    maxWidth: 560,
  },
  card: {
    backgroundColor: "#FDFDFD",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 24,
    maxHeight: "100%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    gap: 8,
  },
  backBtn: {
    marginRight: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a1a",
    flex: 1,
  },
  scrollContent: {
    flexGrow: 0,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    padding: 12,
  },
  stat: {
    alignItems: "center",
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: "#999",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  acoesRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1a1a1a",
    marginTop: 12,
    marginBottom: 6,
  },
  hint: {
    fontSize: 12,
    color: "#888",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    paddingVertical: 12,
  },
  confList: {
    gap: 8,
    marginBottom: 8,
  },
  confItem: {
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  confItemAndamento: {
    backgroundColor: "#E3F2FD",
  },
  confItemContent: {
    flex: 1,
  },
  confItemTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  confItemDate: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  confItemMS: {
    fontSize: 14,
    fontWeight: "700",
    color: "#E65100",
  },
  confItemDetails: {
    fontSize: 13,
    color: "#888",
    marginTop: 2,
  },
  confItemObs: {
    fontSize: 12,
    color: "#666",
    fontStyle: "italic",
    marginTop: 2,
  },
  confItemActions: {
    flexDirection: "column",
    gap: 6,
    marginLeft: 8,
  },
  confActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
  },
  confContinuarBtn: {
    backgroundColor: "#1565C0",
  },
  badgeAndamento: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: "#BBDEFB",
  },
  badgeAndamentoText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1565C0",
  },
  tabela: {
    marginTop: 8,
    backgroundColor: "#FFF",
    borderRadius: 6,
    padding: 8,
  },
  tabelaHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
    marginBottom: 4,
  },
  tabelaHeaderText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#666",
  },
  tabelaLinha: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 3,
  },
  tabelaCel: {
    flex: 1,
    fontSize: 13,
    color: "#1a1a1a",
  },
  tabelaCelTempo: {
    flex: 0.8,
  },
  tabelaCelMS: {
    flex: 0.8,
    textAlign: "right",
  },
  tabelaCelAcao: {
    width: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  tabelaRodape: {
    fontSize: 12,
    color: "#888",
    marginTop: 6,
  },
  form: {
    gap: 6,
    paddingBottom: 8,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  col: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#444",
    marginTop: 6,
  },
  infoBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
  },
  infoLabel: {
    fontSize: 13,
    color: "#666",
    fontWeight: "600",
  },
  infoValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  infoValueErro: {
    color: "#E53935",
  },
  pesagemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  pesagemInput: {
    flex: 1,
    width: "auto",
    height: 44,
  },
  pesagemMS: {
    fontWeight: "700",
    fontSize: 15,
  },
  addPesagemBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#E65100",
    borderRadius: 8,
    height: 44,
    marginTop: 4,
  },
  addPesagemLabel: {
    color: "#E65100",
    fontSize: 14,
    fontWeight: "600",
  },
  finalBox: {
    flexDirection: "row",
    backgroundColor: "#37474F",
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    gap: 8,
  },
  finalBoxOk: {
    backgroundColor: "#2E7D32",
  },
  finalCol: {
    flex: 1,
  },
  finalLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "700",
  },
  finalValue: {
    fontSize: 18,
    color: "#FFF",
    fontWeight: "700",
  },
  finalStatus: {
    fontSize: 14,
    color: "#FFF",
    fontWeight: "600",
    marginTop: 2,
  },
  buttonWrapper: {
    marginTop: 16,
    gap: 8,
  },
  addButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E65100",
    borderRadius: 8,
    height: 48,
    gap: 8,
  },
  addButtonLabel: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "600",
  },
  secondaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF3E0",
    borderRadius: 8,
    height: 48,
    gap: 8,
  },
  secondaryButtonLabel: {
    color: "#E65100",
    fontSize: 15,
    fontWeight: "600",
  },
  linkButton: {
    alignItems: "center",
    justifyContent: "center",
    height: 40,
  },
  linkButtonLabel: {
    color: "#666",
    fontSize: 14,
    fontWeight: "600",
  },
  disabled: {
    opacity: 0.6,
  },
});
