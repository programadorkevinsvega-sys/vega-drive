import { describe, expect, it } from "vitest";
import { fileTypeIcon, fileTypeLabel, fileVisualType } from "./file-type-icon";

describe("clasificación visual de archivos", () => {
  it.each([
    ["vacaciones.JPG", "image", "file-image", "Imagen"],
    ["clip.mp4", "video", "file-video", "Vídeo"],
    ["audio.flac", "audio", "file-audio", "Audio"],
    ["contrato.pdf", "pdf", "file-pdf", "PDF"],
    ["informe.docx", "document", "file-word", "Documento"],
    ["datos.xlsx", "spreadsheet", "file-spreadsheet", "Hoja de cálculo"],
    ["reporte.pptx", "presentation", "file-presentation", "Presentación"],
    ["backup.tar.gz", "archive", "file-archive", "Archivo comprimido"],
    ["app.tsx", "code", "file-code", "Código"],
    ["notas.md", "text", "file-text", "Texto"],
    ["sin-extension", "generic", "file", "Archivo"],
  ] as const)(
    "clasifica %s",
    (name, expectedType, expectedIcon, expectedLabel) => {
      expect(fileVisualType(name)).toBe(expectedType);
      expect(fileTypeIcon(name)).toBe(expectedIcon);
      expect(fileTypeLabel(name)).toBe(expectedLabel);
    },
  );
});
