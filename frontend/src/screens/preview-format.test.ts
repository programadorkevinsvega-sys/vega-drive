import { describe, expect, it } from "vitest";
import { canPreviewFile, previewKind } from "./preview-format";

describe("clasificación de vista previa", () => {
  it("reconoce medios, texto y Office Open XML", () => {
    expect(previewKind("foto.PNG")).toBe("image");
    expect(previewKind("clip.mp4")).toBe("video");
    expect(previewKind("manual.pdf")).toBe("pdf");
    expect(previewKind("README.md")).toBe("text");
    expect(previewKind("informe.docx")).toBe("docx");
    expect(previewKind("datos.xlsx")).toBe("xlsx");
  });
  it("rechaza contenido activo y formatos Office antiguos", () => {
    for (const name of ["pagina.html", "vector.svg", "script.js", "macro.docm", "antiguo.doc", "libro.xls", "app.exe"]) {
      expect(canPreviewFile(name), name).toBe(false);
    }
  });
});
