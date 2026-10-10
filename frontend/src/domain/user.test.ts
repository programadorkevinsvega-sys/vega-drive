import { describe, expect, it } from "vitest";
import { initialsOf } from "./user";

describe("initialsOf", () => {
  it("toma hasta dos iniciales en mayuscula", () => {
    expect(initialsOf("perfil de ejemplo")).toBe("PD");
    expect(initialsOf("  ana  ")).toBe("A");
    expect(initialsOf("Álvaro Núñez Pérez")).toBe("ÁN");
  });

  it("devuelve '?' sin nombre util", () => {
    expect(initialsOf("")).toBe("?");
    expect(initialsOf("   ")).toBe("?");
  });
});
