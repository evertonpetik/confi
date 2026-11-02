import type { CargaTrato } from "@/components/CargaModal";
import type { DescargaTrato } from "@/components/DescargaModal";
import type { RoteiroCalculado } from "@/utils/mapaTratoCalc";
import { ScrollView, StyleSheet, Text, View } from "react-native";

/**
 * Tabelas de carga (insumos × tratos) e descarga (piquetes × tratos) de um
 * roteiro, com previsto e realizado lado a lado — a mesma visão que o
 * operador tinha na planilha, agora dentro do card do roteiro e na imagem
 * exportada do mapa de trato.
 */

type Props = {
  rc: RoteiroCalculado;
  cargas: CargaTrato[];
  descargas: DescargaTrato[];
  percentualMSFinal?: number;
  /** Na tela, as tabelas rolam na horizontal; na exportação ficam abertas. */
  scrollHorizontal?: boolean;
};

const COL_LABEL = 128;
const COL = 64;

function fmtKg(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "-";
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

/** Cor do realizado conforme o desvio em relação ao previsto. */
function corDesvio(previsto: number, realizado: number | null): string {
  if (realizado === null || previsto <= 0) return "#1a1a1a";
  const desvio = (realizado - previsto) / previsto;
  if (Math.abs(desvio) <= 0.05) return "#2E7D32";
  return "#E53935";
}

type Linha = {
  rotulo: string;
  sub?: string;
  previstoPorTrato: number[];
  realizadoPorTrato: (number | null)[];
  total?: boolean;
};

function Tabela({ titulo, tratos, linhas, scrollHorizontal }: { titulo: string; tratos: number[]; linhas: Linha[]; scrollHorizontal: boolean }) {
  const corpo = (
    <View>
      {/* Cabeçalho: nome | T1 prev | T1 real | ... | Total prev | Total real */}
      <View style={[styles.row, styles.headRow]}>
        <View style={[styles.cell, { width: COL_LABEL }]}>
          <Text style={styles.headText}>{titulo}</Text>
        </View>
        {tratos.map((t) => (
          <View key={t} style={[styles.cellGroup, { width: COL * 2 }]}>
            <Text style={styles.headText}>{t}º trato</Text>
            <View style={styles.row}>
              <Text style={[styles.subHeadText, { width: COL }]}>Prev.</Text>
              <Text style={[styles.subHeadText, { width: COL }]}>Real.</Text>
            </View>
          </View>
        ))}
        <View style={[styles.cellGroup, styles.totalGroup, { width: COL * 2 }]}>
          <Text style={styles.headText}>Total</Text>
          <View style={styles.row}>
            <Text style={[styles.subHeadText, { width: COL }]}>Prev.</Text>
            <Text style={[styles.subHeadText, { width: COL }]}>Real.</Text>
          </View>
        </View>
      </View>

      {linhas.map((l, i) => {
        const totalPrev = l.previstoPorTrato.reduce((a, v) => a + v, 0);
        const reais = l.realizadoPorTrato.filter((v): v is number => v !== null);
        const totalReal = reais.length > 0 ? reais.reduce((a, v) => a + v, 0) : null;
        return (
          <View key={`${l.rotulo}-${i}`} style={[styles.row, i % 2 === 1 && styles.zebra, l.total && styles.totalRow]}>
            <View style={[styles.cell, { width: COL_LABEL }]}>
              <Text style={[styles.cellLabel, l.total && styles.bold]} numberOfLines={1}>{l.rotulo}</Text>
              {!!l.sub && <Text style={styles.cellSub} numberOfLines={1}>{l.sub}</Text>}
            </View>
            {tratos.map((t, k) => (
              <View key={t} style={[styles.row, { width: COL * 2 }]}>
                <Text style={[styles.cellNum, { width: COL }, l.total && styles.bold]}>{fmtKg(l.previstoPorTrato[k])}</Text>
                <Text style={[styles.cellNum, { width: COL, color: corDesvio(l.previstoPorTrato[k], l.realizadoPorTrato[k]) }, l.total && styles.bold]}>
                  {fmtKg(l.realizadoPorTrato[k])}
                </Text>
              </View>
            ))}
            <View style={[styles.row, styles.totalGroup, { width: COL * 2 }]}>
              <Text style={[styles.cellNum, styles.bold, { width: COL }]}>{fmtKg(totalPrev)}</Text>
              <Text style={[styles.cellNum, styles.bold, { width: COL, color: corDesvio(totalPrev, totalReal) }]}>{fmtKg(totalReal)}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );

  if (!scrollHorizontal) return <View style={styles.tabela}>{corpo}</View>;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator style={styles.tabela}>
      {corpo}
    </ScrollView>
  );
}

export function RoteiroTabelas({ rc, cargas, descargas, percentualMSFinal, scrollHorizontal = true }: Props) {
  const tratos = Array.from({ length: Math.max(1, rc.numTratos) }, (_, i) => i + 1);
  const cargaDoTrato = (t: number) => cargas.find((c) => c.tratoNumero === t);
  const descargaDoTrato = (t: number) => descargas.find((d) => d.tratoNumero === t);

  const linhasCarga: Linha[] = rc.insumosPrevistos.map((ip) => ({
    rotulo: ip.insumoNome,
    sub: `MS ${ip.percentualMS.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`,
    previstoPorTrato: tratos.map(() => ip.previsto),
    realizadoPorTrato: tratos.map((t) => {
      const c = cargaDoTrato(t);
      if (!c) return null;
      return c.insumos.find((i) => i.insumoId === ip.insumoId)?.realizado ?? null;
    }),
  }));
  linhasCarga.push({
    rotulo: "Água",
    previstoPorTrato: tratos.map(() => rc.aguaPrevista),
    realizadoPorTrato: tratos.map((t) => cargaDoTrato(t)?.aguaRealizada ?? null),
  });
  linhasCarga.push({
    rotulo: "Total carga (kg MO)",
    total: true,
    previstoPorTrato: tratos.map((_, k) => linhasCarga.reduce((a, l) => a + l.previstoPorTrato[k], 0)),
    realizadoPorTrato: tratos.map((_, k) => {
      const vals = linhasCarga.map((l) => l.realizadoPorTrato[k]).filter((v): v is number => v !== null);
      return vals.length > 0 ? vals.reduce((a, v) => a + v, 0) : null;
    }),
  });

  const linhasDescarga: Linha[] = rc.descargaPrevistos.map((dp) => ({
    rotulo: dp.piqueteNome,
    sub: `Lote ${dp.loteNumero}`,
    previstoPorTrato: tratos.map(() => dp.previsto),
    realizadoPorTrato: tratos.map((t) => {
      const d = descargaDoTrato(t);
      if (!d) return null;
      return d.itens.find((i) => i.piqueteId === dp.piqueteId)?.realizado ?? null;
    }),
  }));
  linhasDescarga.push({
    rotulo: "Total descarga (kg MO)",
    total: true,
    previstoPorTrato: tratos.map((_, k) => linhasDescarga.reduce((a, l) => a + l.previstoPorTrato[k], 0)),
    realizadoPorTrato: tratos.map((_, k) => {
      const vals = linhasDescarga.map((l) => l.realizadoPorTrato[k]).filter((v): v is number => v !== null);
      return vals.length > 0 ? vals.reduce((a, v) => a + v, 0) : null;
    }),
  });

  return (
    <View style={styles.wrap}>
      <View style={styles.secaoHeader}>
        <Text style={styles.secaoTitulo}>Carga</Text>
        {!!percentualMSFinal && percentualMSFinal > 0 && (
          <Text style={styles.secaoInfo}>MS final da carga: {percentualMSFinal.toFixed(1).replace(".", ",")}%</Text>
        )}
      </View>
      <Tabela titulo="Insumo" tratos={tratos} linhas={linhasCarga} scrollHorizontal={scrollHorizontal} />

      <View style={[styles.secaoHeader, { marginTop: 12 }]}>
        <Text style={styles.secaoTitulo}>Descarga</Text>
      </View>
      <Tabela titulo="Piquete" tratos={tratos} linhas={linhasDescarga} scrollHorizontal={scrollHorizontal} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12 },
  secaoHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  secaoTitulo: { fontSize: 13, fontWeight: "700", color: "#1a1a1a" },
  secaoInfo: { fontSize: 11, color: "#666" },
  tabela: { backgroundColor: "#FFFFFF", borderRadius: 8, borderWidth: 1, borderColor: "#E0E0E0" },
  row: { flexDirection: "row", alignItems: "center" },
  headRow: { backgroundColor: "#ECEFF1", borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  zebra: { backgroundColor: "#FAFAFA" },
  totalRow: { borderTopWidth: 1, borderTopColor: "#CFD8DC", backgroundColor: "#F1F8E9" },
  totalGroup: { borderLeftWidth: 1, borderLeftColor: "#CFD8DC" },
  cell: { paddingHorizontal: 8, paddingVertical: 5, justifyContent: "center" },
  cellGroup: { alignItems: "center", paddingVertical: 3 },
  headText: { fontSize: 11, fontWeight: "700", color: "#37474F" },
  subHeadText: { fontSize: 10, color: "#607D8B", textAlign: "center" },
  cellLabel: { fontSize: 11, color: "#1a1a1a" },
  cellSub: { fontSize: 9, color: "#888" },
  cellNum: { fontSize: 11, color: "#1a1a1a", textAlign: "center", paddingVertical: 5 },
  bold: { fontWeight: "700" },
});
