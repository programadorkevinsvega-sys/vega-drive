import { useMemo, useSyncExternalStore } from "react";
import { buildHash, DEFAULT_HASH, parseHash, type Route } from "./routes";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

const getSnapshot = (): string => window.location.hash;
const getServerSnapshot = (): string => "";

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return useMemo(() => parseHash(hash), [hash]);
}

export function navigate(route: Route): void {
  window.location.hash = buildHash(route);
}

/** Si no hay fragmento, fija la ruta inicial sin crear una entrada de historial. */
export function ensureDefaultHash(): void {
  if (!window.location.hash) {
    window.history.replaceState(null, "", DEFAULT_HASH);
  }
}
