import { createContext, useContext } from "react";
import type { ToastInput } from "./toast-store";

export interface ToastApi {
  notify: (input: ToastInput) => void;
  /** Atajo para operaciones simuladas: fuerza simulated = true. */
  notifySimulated: (input: Omit<ToastInput, "simulated">) => void;
  dismiss: (id: number) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("Falta ToastProvider en el arbol.");
  return api;
}
