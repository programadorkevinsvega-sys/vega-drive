import { describe, expect, it } from "vitest";
import { formatFileSize } from "./format-file-size";

describe("formatFileSize", () => {
  it("usa MB decimales para coincidir con el tamaño de Cloudflare R2", () => {
    expect(formatFileSize(251_830_000)).toBe("251.83 MB");
  });

  it("usa múltiplos de 1000 en KB y normaliza los límites de unidad", () => {
    expect(formatFileSize(1_024)).toBe("1.02 KB");
    expect(formatFileSize(999_999)).toBe("1 MB");
  });

  it("mantiene bytes y elimina decimales innecesarios", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(1_000_000)).toBe("1 MB");
    expect(formatFileSize(1_000_000_000)).toBe("1 GB");
  });
});
