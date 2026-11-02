/**
 * Tema visual (cor primária e logo) — definido POR FAZENDA.
 *
 * Fazendas patrocinadas pela Sol usam a logo Sol e laranja, as da Beeftec a
 * logo Beeftec e vermelho, e as independentes escolhem a própria logo e cor.
 * O admin configura no cadastro da fazenda (tela Usuários); fica gravado no
 * documento `fazendas/{id}` (campos `primaryColor` e `logoUrl`), por isso
 * vale para todo usuário que acessar aquela fazenda, em qualquer aparelho.
 *
 * O tema ativo acompanha a fazenda selecionada. Sem fazenda (login) usa o
 * padrão. Cache local por fazenda em AsyncStorage para abrir rápido/offline.
 * `fazendas/{id}/config/app` (cor/logo gravados pela tela antiga) é lido só
 * como reserva enquanto o documento da fazenda não tem tema.
 */
import { getRawDocument, updateRawDocument } from "@/services/firestoreService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useRef, useState, type ReactNode } from "react";

export const THEME_COLORS = [
  { label: "Azul", value: "#3366FF" },
  { label: "Azul Marinho", value: "#1E40AF" },
  { label: "Indigo", value: "#4F46E5" },
  { label: "Violeta", value: "#7C3AED" },
  { label: "Roxo", value: "#9333EA" },
  { label: "Rosa", value: "#DB2777" },
  { label: "Vermelho", value: "#DC2626" },
  { label: "Laranja", value: "#EA580C" },
  { label: "Ambar", value: "#D97706" },
  { label: "Verde", value: "#16A34A" },
  { label: "Esmeralda", value: "#059669" },
  { label: "Teal", value: "#0D9488" },
  { label: "Ciano", value: "#0891B2" },
  { label: "Cinza", value: "#4B5563" },
];

export const COR_PADRAO = "#3366FF";

export type TemaFazenda = {
  primaryColor?: string | null;
  logoUrl?: string | null;
};

/** Caminho da logo de uma fazenda no Storage (coberto por storage.rules em fazendas/{id}/**). */
export function caminhoLogoFazenda(fazendaId: string): string {
  return `fazendas/${fazendaId}/config/logo.png`;
}

const cacheKey = (fazendaId: string) => `@confi_tema:${fazendaId}`;

type ThemeContextType = {
  primaryColor: string;
  logoUrl: string | null;
  /** Fazenda cujo tema está aplicado (null = padrão). */
  temaFazendaId: string | null;
  /** Aplica o tema da fazenda informada (null volta ao padrão). */
  carregarTemaDaFazenda: (fazendaId: string | null) => Promise<void>;
  /** Grava o tema no documento da fazenda; se for a fazenda ativa, aplica na hora. */
  salvarTemaDaFazenda: (fazendaId: string, tema: TemaFazenda) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextType>({
  primaryColor: COR_PADRAO,
  logoUrl: null,
  temaFazendaId: null,
  carregarTemaDaFazenda: async () => { },
  salvarTemaDaFazenda: async () => { },
});

function normalizar(data: Record<string, any> | undefined | null): TemaFazenda | null {
  if (!data) return null;
  const cor = typeof data.primaryColor === "string" && data.primaryColor ? data.primaryColor : null;
  const logo = typeof data.logoUrl === "string" && data.logoUrl ? data.logoUrl : null;
  return cor || logo ? { primaryColor: cor, logoUrl: logo } : null;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [primaryColor, setPrimaryColor] = useState(COR_PADRAO);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [temaFazendaId, setTemaFazendaId] = useState<string | null>(null);
  // Evita que uma leitura lenta de fazenda antiga sobrescreva a fazenda atual
  const fazendaAtualRef = useRef<string | null>(null);

  function aplicar(tema: TemaFazenda | null) {
    setPrimaryColor(tema?.primaryColor || COR_PADRAO);
    setLogoUrl(tema?.logoUrl || null);
  }

  async function carregarTemaDaFazenda(fazendaId: string | null) {
    fazendaAtualRef.current = fazendaId;
    setTemaFazendaId(fazendaId);
    if (!fazendaId) {
      aplicar(null);
      return;
    }

    // 1) cache local da fazenda (instantâneo)
    try {
      const cached = await AsyncStorage.getItem(cacheKey(fazendaId));
      if (cached && fazendaAtualRef.current === fazendaId) aplicar(JSON.parse(cached));
    } catch { /* ignora */ }

    // 2) documento da fazenda (fonte da verdade)
    let tema: TemaFazenda | null = null;
    try {
      const doc = await getRawDocument(["fazendas"], fazendaId);
      if (doc.exists !== false) tema = normalizar(doc.data());
    } catch { /* offline ou sem permissão — fica com o cache */ }

    // 3) reserva: tema legado em fazendas/{id}/config/app
    if (!tema) {
      try {
        const legado = await getRawDocument(["fazendas", fazendaId, "config"], "app");
        if (legado.exists !== false) tema = normalizar(legado.data());
      } catch { /* ignora */ }
    }

    if (fazendaAtualRef.current !== fazendaId) return;
    if (tema) {
      aplicar(tema);
      AsyncStorage.setItem(cacheKey(fazendaId), JSON.stringify(tema)).catch(() => { });
    } else {
      aplicar(null);
      AsyncStorage.removeItem(cacheKey(fazendaId)).catch(() => { });
    }
  }

  async function salvarTemaDaFazenda(fazendaId: string, tema: TemaFazenda) {
    const payload: Record<string, unknown> = {};
    if (tema.primaryColor !== undefined) payload.primaryColor = tema.primaryColor ?? "";
    if (tema.logoUrl !== undefined) payload.logoUrl = tema.logoUrl ?? "";
    await updateRawDocument(["fazendas"], fazendaId, payload);

    // Atualiza o cache e, se for a fazenda em uso, a tela
    let atual: TemaFazenda = {};
    try {
      const cached = await AsyncStorage.getItem(cacheKey(fazendaId));
      if (cached) atual = JSON.parse(cached);
    } catch { /* ignora */ }
    const novo: TemaFazenda = { ...atual, ...tema };
    await AsyncStorage.setItem(cacheKey(fazendaId), JSON.stringify(novo));
    if (fazendaAtualRef.current === fazendaId) aplicar(novo);
  }

  return (
    <ThemeContext.Provider value={{ primaryColor, logoUrl, temaFazendaId, carregarTemaDaFazenda, salvarTemaDaFazenda }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
