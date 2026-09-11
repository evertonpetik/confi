/**
 * Histórico da fazenda — todos os eventos do rebanho, do mais recente ao mais
 * antigo.
 *
 * Lê a mesma coleção que alimenta a linha do tempo de cada animal. Enquanto a
 * ficha responde "o que aconteceu com este boi", esta tela responde "o que
 * aconteceu hoje no mangueiro".
 */
import { DrawerSceneWrapper } from "@/components/drawe-scene-wrapper";
import { DrawerToggleButton } from "@/components/DrawerToggleButton";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useResponsive } from "@/hooks/useResponsive";
import EventoService, { semEstornados } from "@/services/eventoService";
import { Evento, TipoEvento } from "@/services/weighing.types";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type NomeIcone = React.ComponentProps<typeof Feather>["name"];

const ESTILO: Record<TipoEvento, { icone: NomeIcone; cor: string; rotulo: string }> = {
  cadastro: { icone: "tag", cor: "#009688", rotulo: "Identificação" },
  pesagem: { icone: "trending-up", cor: "#FF9800", rotulo: "Pesagem" },
  movimentacao: { icone: "shuffle", cor: "#2196F3", rotulo: "Movimentação" },
  sanitario: { icone: "shield", cor: "#9C27B0", rotulo: "Sanidade" },
  saida: { icone: "log-out", cor: "#F44336", rotulo: "Saída" },
  certificacao: { icone: "award", cor: "#1565C0", rotulo: "Certificação" },
  estorno: { icone: "rotate-ccw", cor: "#9E9E9E", rotulo: "Estorno" },
};

const FILTROS: { valor: TipoEvento | "todos"; rotulo: string }[] = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "cadastro", rotulo: "Entradas" },
  { valor: "pesagem", rotulo: "Pesagens" },
  { valor: "movimentacao", rotulo: "Movimentações" },
  { valor: "sanitario", rotulo: "Sanidade" },
  { valor: "saida", rotulo: "Saídas" },
];

function detalhe(e: Evento): string {
  if (e.tipo === "pesagem" && e.peso) return `${e.peso.toFixed(1)} kg`;
  if (e.tipo === "sanitario" && e.sanitario) return e.sanitario.produto;
  if (e.para?.localNome) return e.de?.localNome ? `${e.de.localNome} → ${e.para.localNome}` : e.para.localNome;
  return "";
}

export default function Movimentacoes() {
  const { primaryColor } = useTheme();
  const { selectedFazendaId } = useAuth();
  const { containerPadding, titleFontSize, headerPaddingTop, isDesktop } = useResponsive();
  const router = useRouter();
  const fazendaId = selectedFazendaId ?? "";

  const [eventos, setEventos] = useState<Evento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState<TipoEvento | "todos">("todos");
  const [termo, setTermo] = useState("");

  const carregar = useCallback(async () => {
    if (!fazendaId) return;
    setCarregando(true);
    try {
      setEventos(semEstornados(await EventoService.listarRecentes(fazendaId)));
    } finally {
      setCarregando(false);
    }
  }, [fazendaId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const filtrados = useMemo(() => {
    let lista = filtro === "todos" ? eventos : eventos.filter((e) => e.tipo === filtro);
    if (termo) {
      lista = lista.filter(
        (e) => e.sisbov.includes(termo) || e.manejo.includes(termo)
      );
    }
    return lista;
  }, [eventos, filtro, termo]);

  /** Quantos animais distintos entraram, saíram e foram pesados no período. */
  const totais = useMemo(() => {
    const conta = (tipo: TipoEvento) =>
      new Set(eventos.filter((e) => e.tipo === tipo).map((e) => e.animalId)).size;
    return { entradas: conta("cadastro"), saidas: conta("saida"), pesagens: conta("pesagem") };
  }, [eventos]);

  return (
    <DrawerSceneWrapper>
      <View style={styles.container}>
        <View style={[styles.header, { paddingHorizontal: containerPadding, paddingTop: headerPaddingTop }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.titulo, { fontSize: titleFontSize }]}>Movimentações</Text>
            <Text style={styles.subtitulo}>Histórico do rebanho</Text>
          </View>
          {!isDesktop && <DrawerToggleButton tintColor="#000000" />}
        </View>

        <View style={[styles.totaisRow, { marginHorizontal: containerPadding }]}>
          {[
            { rotulo: "Entradas", valor: totais.entradas, cor: "#009688" },
            { rotulo: "Pesagens", valor: totais.pesagens, cor: "#FF9800" },
            { rotulo: "Saídas", valor: totais.saidas, cor: "#F44336" },
          ].map((t) => (
            <View key={t.rotulo} style={styles.totalCard}>
              <Text style={[styles.totalValor, { color: t.cor }]}>{t.valor}</Text>
              <Text style={styles.totalRotulo}>{t.rotulo}</Text>
            </View>
          ))}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: containerPadding, paddingVertical: 10, gap: 8 }}
        >
          {FILTROS.map((f) => (
            <TouchableOpacity
              key={f.valor}
              style={[
                styles.chip,
                filtro === f.valor && { backgroundColor: primaryColor, borderColor: primaryColor },
              ]}
              onPress={() => setFiltro(f.valor)}
            >
              <Text style={[styles.chipText, filtro === f.valor && { color: "#fff" }]}>{f.rotulo}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={[styles.busca, { marginHorizontal: containerPadding }]}>
          <Feather name="search" size={16} color="#999" />
          <TextInput
            style={styles.buscaInput}
            value={termo}
            onChangeText={setTermo}
            placeholder="SISBOV ou manejo"
            placeholderTextColor="#999"
            keyboardType="numeric"
          />
        </View>

        {carregando ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={primaryColor} />
        ) : (
          <FlatList
            data={filtrados}
            keyExtractor={(item, i) => item.id ?? `${item.animalId}-${i}`}
            contentContainerStyle={{ padding: containerPadding, paddingTop: 8 }}
            ListEmptyComponent={
              <View style={styles.vazioBox}>
                <Feather name="inbox" size={30} color="#DDD" />
                <Text style={styles.vazio}>Nenhum evento registrado.</Text>
              </View>
            }
            renderItem={({ item }) => {
              const estilo = ESTILO[item.tipo];
              const texto = detalhe(item);
              return (
                <TouchableOpacity
                  style={styles.linha}
                  onPress={() =>
                    router.push({
                      pathname: "/animal-detalhe",
                      params: { animalId: item.animalId },
                    })
                  }
                >
                  <View style={[styles.linhaIcone, { backgroundColor: estilo.cor + "18" }]}>
                    <Feather name={estilo.icone} size={15} color={estilo.cor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.linhaManejo}>
                      {item.manejo}
                      <Text style={styles.linhaTipo}> · {estilo.rotulo}</Text>
                    </Text>
                    {texto ? <Text style={styles.linhaDetalhe}>{texto}</Text> : null}
                  </View>
                  <Text style={styles.linhaData}>
                    {new Date(item.dataHora).toLocaleDateString("pt-BR")}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    </DrawerSceneWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FDFDFD" },
  header: { flexDirection: "row", alignItems: "flex-start", marginBottom: 12 },
  titulo: { fontWeight: "900", color: "#1a1a1a" },
  subtitulo: { fontSize: 13, color: "#888", marginTop: 2 },

  totaisRow: { flexDirection: "row", gap: 8 },
  totalCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    paddingVertical: 12,
    alignItems: "center",
  },
  totalValor: { fontSize: 22, fontWeight: "900" },
  totalRotulo: { fontSize: 11, color: "#999", marginTop: 2 },

  chip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    backgroundColor: "#fff",
  },
  chipText: { fontSize: 12, fontWeight: "600", color: "#666" },

  busca: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#EEE",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  buscaInput: { flex: 1, fontSize: 14, color: "#333" },

  linha: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F2F2F2",
    padding: 12,
    marginBottom: 8,
  },
  linhaIcone: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  linhaManejo: { fontSize: 14, fontWeight: "800", color: "#333" },
  linhaTipo: { fontSize: 12, fontWeight: "500", color: "#999" },
  linhaDetalhe: { fontSize: 12, color: "#666", marginTop: 1 },
  linhaData: { fontSize: 11, color: "#BBB" },

  vazioBox: { alignItems: "center", paddingVertical: 50, gap: 10 },
  vazio: { fontSize: 13, color: "#BBB" },
});
