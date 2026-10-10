import { describe, expect, it } from "vitest";
import { parseThemePreference, resolveTheme } from "./theme";

describe("parseThemePreference", () => {
  it("acepta solo valores conocidos", () => {
    expect(parseThemePreference("light")).toBe("light");
    expect(parseThemePreference("dark")).toBe("dark");
    expect(parseThemePreference("system")).toBe("system");
  });

  it("cae a 'system' con cualquier otro valor", () => {
    for (const raw of [null, "", "azul", "DARK", "<script>"]) {
      expect(parseThemePreference(raw)).toBe("system");
    }
  });
});

describe("resolveTheme", () => {
  it("respeta la eleccion explicita", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("sigue al sistema cuando se pide", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});
