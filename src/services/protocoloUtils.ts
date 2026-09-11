/**
 * Conversão de protocolo em aplicações e registros sanitários.
 *
 * Sem dependências de Firestore ou React Native: o cálculo de carência e de
 * próxima dose é o que libera (ou não) o animal para abate, e precisa de teste.
 */
import { AplicacaoSanitaria, EventoSanitario, ItemProtocolo, ProtocoloSanitario } from "./weighing.types";

// ─── Aplicação ────────────────────────────────────────────────────────────────

function somarDias(iso: string, dias: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + dias);
  return d.toISOString();
}

/** Converte um item do protocolo na aplicação que vai para o histórico. */
export function aplicacaoDoItem(
  item: ItemProtocolo,
  protocolo: Pick<ProtocoloSanitario, "id" | "nome">,
  dataAplicacao: string
): AplicacaoSanitaria {
  return {
    protocoloId: protocolo.id,
    protocoloNome: protocolo.nome,
    tipo: item.tipo,
    produto: item.produto,
    dose: item.dose,
    via: item.via,
    // Datas já calculadas na gravação: conferir carência depois, no papel, é
    // exatamente onde se erra a liberação para abate.
    carenciaAte: item.carenciaDias ? somarDias(dataAplicacao, item.carenciaDias) : undefined,
    proximaEm: item.repetirEmDias ? somarDias(dataAplicacao, item.repetirEmDias) : undefined,
  };
}

/** Todas as aplicações de um conjunto de protocolos, na ordem de cadastro. */
export function aplicacoesDosProtocolos(
  protocolos: ProtocoloSanitario[],
  dataAplicacao: string
): AplicacaoSanitaria[] {
  return protocolos.flatMap((p) =>
    p.itens.map((item) => aplicacaoDoItem(item, { id: p.id, nome: p.nome }, dataAplicacao))
  );
}

/** Registro sanitário do animal correspondente a uma aplicação. */
export function eventoSanitarioDaAplicacao(
  aplicacao: AplicacaoSanitaria,
  animalId: string,
  dataAplicacao: string,
  fazendaId: string,
  tecnico?: string
): EventoSanitario {
  return {
    animalId,
    tipo: aplicacao.tipo,
    descricao: aplicacao.produto,
    dataAplicacao,
    dose: aplicacao.dose,
    via: aplicacao.via,
    tecnico,
    reentrada: aplicacao.carenciaAte,
    proxAplicacao: aplicacao.proximaEm,
    observacoes: aplicacao.protocoloNome ? `Protocolo ${aplicacao.protocoloNome}` : undefined,
    farmedaId: fazendaId,
    criadoEm: new Date().toISOString(),
  };
}

/**
 * Data em que o animal fica liberado para abate, considerando tudo que já
 * recebeu. Vale a carência mais distante — a mais recente pode ser mais curta.
 */
export function carenciaAtiva(eventos: EventoSanitario[], hoje = new Date()): string | null {
  const futuras = eventos
    .map((e) => e.reentrada)
    .filter((d): d is string => !!d && new Date(d) > hoje)
    .sort();
  return futuras.length > 0 ? futuras[futuras.length - 1] : null;
}
