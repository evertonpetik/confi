/**
 * Sinalização de que o animal é de terceiro.
 *
 * Aparece em toda tela que mostra um animal. O risco concreto é embarcar boi
 * de boitel junto com os próprios: quem está no mangueiro precisa ver de quem
 * é o animal sem procurar, então a tarja é fixa e não some com scroll.
 */
import { ProprietarioAnimal } from "@/services/weighing.types";
import { Feather } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

export const COR_TERCEIRO = "#E65100";

export function ehTerceiro(proprietario?: ProprietarioAnimal): boolean {
  return proprietario?.tipo === "terceiro";
}

/** Faixa larga, para o topo da ficha e do mangueiro. */
export function TarjaProprietario({ proprietario }: { proprietario?: ProprietarioAnimal }) {
  if (!ehTerceiro(proprietario)) return null;

  return (
    <View style={styles.tarja}>
      <Feather name="alert-triangle" size={16} color="#fff" />
      <View style={{ flex: 1 }}>
        <Text style={styles.tarjaTitulo}>ANIMAL DE TERCEIRO</Text>
        <Text style={styles.tarjaNome} numberOfLines={1}>
          {proprietario!.nome}
          {proprietario!.cpfCnpj ? ` · ${proprietario!.cpfCnpj}` : ""}
        </Text>
      </View>
    </View>
  );
}

/** Etiqueta compacta, para itens de lista onde não cabe a faixa inteira. */
export function BadgeProprietario({ proprietario }: { proprietario?: ProprietarioAnimal }) {
  if (!ehTerceiro(proprietario)) return null;

  return (
    <View style={styles.badge}>
      <Feather name="user" size={10} color={COR_TERCEIRO} />
      <Text style={styles.badgeTexto} numberOfLines={1}>
        {proprietario!.nome}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tarja: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: COR_TERCEIRO,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 12,
  },
  tarjaTitulo: { fontSize: 11, fontWeight: "900", color: "#fff", letterSpacing: 0.5 },
  tarjaNome: { fontSize: 13, fontWeight: "600", color: "#FFF3E0", marginTop: 1 },

  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: COR_TERCEIRO + "1A",
    borderWidth: 1,
    borderColor: COR_TERCEIRO + "55",
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 6,
    marginTop: 4,
  },
  badgeTexto: { fontSize: 10, fontWeight: "700", color: COR_TERCEIRO, maxWidth: 160 },
});
