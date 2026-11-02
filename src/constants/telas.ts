/**
 * Catálogo das telas do app e regras de acesso por usuário.
 *
 * O admin enxerga tudo. Os demais usuários enxergam as telas dos módulos
 * liberados no perfil (`usuarios.{uid}.modulos`) e, se o perfil tiver a lista
 * `telas`, apenas as telas listadas — é assim que um "tratador" fica só com
 * Dashboard, Leitura de Cocho e Tratador, por exemplo.
 *
 * Telas internas (detalhe do animal, fechamento de processo…) não aparecem na
 * seleção: ficam liberadas junto com a tela "pai" que leva até elas.
 */
import type { Feather } from "@expo/vector-icons";
import type { ModuloId } from "@/contexts/AuthContext";

export type IconeFeather = React.ComponentProps<typeof Feather>["name"];

export type TelaDef = {
  route: string;
  label: string;
  modulo: ModuloId | "comum";
  icon: IconeFeather;
  /** Aparece no menu lateral (padrão true). */
  menu?: boolean;
  /** Pode ser marcada na lista de telas do usuário (padrão true). */
  selecionavel?: boolean;
  /** Telas que, quando liberadas, liberam esta também (rotas internas). */
  pais?: string[];
};

export const TELAS: TelaDef[] = [
  // ── iConfi ──
  { route: "home", label: "Dashboard", modulo: "iconfi", icon: "home" },
  { route: "produtores", label: "Produtores", modulo: "iconfi", icon: "users" },
  { route: "lotes", label: "Lotes", modulo: "iconfi", icon: "trello" },
  { route: "leitura", label: "Leitura de Cocho", modulo: "iconfi", icon: "trending-up" },
  { route: "insumos", label: "Insumos", modulo: "iconfi", icon: "feather" },
  { route: "dietas", label: "Dietas", modulo: "iconfi", icon: "clipboard" },
  { route: "roteiros", label: "Roteiros", modulo: "iconfi", icon: "truck" },
  { route: "mapa-trato", label: "Mapa de Trato", modulo: "iconfi", icon: "map" },
  { route: "tratador", label: "Tratador", modulo: "iconfi", icon: "play-circle" },
  { route: "estimativa-peso", label: "Estimativa Peso", modulo: "iconfi", icon: "camera" },
  { route: "analise-lote", label: "Analise Lote", modulo: "iconfi", icon: "bar-chart-2" },
  { route: "relatorio-historico", label: "Relatório Histórico", modulo: "iconfi", icon: "clock" },

  // ── iFarm ──
  { route: "home-ifarm", label: "Dashboard", modulo: "ifarm", icon: "home" },
  { route: "animais", label: "Rebanho", modulo: "ifarm", icon: "list" },
  { route: "movimentacoes", label: "Movimentações", modulo: "ifarm", icon: "shuffle" },
  { route: "sanidade", label: "Sanidade", modulo: "ifarm", icon: "shield" },
  { route: "consulta-gta", label: "Consultas", modulo: "ifarm", icon: "search" },
  { route: "pesagem-lista", label: "Pesagem", modulo: "ifarm", icon: "activity" },
  { route: "processos", label: "Processos", modulo: "ifarm", icon: "layers" },
  { route: "pesagem-balanca", label: "Mangueiro", modulo: "ifarm", icon: "activity", menu: false, pais: ["processos", "animais", "pesagem-lista"] },
  { route: "brincos", label: "Brincos", modulo: "ifarm", icon: "tag", menu: false, pais: ["processos"] },
  { route: "pesagem-leitura", label: "Leitura de pesagem", modulo: "ifarm", icon: "activity", menu: false, selecionavel: false, pais: ["pesagem-lista", "pesagem-balanca"] },
  { route: "pesagem-historico", label: "Histórico de pesagem", modulo: "ifarm", icon: "activity", menu: false, selecionavel: false, pais: ["pesagem-lista", "animais"] },
  { route: "animal-detalhe", label: "Detalhe do animal", modulo: "ifarm", icon: "list", menu: false, selecionavel: false, pais: ["animais", "movimentacoes", "pesagem-lista"] },
  { route: "fechar-processo", label: "Fechar processo", modulo: "ifarm", icon: "layers", menu: false, selecionavel: false, pais: ["processos"] },

  // ── Abastecimento ──
  { route: "home-abastecimento", label: "Dashboard", modulo: "abastecimento", icon: "home" },
  { route: "tanques", label: "Tanques", modulo: "abastecimento", icon: "database" },
  { route: "veiculos", label: "Veiculos", modulo: "abastecimento", icon: "navigation" },
  { route: "abastecimento", label: "Abastecimento", modulo: "abastecimento", icon: "droplet" },
  { route: "historico-combustivel", label: "Hist. Combustivel", modulo: "abastecimento", icon: "list" },

  // ── Comuns ──
  { route: "configuracoes", label: "Configuracoes", modulo: "comum", icon: "settings" },
  { route: "signup", label: "Usuarios", modulo: "comum", icon: "user-plus", selecionavel: false },
];

export const MODULO_LABEL: Record<ModuloId, string> = {
  iconfi: "iConfi",
  ifarm: "iFarm",
  abastecimento: "Abastecimento",
};

export type PerfilAcesso = {
  tipo: string;
  modulos?: ModuloId[];
  /** Lista de rotas liberadas. Ausente, null ou vazia = todas as telas dos módulos. */
  telas?: string[] | null;
};

export function telaPorRota(route: string): TelaDef | undefined {
  return TELAS.find((t) => t.route === route);
}

/** Telas que um admin pode marcar para um usuário com os módulos informados. */
export function telasSelecionaveis(modulos: ModuloId[]): TelaDef[] {
  return TELAS.filter(
    (t) => t.selecionavel !== false && (t.modulo === "comum" || modulos.includes(t.modulo))
  );
}

/** Rotas de um módulo (inclusive internas) mais as comuns — o universo que o drawer conhece. */
export function rotasDoModulo(modulo: ModuloId): string[] {
  return TELAS.filter((t) => t.modulo === modulo || t.modulo === "comum").map((t) => t.route);
}

export function temRestricaoDeTelas(perfil: PerfilAcesso): boolean {
  return perfil.tipo !== "admin" && Array.isArray(perfil.telas) && perfil.telas.length > 0;
}

export function podeAcessar(perfil: PerfilAcesso | null | undefined, route: string): boolean {
  if (!perfil) return false;
  if (perfil.tipo === "admin") return true;
  if (route === "signup") return false;
  const def = telaPorRota(route);
  if (!def) return true; // rota fora do catálogo: não bloqueia
  if (def.modulo !== "comum" && perfil.modulos && !perfil.modulos.includes(def.modulo)) return false;
  if (!temRestricaoDeTelas(perfil)) return true;
  const telas = perfil.telas!;
  if (telas.includes(route)) return true;
  return (def.pais ?? []).some((p) => telas.includes(p));
}

/** Itens do menu lateral para o módulo selecionado, já filtrados pelo perfil. */
export function menuDoModulo(perfil: PerfilAcesso | null | undefined, modulo: ModuloId): TelaDef[] {
  return TELAS.filter(
    (t) =>
      (t.modulo === modulo || t.modulo === "comum") &&
      t.menu !== false &&
      podeAcessar(perfil, t.route)
  );
}

/** Primeira tela que o usuário pode abrir no módulo — destino padrão após o login. */
export function primeiraTelaPermitida(perfil: PerfilAcesso | null | undefined, modulo: ModuloId): string {
  const menu = menuDoModulo(perfil, modulo);
  const home = TELAS.find((t) => t.modulo === modulo && t.icon === "home")!.route;
  if (menu.some((t) => t.route === home)) return home;
  return menu[0]?.route ?? home;
}
