import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  getSession,
  login as loginRequest,
  logout as logoutRequest,
  type AuthenticatedUser,
} from "./identity-service";

export type AuthStatus =
  | "loading"
  | "authenticated"
  | "anonymous"
  | "unavailable";
interface AuthContextValue {
  status: AuthStatus;
  user: AuthenticatedUser | null;
  signIn(email: string, password: string, token: string): Promise<void>;
  signOut(): Promise<void>;
  refreshSession(): Promise<void>;
}
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const refreshSession = useCallback(async () => {
    setStatus("loading");
    try {
      const session = await getSession();
      if (session.authenticated) {
        setUser(session.user);
        setStatus("authenticated");
      } else {
        setUser(null);
        setStatus("anonymous");
      }
    } catch {
      setUser(null);
      setStatus("unavailable");
    }
  }, []);
  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const signIn = useCallback(
    async (email: string, password: string, token: string) => {
      const authenticatedUser = await loginRequest(email, password, token);
      setUser(authenticatedUser);
      setStatus("authenticated");
    },
    [],
  );
  const signOut = useCallback(async () => {
    await logoutRequest();
    setUser(null);
    setStatus("anonymous");
  }, []);

  return (
    <AuthContext.Provider
      value={{ status, user, signIn, signOut, refreshSession }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider no está montado.");
  return value;
}
