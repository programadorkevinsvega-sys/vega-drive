export type ToastTone = "info" | "success" | "error";

export interface ToastInput {
  tone: ToastTone;
  title: string;
  description?: string | undefined;
  /** true = la operacion no es real; se muestra con la marca "Simulado". */
  simulated?: boolean | undefined;
}

export interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  description: string | undefined;
  simulated: boolean;
}

export interface ToastState {
  toasts: readonly Toast[];
  nextId: number;
}

export type ToastAction =
  { type: "add"; input: ToastInput } | { type: "dismiss"; id: number };

export const MAX_TOASTS = 4;

export const initialToastState: ToastState = { toasts: [], nextId: 1 };

export function toastReducer(
  state: ToastState,
  action: ToastAction,
): ToastState {
  switch (action.type) {
    case "add": {
      const toast: Toast = {
        id: state.nextId,
        tone: action.input.tone,
        title: action.input.title,
        description: action.input.description,
        simulated: action.input.simulated ?? false,
      };
      return {
        toasts: [...state.toasts, toast].slice(-MAX_TOASTS),
        nextId: state.nextId + 1,
      };
    }
    case "dismiss": {
      const toasts = state.toasts.filter((toast) => toast.id !== action.id);
      return toasts.length === state.toasts.length
        ? state
        : { ...state, toasts };
    }
  }
}
