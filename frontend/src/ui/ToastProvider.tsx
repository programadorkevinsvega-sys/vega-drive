import { useCallback, useMemo, useReducer, type ReactNode } from "react";
import { ToastContext, type ToastApi } from "./toast-context";
import { ToastItem } from "./ToastItem";
import {
  initialToastState,
  toastReducer,
  type ToastInput,
} from "./toast-store";

export function ToastProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(toastReducer, initialToastState);

  const dismiss = useCallback((id: number) => {
    dispatch({ type: "dismiss", id });
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      notify: (input: ToastInput) => dispatch({ type: "add", input }),
      notifySimulated: (input) =>
        dispatch({ type: "add", input: { ...input, simulated: true } }),
      dismiss,
    }),
    [dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="vd-toasts" role="region" aria-label="Notificaciones">
        {state.toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
