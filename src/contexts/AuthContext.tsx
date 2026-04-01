import {
  signIn as authSignIn,
  signOut as authSignOut,
  AuthUser,
  onAuthStateChanged,
} from "@/services/authService";
import {
  getRawCollection,
  getRawDocument,
  setCurrentFazendaId,
  setRawDocument,
} from "@/services/firestoreService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type UsuarioProfile = {
  nome: string;
  email: string;
  tipo: "admin" | "gestor" | "cliente";
  fazendas: string[];
};

export type Fazenda = {
  id: string;
  nome: string;
};

type AuthContextType = {
  user: AuthUser | null;
  userProfile: UsuarioProfile | null;
  selectedFazendaId: string | null;
  selectedFazendaNome: string | null;
  fazendas: Fazenda[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  selectFazenda: (id: string, nome: string) => void;
  clearFazenda: () => void;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [userProfile, setUserProfile] = useState<UsuarioProfile | null>(null);
  const [selectedFazendaId, setSelectedFazendaId] = useState<string | null>(null);
  const [selectedFazendaNome, setSelectedFazendaNome] = useState<string | null>(null);
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(async (fbUser) => {
      if (fbUser) {
        setUser(fbUser);
        await loadUserProfile(fbUser.uid, fbUser.email);
      } else {
        setUser(null);
        setUserProfile(null);
        setSelectedFazendaId(null);
        setSelectedFazendaNome(null);
        setFazendas([]);
        setCurrentFazendaId(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  async function loadUserProfile(uid: string, email: string | null) {
    try {
      const doc = await getRawDocument(["usuarios"], uid);
      if (doc.exists !== false && doc.data()) {
        const data = doc.data();
        const profile: UsuarioProfile = {
          nome: data.nome ?? "",
          email: data.email ?? "",
          tipo: data.tipo ?? "cliente",
          fazendas: data.fazendas ?? [],
        };
        setUserProfile(profile);
        await loadFazendas(profile);
        await restoreFazenda(profile);
      } else {
        // Documento nao existe — verificar se e o primeiro usuario (bootstrap admin)
        const usersSnap = await getRawCollection("usuarios");
        if (usersSnap.empty) {
          // Primeiro usuario do sistema: criar como admin
          const adminProfile: UsuarioProfile = {
            nome: email?.split("@")[0] ?? "Admin",
            email: email ?? "",
            tipo: "admin",
            fazendas: [],
          };
          await setRawDocument(["usuarios"], uid, adminProfile);
          setUserProfile(adminProfile);
          await loadFazendas(adminProfile);
        } else {
          // Usuario existe no Auth mas nao no Firestore — sem acesso
          console.warn("Usuario autenticado sem perfil no Firestore:", uid);
          setUserProfile(null);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar perfil do usuario:", error);
      setUserProfile(null);
    }
  }

  async function loadFazendas(profile: UsuarioProfile) {
    try {
      const snap = await getRawCollection("fazendas");
      const all: Fazenda[] = snap.docs.map((d) => ({
        id: d.id,
        nome: d.data().nome ?? "",
      }));
      if (profile.tipo === "admin") {
        setFazendas(all.sort((a, b) => a.nome.localeCompare(b.nome)));
      } else {
        const allowed = all
          .filter((f) => profile.fazendas.includes(f.id))
          .sort((a, b) => a.nome.localeCompare(b.nome));
        setFazendas(allowed);
      }
    } catch (error) {
      console.error("Erro ao carregar fazendas:", error);
    }
  }

  async function restoreFazenda(profile: UsuarioProfile) {
    try {
      const savedId = await AsyncStorage.getItem("@selectedFazendaId");
      const savedNome = await AsyncStorage.getItem("@selectedFazendaNome");
      if (savedId) {
        const hasAccess =
          profile.tipo === "admin" || profile.fazendas.includes(savedId);
        if (hasAccess) {
          setSelectedFazendaId(savedId);
          setSelectedFazendaNome(savedNome);
          setCurrentFazendaId(savedId);
        }
      }
    } catch {
      /* ignore */
    }
  }

  const signIn = useCallback(async (email: string, password: string) => {
    await authSignIn(email, password);
  }, []);

  const signOut = useCallback(async () => {
    setCurrentFazendaId(null);
    setSelectedFazendaId(null);
    setSelectedFazendaNome(null);
    setUserProfile(null);
    setFazendas([]);
    await AsyncStorage.removeItem("@selectedFazendaId");
    await AsyncStorage.removeItem("@selectedFazendaNome");
    await authSignOut();
  }, []);

  const selectFazenda = useCallback((id: string, nome: string) => {
    setSelectedFazendaId(id);
    setSelectedFazendaNome(nome);
    setCurrentFazendaId(id);
    AsyncStorage.setItem("@selectedFazendaId", id);
    AsyncStorage.setItem("@selectedFazendaNome", nome);
  }, []);

  const clearFazenda = useCallback(() => {
    setSelectedFazendaId(null);
    setSelectedFazendaNome(null);
    setCurrentFazendaId(null);
    AsyncStorage.removeItem("@selectedFazendaId");
    AsyncStorage.removeItem("@selectedFazendaNome");
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        selectedFazendaId,
        selectedFazendaNome,
        fazendas,
        loading,
        signIn,
        signOut,
        selectFazenda,
        clearFazenda,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
