import { readPreference, writePreference } from "../lib/safe-storage";
import {
  parseThemePreference,
  resolveTheme,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
} from "./theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

export function systemPrefersDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches;
}

export function readStoredPreference(): ThemePreference {
  return parseThemePreference(readPreference(THEME_STORAGE_KEY));
}

export function storePreference(preference: ThemePreference): void {
  writePreference(THEME_STORAGE_KEY, preference);
}

export function applyTheme(theme: ResolvedTheme): void {
  document.documentElement.dataset["theme"] = theme;
}

/** Aplica el tema antes del primer render para evitar un destello. */
export function applyInitialTheme(): void {
  applyTheme(resolveTheme(readStoredPreference(), systemPrefersDark()));
}

export function watchSystemTheme(onChange: (prefersDark: boolean) => void) {
  const query = window.matchMedia(DARK_QUERY);
  const listener = (event: MediaQueryListEvent) => onChange(event.matches);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}
