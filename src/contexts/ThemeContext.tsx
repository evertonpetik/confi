import { getDocument, setDocument } from "@/services/firestoreService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

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

const COLOR_KEY = "@confi_theme_color";
const LOGO_KEY = "@confi_logo_url";

type ThemeContextType = {
  primaryColor: string;
  setPrimaryColor: (color: string) => void;
  logoUrl: string | null;
  setLogoUrl: (url: string | null) => void;
};

const ThemeContext = createContext<ThemeContextType>({
  primaryColor: "#3366FF",
  setPrimaryColor: () => { },
  logoUrl: null,
  setLogoUrl: () => { },
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [primaryColor, setPrimaryColorState] = useState("#3366FF");
  const [logoUrl, setLogoUrlState] = useState<string | null>(null);

  useEffect(() => {
    // Load from local storage first (fast)
    AsyncStorage.getItem(COLOR_KEY).then((saved) => {
      if (saved) setPrimaryColorState(saved);
    });
    AsyncStorage.getItem(LOGO_KEY).then((saved) => {
      if (saved) setLogoUrlState(saved);
    });

    // Then try Firestore for logo (may be updated from another device)
    getDocument(["config"], "app")
      .then((doc) => {
        // DocSnapshot.exists é boolean opcional (não função): undefined = não informado
        if (doc.exists !== false && doc.data()) {
          const data = doc.data() as Record<string, any>;
          if (data.logoUrl) {
            setLogoUrlState(data.logoUrl);
            AsyncStorage.setItem(LOGO_KEY, data.logoUrl);
          }
          if (data.primaryColor) {
            setPrimaryColorState(data.primaryColor);
            AsyncStorage.setItem(COLOR_KEY, data.primaryColor);
          }
        }
      })
      .catch(() => {
        // Offline - use cached values
      });
  }, []);

  function setPrimaryColor(color: string) {
    setPrimaryColorState(color);
    AsyncStorage.setItem(COLOR_KEY, color);
    // Persist to Firestore so other devices can pick it up
    setDocument(["config"], "app", { primaryColor: color }, { merge: true }).catch(() => { });
  }

  function setLogoUrl(url: string | null) {
    setLogoUrlState(url);
    if (url) {
      AsyncStorage.setItem(LOGO_KEY, url);
    } else {
      AsyncStorage.removeItem(LOGO_KEY);
    }
  }

  return (
    <ThemeContext.Provider value={{ primaryColor, setPrimaryColor, logoUrl, setLogoUrl }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
