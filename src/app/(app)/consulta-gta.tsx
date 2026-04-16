import { DrawerSceneWrapper } from "@/components/drawe-scene-wrapper";
import { DrawerToggleButton } from "@/components/DrawerToggleButton";
import { useResponsive } from "@/hooks/useResponsive";
import { consultarGTA, GTAData } from "@/services/gtaService";
import {
  consultarSintegra,
  SintegraData,
} from "@/services/sintegraService";
import { Feather } from "@expo/vector-icons";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type TabType = "gta" | "sintegra";

export default function ConsultaGTA() {
  const {
    isTablet,
    isDesktop,
    maxWidthContent,
    containerPadding,
    titleFontSize,
    headerPaddingTop,
  } = useResponsive();

  const [tab, setTab] = useState<TabType>("gta");

  // GTA state
  const [barcode, setBarcode] = useState("");
  const [loadingGta, setLoadingGta] = useState(false);
  const [gta, setGta] = useState<GTAData | null>(null);
  const [erroGta, setErroGta] = useState("");
  const inputGtaRef = useRef<TextInput>(null);

  // Sintegra state
  const [inscricaoEstadual, setInscricaoEstadual] = useState("");
  const [loadingSintegra, setLoadingSintegra] = useState(false);
  const [sintegra, setSintegra] = useState<SintegraData | null>(null);
  const [erroSintegra, setErroSintegra] = useState("");
  const inputSintegraRef = useRef<TextInput>(null);

  const handleConsultarGTA = useCallback(async () => {
    const trimmed = barcode.replace(/\s/g, "");
    if (!trimmed) {
      Alert.alert("Aviso", "Informe o codigo de barras MAPA.");
      return;
    }

    setLoadingGta(true);
    setGta(null);
    setErroGta("");

    try {
      const data = await consultarGTA(trimmed);
      setGta(data);
    } catch (error: any) {
      setErroGta(error?.message || "Erro desconhecido");
    } finally {
      setLoadingGta(false);
    }
  }, [barcode]);

  const handleConsultarSintegra = useCallback(async () => {
    const trimmed = inscricaoEstadual.replace(/\s/g, "");
    if (!trimmed) {
      Alert.alert("Aviso", "Informe a inscricao estadual.");
      return;
    }

    setLoadingSintegra(true);
    setSintegra(null);
    setErroSintegra("");

    try {
      const data = await consultarSintegra(trimmed);
      setSintegra(data);
    } catch (error: any) {
      setErroSintegra(error?.message || "Erro desconhecido");
    } finally {
      setLoadingSintegra(false);
    }
  }, [inscricaoEstadual]);

  function handleNovaPesquisaGTA() {
    setBarcode("");
    setGta(null);
    setErroGta("");
    inputGtaRef.current?.focus();
  }

  function handleNovaPesquisaSintegra() {
    setInscricaoEstadual("");
    setSintegra(null);
    setErroSintegra("");
    inputSintegraRef.current?.focus();
  }

  function switchTab(newTab: TabType) {
    setTab(newTab);
  }

  const loading = tab === "gta" ? loadingGta : loadingSintegra;

  return (
    <DrawerSceneWrapper>
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
          {/* Header */}
          <View style={[styles.header, { paddingTop: headerPaddingTop }]}>
            <Text
              style={[styles.title, { fontSize: titleFontSize, flex: 1 }]}
              numberOfLines={1}
            >
              Consultas
            </Text>
            {!isDesktop && <DrawerToggleButton tintColor="#000000" />}
          </View>

          <Text style={styles.subtitle}>
            Consulte documentos de transito animal e dados cadastrais de
            contribuintes.
          </Text>

          {/* Tabs */}
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tab, tab === "gta" && styles.tabActive]}
              activeOpacity={0.8}
              onPress={() => switchTab("gta")}
            >
              <Feather
                name="file-text"
                size={16}
                color={tab === "gta" ? "#3366FF" : "#999"}
              />
              <Text
                style={[
                  styles.tabLabel,
                  tab === "gta" && styles.tabLabelActive,
                ]}
              >
                GTA
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, tab === "sintegra" && styles.tabActive]}
              activeOpacity={0.8}
              onPress={() => switchTab("sintegra")}
            >
              <Feather
                name="search"
                size={16}
                color={tab === "sintegra" ? "#3366FF" : "#999"}
              />
              <Text
                style={[
                  styles.tabLabel,
                  tab === "sintegra" && styles.tabLabelActive,
                ]}
              >
                Sintegra
              </Text>
            </TouchableOpacity>
          </View>

          {/* GTA Tab */}
          {tab === "gta" && (
            <>
              <View style={styles.inputRow}>
                <TextInput
                  ref={inputGtaRef}
                  style={styles.input}
                  placeholder="Codigo de barras MAPA (44 digitos)"
                  placeholderTextColor="#999"
                  value={barcode}
                  onChangeText={setBarcode}
                  keyboardType="numeric"
                  maxLength={44}
                  editable={!loadingGta}
                  onSubmitEditing={handleConsultarGTA}
                />
              </View>

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.button, loadingGta && styles.buttonDisabled]}
                  activeOpacity={0.8}
                  onPress={handleConsultarGTA}
                  disabled={loadingGta}
                >
                  {loadingGta ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Feather name="search" size={20} color="#FFF" />
                  )}
                  <Text style={styles.buttonLabel}>
                    {loadingGta ? "Consultando..." : "Consultar"}
                  </Text>
                </TouchableOpacity>

                {gta && (
                  <TouchableOpacity
                    style={[styles.button, styles.buttonSecondary]}
                    activeOpacity={0.8}
                    onPress={handleNovaPesquisaGTA}
                  >
                    <Feather name="refresh-cw" size={18} color="#3366FF" />
                    <Text style={[styles.buttonLabel, { color: "#3366FF" }]}>
                      Nova Pesquisa
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {!!erroGta && (
                <View style={styles.errorBox}>
                  <Feather name="alert-circle" size={18} color="#E53935" />
                  <Text style={styles.errorText}>{erroGta}</Text>
                </View>
              )}

              {gta && <GTAResult gta={gta} />}
            </>
          )}

          {/* Sintegra Tab */}
          {tab === "sintegra" && (
            <>
              <View style={styles.inputRow}>
                <TextInput
                  ref={inputSintegraRef}
                  style={styles.input}
                  placeholder="Inscricao Estadual (ex: 28.828.982-0)"
                  placeholderTextColor="#999"
                  value={inscricaoEstadual}
                  onChangeText={setInscricaoEstadual}
                  maxLength={15}
                  editable={!loadingSintegra}
                  onSubmitEditing={handleConsultarSintegra}
                />
              </View>

              {loadingSintegra && (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="small" color="#3366FF" />
                  <Text style={styles.loadingText}>
                    Resolvendo captcha e consultando... isso pode levar ate 30
                    segundos.
                  </Text>
                </View>
              )}

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[
                    styles.button,
                    loadingSintegra && styles.buttonDisabled,
                  ]}
                  activeOpacity={0.8}
                  onPress={handleConsultarSintegra}
                  disabled={loadingSintegra}
                >
                  {loadingSintegra ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Feather name="search" size={20} color="#FFF" />
                  )}
                  <Text style={styles.buttonLabel}>
                    {loadingSintegra ? "Consultando..." : "Consultar"}
                  </Text>
                </TouchableOpacity>

                {sintegra && (
                  <TouchableOpacity
                    style={[styles.button, styles.buttonSecondary]}
                    activeOpacity={0.8}
                    onPress={handleNovaPesquisaSintegra}
                  >
                    <Feather name="refresh-cw" size={18} color="#3366FF" />
                    <Text style={[styles.buttonLabel, { color: "#3366FF" }]}>
                      Nova Pesquisa
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {!!erroSintegra && (
                <View style={styles.errorBox}>
                  <Feather name="alert-circle" size={18} color="#E53935" />
                  <Text style={styles.errorText}>{erroSintegra}</Text>
                </View>
              )}

              {sintegra && <SintegraResult data={sintegra} />}
            </>
          )}
        </View>
      </ScrollView>
    </DrawerSceneWrapper>
  );
}

// ─── GTA Result ────────────────────────────────────────────

function GTAResult({ gta }: { gta: GTAData }) {
  return (
    <View style={styles.resultContainer}>
      <SectionCard title="Dados da GTA" icon="file-text">
        <InfoRow label="Situacao" value={gta.identificacao.situacao} />
        <InfoRow label="Protocolo" value={gta.identificacao.protocolo} />
        <InfoRow label="Numero" value={gta.identificacao.numero} />
        <InfoRow label="Serie" value={gta.identificacao.serie} />
        <InfoRow label="UF" value={gta.identificacao.uf} />
        <InfoRow label="Especie" value={gta.especie.especie} />
        <InfoRow label="Grupo" value={gta.especie.grupo} />
        <InfoRow label="Finalidade" value={gta.especie.finalidade} />
        <InfoRow label="Emissao" value={gta.emissao.dataEmissao} />
        <InfoRow label="Validade" value={gta.emissao.dataValidade} />
        <InfoRow label="Emitente" value={gta.emissao.emitente} />
        <InfoRow
          label="Total de Animais"
          value={gta.totalAnimais?.toString()}
          bold
        />
      </SectionCard>

      <SectionCard title="Origem" icon="log-out">
        <InfoRow label="Codigo" value={gta.origem.codigo} />
        <InfoRow label="Produtor" value={gta.origem.nomeProdutor} />
        <InfoRow label="CPF/CNPJ" value={gta.origem.cpfCnpj} />
        <InfoRow label="Fazenda" value={gta.origem.nome} />
        <InfoRow
          label="Municipio/UF"
          value={
            gta.origem.municipio
              ? `${gta.origem.municipio}/${gta.origem.uf}`
              : undefined
          }
        />
      </SectionCard>

      <SectionCard title="Destino" icon="log-in">
        <InfoRow label="Codigo" value={gta.destino.codigo} />
        <InfoRow label="Produtor" value={gta.destino.nomeProdutor} />
        <InfoRow label="CPF/CNPJ" value={gta.destino.cpfCnpj} />
        <InfoRow label="Fazenda" value={gta.destino.nome} />
        <InfoRow
          label="Municipio/UF"
          value={
            gta.destino.municipio
              ? `${gta.destino.municipio}/${gta.destino.uf}`
              : undefined
          }
        />
      </SectionCard>

      {gta.animais && gta.animais.length > 0 && (
        <SectionCard title="Animais" icon="list">
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { flex: 2.5 }]}>
              Descricao
            </Text>
            <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Sexo</Text>
            <Text
              style={[
                styles.tableHeaderCell,
                { flex: 0.7, textAlign: "right" },
              ]}
            >
              Qtd
            </Text>
          </View>
          {gta.animais.map((animal, idx) => (
            <View
              key={idx}
              style={[
                styles.tableRow,
                idx % 2 === 0 && styles.tableRowEven,
              ]}
            >
              <Text style={[styles.tableCell, { flex: 2.5 }]}>
                {animal.faixaEtaria
                  ? `${animal.especie || "-"}, ${animal.faixaEtaria}`
                  : animal.descricao || "-"}
              </Text>
              <Text style={[styles.tableCell, { flex: 1 }]}>
                {animal.sexo || "-"}
              </Text>
              <Text
                style={[
                  styles.tableCell,
                  { flex: 0.7, textAlign: "right", fontWeight: "700" },
                ]}
              >
                {animal.qtdEnviada ?? "-"}
              </Text>
            </View>
          ))}
        </SectionCard>
      )}
    </View>
  );
}

// ─── Sintegra Result ───────────────────────────────────────

function SintegraResult({ data }: { data: SintegraData }) {
  const endereco = [data.endereco, data.numero, data.complemento]
    .filter(Boolean)
    .join(", ");
  const localidade = [data.bairro, data.municipio, data.uf]
    .filter(Boolean)
    .join(" - ");

  return (
    <View style={styles.resultContainer}>
      <SectionCard title="Dados do Contribuinte" icon="user">
        <InfoRow label="Inscricao Estadual" value={data.inscricaoEstadual} />
        <InfoRow label="Razao Social" value={data.razaoSocial} />
        <InfoRow label="Nome Fantasia" value={data.nomeFantasia} />
        <InfoRow label="CPF/CNPJ" value={data.cnpjCpf} />
        <InfoRow label="Situacao" value={data.situacao} />
        <InfoRow label="Credenciamento" value={data.dataCredenciamento} />
      </SectionCard>

      {(endereco || localidade || data.cep) && (
        <SectionCard title="Endereco" icon="map-pin">
          <InfoRow label="Endereco" value={endereco || undefined} />
          <InfoRow label="Localidade" value={localidade || undefined} />
          <InfoRow label="CEP" value={data.cep} />
          <InfoRow label="Telefone" value={data.telefone} />
        </SectionCard>
      )}

      {(data.atividadePrincipal || data.regimeApuracao) && (
        <SectionCard title="Atividade" icon="briefcase">
          <InfoRow
            label="Atividade Principal"
            value={data.atividadePrincipal}
          />
          <InfoRow label="Regime de Apuracao" value={data.regimeApuracao} />
        </SectionCard>
      )}
    </View>
  );
}

// ─── Shared Components ─────────────────────────────────────

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Feather name={icon} size={18} color="#3366FF" />
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

function InfoRow({
  label,
  value,
  bold,
}: {
  label: string;
  value?: string | null;
  bold?: boolean;
}) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, bold && { fontWeight: "700" }]}>
        {value}
      </Text>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────

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
  tabRow: {
    flexDirection: "row",
    gap: 0,
    marginTop: 24,
    borderBottomWidth: 2,
    borderBottomColor: "#E8E8E8",
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    marginBottom: -2,
  },
  tabActive: {
    borderBottomColor: "#3366FF",
  },
  tabLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#999",
  },
  tabLabelActive: {
    color: "#3366FF",
  },
  inputRow: {
    marginTop: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 8,
    height: 48,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#333",
    backgroundColor: "#FFF",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3366FF",
    borderRadius: 8,
    height: 48,
    paddingHorizontal: 24,
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonSecondary: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#3366FF",
  },
  buttonLabel: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
  loadingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#E3F2FD",
    borderRadius: 8,
    padding: 16,
    marginTop: 12,
  },
  loadingText: {
    color: "#1565C0",
    fontSize: 13,
    flex: 1,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFEBEE",
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
  },
  errorText: {
    color: "#C62828",
    fontSize: 14,
    flex: 1,
  },
  resultContainer: {
    marginTop: 24,
    gap: 16,
  },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E8E8E8",
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#F8F9FF",
    borderBottomWidth: 1,
    borderBottomColor: "#E8E8E8",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
  },
  cardBody: {
    padding: 16,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  infoLabel: {
    fontSize: 14,
    color: "#666",
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    color: "#333",
    flex: 2,
    textAlign: "right",
  },
  tableHeader: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: "#E0E0E0",
  },
  tableHeaderCell: {
    fontSize: 13,
    fontWeight: "700",
    color: "#666",
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  tableRowEven: {
    backgroundColor: "#FAFAFA",
  },
  tableCell: {
    fontSize: 14,
    color: "#333",
  },
});
