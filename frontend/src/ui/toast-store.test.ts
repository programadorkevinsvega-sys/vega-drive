import { describe, expect, it } from "vitest";
import {
  initialToastState,
  MAX_TOASTS,
  toastReducer,
  type ToastState,
} from "./toast-store";

function add(state: ToastState, title: string): ToastState {
  return toastReducer(state, { type: "add", input: { tone: "info", title } });
}

describe("toastReducer", () => {
  it("anade avisos con identificadores crecientes y no simulados por defecto", () => {
    const state = add(add(initialToastState, "uno"), "dos");
    expect(state.toasts.map((toast) => toast.id)).toEqual([1, 2]);
    expect(state.toasts.every((toast) => toast.simulated === false)).toBe(true);
  });

  it("conserva la marca de simulado", () => {
    const state = toastReducer(initialToastState, {
      type: "add",
      input: { tone: "success", title: "ok", simulated: true },
    });
    expect(state.toasts[0]?.simulated).toBe(true);
  });

  it("limita la cola y descarta los mas antiguos", () => {
    let state = initialToastState;
    for (let i = 0; i < MAX_TOASTS + 3; i += 1) state = add(state, `t${i}`);
    expect(state.toasts).toHaveLength(MAX_TOASTS);
    expect(state.toasts[0]?.title).toBe("t3");
  });

  it("cierra un aviso por id y mantiene la referencia si no existe", () => {
    const state = add(add(initialToastState, "a"), "b");
    const closed = toastReducer(state, { type: "dismiss", id: 1 });
    expect(closed.toasts.map((toast) => toast.title)).toEqual(["b"]);
    expect(toastReducer(closed, { type: "dismiss", id: 99 })).toBe(closed);
  });
});
