import { DrawerSceneWrapper } from "@/components/drawe-scene-wrapper";
import { DrawerToggleButton } from "@/components/DrawerToggleButton";
import { useResponsive } from "@/hooks/useResponsive";
import { consultarGTA, GTAData } from "@/services/gtaService";
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

export default function ConsultaGTA() {
  const {
    isTablet,
    isDesktop,
    maxWidthContent,
    containerPadding,
    titleFontSize,
    headerPaddingTop,
  } = useResponsive();

  const [barcode, setBarcode] = useState("");
  const [loading, setLoading] = useState(false);
  const [gta, setGta] = useState<GTAData | null>(null);
  const [erro, setErro] = useState("");
  const inputRef = useRef<TextInput>(null);

  const handleConsultar = useCallback(async () => {
    const trimmed = barcode.replace(/\s/g, "");
    if (!trimmed) {
      Alert.alert("Aviso", "Informe o codigo de barras MAPA.");
      return;
    }

    setLoading(true);
    setGta(null);
    setErro("");

    try {
      const data = await consultarGTA(trimmed);
      setGta(data);
    } catch (error: any) {
      const msg = error?.message || "Erro desconhecido";
      setErro(msg);
    } finally {
      setLoading(false);
    }
  }, [barcode]);

  function handleNovaPesquisa() {
    setBarcode("");
    setGta(null);
    setErro("");
    inputRef.current?.focus();
  }

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
              Consulta GTA
            </Text>
            {!isDesktop && <DrawerToggleButton tintColor="#000000" />}
          </View>

          <Text style={styles.subtitle}>
            Consulte documentos de transito animal pelo codigo de barras MAPA.
          </Text>

          {/* Input */}
          <View style={styles.inputRow}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Codigo de barras MAPA (44 digitos)"
              placeholderTextColor="#999"
              value={barcode}
              onChangeText={setBarcode}
              keyboardType="numeric"
              maxLength={44}
              editable={!loading}
              onSubmitEditing={handleConsultar}
            />
          </View>

          {/* Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              activeOpacity={0.8}
              onPress={handleConsultar}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Feather name="search" size={20} color="#FFF" />
              )}
              <Text style={styles.buttonLabel}>
                {loading ? "Consultando..." : "Consultar"}
              </Text>
            </TouchableOpacity>

            {gta && (
              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary]}
                activeOpacity={0.8}
                onPress={handleNovaPesquisa}
              >
                <Feather name="refresh-cw" size={18} color="#3366FF" />
                <Text style={[styles.buttonLabel, { color: "#3366FF" }]}>
                  Nova Pesquisa
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Error */}
          {!!erro && (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={18} color="#E53935" />
              <Text style={styles.errorText}>{erro}</Text>
            </View>
          )}

          {/* Results */}
          {gta && <GTAResult gta={gta} isDesktop={isDesktop} />}
        </View>
      </ScrollView>
    </DrawerSceneWrapper>
  );
}

function GTAResult({
  gta,
  isDesktop,
}: {
  gta: GTAData;
  isDesktop: boolean;
}) {
  return (
    <View style={styles.resultContainer}>
      {/* Dados da GTA */}
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

      {/* Origem */}
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

      {/* Destino */}
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

      {/* Animais */}
      {gta.animais && gta.animais.length > 0 && (
        <SectionCard title="Animais" icon="list">
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { flex: 2.5 }]}>Descricao</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Sexo</Text>
            <Text style={[styles.tableHeaderCell, { flex: 0.7, textAlign: "right" }]}>
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
  inputRow: {
    marginTop: 24,
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
  rawJson: {
    fontSize: 12,
    color: "#555",
    fontFamily: Platform.OS === "web" ? "monospace" : undefined,
  },
});
