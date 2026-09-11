/**
 * Regras de conferência de embarque.
 *
 * Um embarque que leva animal de terceiro por engano é prejuízo direto e
 * problema com o dono do boitel. Como o erro só aparece depois do caminhão
 * sair, a conferência precisa acontecer no momento de montar a saída — e
 * exigir confirmação explícita, animal por animal.
 */
import { Bovino, ProprietarioAnimal } from "./weighing.types";

export function ehTerceiro(proprietario?: ProprietarioAnimal): boolean {
  return proprietario?.tipo === "terceiro";
}

/** Rótulo curto do dono, para listas e relatórios. */
export function nomeProprietario(animal: Pick<Bovino, "proprietario">): string {
  return ehTerceiro(animal.proprietario) ? animal.proprietario!.nome : "Próprio";
}

export interface ConferenciaEmbarque {
  /** Verdadeiro quando não há animal de terceiro no embarque. */
  liberado: boolean;
  proprios: Bovino[];
  terceiros: Bovino[];
  /** Terceiros agrupados por dono, para confirmar um a um. */
  porProprietario: { nome: string; cpfCnpj?: string; animais: Bovino[] }[];
  avisos: string[];
}

/**
 * Separa o embarque entre animais próprios e de terceiros.
 *
 * Não bloqueia sozinha: embarcar animal de terceiro é legítimo quando
 * combinado com o dono. O que não pode é acontecer sem alguém ver.
 */
export function conferirEmbarque(animais: Bovino[]): ConferenciaEmbarque {
  const proprios = animais.filter((a) => !ehTerceiro(a.proprietario));
  const terceiros = animais.filter((a) => ehTerceiro(a.proprietario));

  const grupos = new Map<string, { nome: string; cpfCnpj?: string; animais: Bovino[] }>();
  for (const animal of terceiros) {
    const chave = animal.proprietario!.cpfCnpj || animal.proprietario!.nome;
    const grupo = grupos.get(chave);
    if (grupo) grupo.animais.push(animal);
    else {
      grupos.set(chave, {
        nome: animal.proprietario!.nome,
        cpfCnpj: animal.proprietario!.cpfCnpj,
        animais: [animal],
      });
    }
  }

  const avisos: string[] = [];
  for (const grupo of grupos.values()) {
    avisos.push(`${grupo.animais.length} animal(is) de ${grupo.nome}`);
  }
  if (terceiros.length > 0 && proprios.length > 0) {
    avisos.push("Embarque mistura animais próprios e de terceiros");
  }

  return {
    liberado: terceiros.length === 0,
    proprios,
    terceiros,
    porProprietario: [...grupos.values()].sort((a, b) => b.animais.length - a.animais.length),
    avisos,
  };
}

/**
 * Texto do aviso mostrado antes de confirmar um embarque com terceiros.
 * Sempre nomeia os donos: é a informação que faz o operador parar.
 */
export function mensagemConfirmacaoEmbarque(conferencia: ConferenciaEmbarque): string {
  const linhas = conferencia.porProprietario.map(
    (g) => `• ${g.animais.length} de ${g.nome}${g.cpfCnpj ? ` (${g.cpfCnpj})` : ""}`
  );
  return [
    `Este embarque inclui ${conferencia.terceiros.length} animal(is) que não são seus:`,
    "",
    ...linhas,
    "",
    "Confirme que a saída foi combinada com o proprietário.",
  ].join("\n");
}

export type FiltroProprietario = "todos" | "proprios" | "terceiros";

export function filtrarPorProprietario(animais: Bovino[], filtro: FiltroProprietario): Bovino[] {
  if (filtro === "proprios") return animais.filter((a) => !ehTerceiro(a.proprietario));
  if (filtro === "terceiros") return animais.filter((a) => ehTerceiro(a.proprietario));
  return animais;
}
