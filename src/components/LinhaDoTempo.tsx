/**
 * Linha do tempo do animal — a rastreabilidade que a certificadora audita.
 *
 * Eventos gravados no mesmo instante (uma passagem pelo mangueiro costuma
 * gerar cadastro + pesagem + movimentação) aparecem como um acontecimento só,
 * não como três linhas repetindo a mesma hora.
 */
import { agruparPorMomento } from "@/services/eventoUtils";
import { Evento, TipoEvento } from "@/services/weighing.types";
import { Feather } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

type NomeIcone = React.ComponentProps<typeof Feather>["name"];

const ESTILO_EVENTO: Record<TipoEvento, { icone: NomeIcone; cor: string; rotulo: string }> = {
  cadastro: { icone: "tag", cor: "#009688", rotulo: "Identificação" },
  pesagem: { icone: "trending-up", cor: "#FF9800", rotulo: "Pesagem" },
  movimentacao: { icone: "shuffle", cor: "#2196F3", rotulo: "Movimentação" },
  sanitario: { icone: "shield", cor: "#9C27B0", rotulo: "Sanidade" },
  saida: { icone: "log-out", cor: "#F44336", rotulo: "Saída" },
  certificacao: { icone: "award", cor: "#1565C0", rotulo: "Certificação" },
  estorno: { icone: "rotate-ccw", cor: "#9E9E9E", rotulo: "Estorno" },
};

function dataHoraBr(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

/** Texto curto do que aconteceu, específico por tipo. */
function descrever(evento: Evento): string {
  switch (evento.tipo) {
    case "cadastro":
      return evento.para?.localNome
        ? `Brinco aplicado · destino ${evento.para.localNome}`
        : "Brinco aplicado";
    case "pesagem":
      return evento.peso ? `${evento.peso.toFixed(1)} kg` : "Peso registrado";
    case "movimentacao": {
      const de = evento.de?.localNome;
      const para = evento.para?.localNome;
      if (de && para) return `${de} → ${para}`;
      if (para) return `Para ${para}`;
      return "Mudança de local";
    }
    case "sanitario": {
      const s = evento.sanitario;
      if (!s) return "Aplicação sanitária";
      const partes = [s.produto];
      if (s.dose) partes.push(s.dose);
      if (s.protocoloNome) partes.push(`protocolo ${s.protocoloNome}`);
      return partes.join(" · ");
    }
    case "saida":
      return evento.motivoSaida ? `Motivo: ${evento.motivoSaida}` : "Saiu da propriedade";
    case "certificacao":
      return "Situação no SISBOV atualizada";
    case "estorno":
      return evento.observacoes ?? "Registro desfeito";
  }
}

export function LinhaDoTempo({ eventos }: { eventos: Evento[] }) {
  const grupos = agruparPorMomento(eventos);

  if (grupos.length === 0) {
    return (
      <View style={styles.vazioBox}>
        <Feather name="clock" size={28} color="#DDD" />
        <Text style={styles.vazio}>Nenhum evento registrado ainda.</Text>
      </View>
    );
  }

  return (
    <View>
      {grupos.map((grupo, indice) => {
        const primeiro = grupo[0];
        const ultimoGrupo = indice === grupos.length - 1;

        return (
          <View key={`${primeiro.dataHora}-${indice}`} style={styles.grupo}>
            {/* Trilho vertical ligando os acontecimentos */}
            <View style={styles.trilhoColuna}>
              <View style={[styles.bolinha, { backgroundColor: ESTILO_EVENTO[primeiro.tipo].cor }]} />
              {!ultimoGrupo && <View style={styles.trilho} />}
            </View>

            <View style={styles.conteudo}>
              <Text style={styles.dataHora}>{dataHoraBr(primeiro.dataHora)}</Text>

              {grupo.map((evento) => {
                const estilo = ESTILO_EVENTO[evento.tipo];
                return (
                  <View key={evento.id ?? `${evento.tipo}-${evento.dataHora}`} style={styles.item}>
                    <View style={[styles.itemIcone, { backgroundColor: estilo.cor + "18" }]}>
                      <Feather name={estilo.icone} size={13} color={estilo.cor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemRotulo, { color: estilo.cor }]}>{estilo.rotulo}</Text>
                      <Text style={styles.itemDesc}>{descrever(evento)}</Text>
                      {evento.observacoes && evento.tipo !== "estorno" && (
                        <Text style={styles.itemObs}>{evento.observacoes}</Text>
                      )}
                    </View>
                  </View>
                );
              })}

              {primeiro.processoId && (
                <Text style={styles.rodape}>
                  {primeiro.origem === "mangueiro" ? "No mangueiro" : "Registro manual"}
                  {primeiro.faixaEtaria ? ` · ${primeiro.faixaEtaria}` : ""}
                </Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grupo: { flexDirection: "row", gap: 12 },
  trilhoColuna: { alignItems: "center", width: 14 },
  bolinha: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  trilho: { flex: 1, width: 2, backgroundColor: "#EEE", marginVertical: 4 },
  conteudo: { flex: 1, paddingBottom: 20 },
  dataHora: { fontSize: 11, fontWeight: "700", color: "#999", marginBottom: 6 },
  item: { flexDirection: "row", gap: 10, marginBottom: 8, alignItems: "flex-start" },
  itemIcone: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  itemRotulo: { fontSize: 12, fontWeight: "700" },
  itemDesc: { fontSize: 13, color: "#444", marginTop: 1 },
  itemObs: { fontSize: 11, color: "#999", marginTop: 2, fontStyle: "italic" },
  rodape: { fontSize: 10, color: "#BBB", marginTop: 2 },
  vazioBox: { alignItems: "center", paddingVertical: 40, gap: 10 },
  vazio: { fontSize: 13, color: "#BBB" },
});
