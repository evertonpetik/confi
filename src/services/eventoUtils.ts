/**
 * Manipulação da linha do tempo de eventos.
 *
 * Sem dependências de React Native ou Firestore, para poder ser verificado
 * fora do app — a leitura do histórico é o que sustenta a rastreabilidade e
 * precisa de teste.
 */
import { Evento, TipoEvento } from "./weighing.types";

/**
 * Remove da leitura os eventos estornados e os próprios estornos.
 * O dado permanece no banco: some apenas da linha do tempo visível.
 */
export function semEstornados(eventos: Evento[]): Evento[] {
  const estornados = new Set(
    eventos
      .filter((e) => e.tipo === "estorno" && e.eventoEstornadoId)
      .map((e) => e.eventoEstornadoId)
  );
  return eventos.filter((e) => e.tipo !== "estorno" && !estornados.has(e.id));
}

/** Ordena do mais recente para o mais antigo, com desempate estável pela gravação. */
export function maisRecentePrimeiro(eventos: Evento[]): Evento[] {
  return [...eventos].sort((a, b) => {
    const d = new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime();
    return d !== 0 ? d : new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime();
  });
}

/**
 * Agrupa eventos gravados no mesmo instante.
 *
 * Uma passagem pelo mangueiro gera cadastro + pesagem + movimentação juntos;
 * na tela isso é um acontecimento só, não três linhas repetindo a mesma hora.
 */
export function agruparPorMomento(eventos: Evento[]): Evento[][] {
  const grupos = new Map<string, Evento[]>();
  for (const e of maisRecentePrimeiro(eventos)) {
    const chave = `${e.dataHora}|${e.processoId ?? ""}`;
    const grupo = grupos.get(chave);
    if (grupo) grupo.push(e);
    else grupos.set(chave, [e]);
  }
  return [...grupos.values()];
}

/** Último evento de um tipo, ou `undefined` se o animal nunca teve um. */
export function ultimoDoTipo(eventos: Evento[], tipo: TipoEvento): Evento | undefined {
  return maisRecentePrimeiro(eventos.filter((e) => e.tipo === tipo))[0];
}

/**
 * Ganho médio diário entre a primeira e a última pesagem.
 * `null` com menos de duas pesagens — não há período para calcular.
 */
export function gmdDosEventos(eventos: Evento[]): { gmdKg: number; dias: number } | null {
  const pesagens = maisRecentePrimeiro(eventos.filter((e) => e.tipo === "pesagem" && e.peso));
  if (pesagens.length < 2) return null;

  const ultima = pesagens[0];
  const primeira = pesagens[pesagens.length - 1];
  const dias = Math.max(
    1,
    Math.round(
      (new Date(ultima.dataHora).getTime() - new Date(primeira.dataHora).getTime()) / 86_400_000
    )
  );
  return { gmdKg: (ultima.peso! - primeira.peso!) / dias, dias };
}
