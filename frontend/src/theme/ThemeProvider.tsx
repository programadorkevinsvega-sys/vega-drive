import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { resolveTheme, type ResolvedTheme, type ThemePreference } from "./theme";
import {
  applyTheme,
  readStoredPreference,
  storePreference,
  systemPrefersDark,
  watchSystemTheme,
} from "./theme-dom";

interface ThemeContextValue {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState(readStoredPreference);
  const [prefersDark, setPrefersDark] = useState(systemPrefersDark);
  const resolved = resolveTheme(preference, prefersDark);

  useEffect(() => watchSystemTheme(setPrefersDark), []);
  useEffect(() => applyTheme(resolved), [resolved]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      resolved,
      setPreference: (next) => {
        setPreferenceState(next);
        storePreference(next);
      },
    }),
    [preference, resolved],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("Falta ThemeProvider en el arbol.");
  return value;
}
