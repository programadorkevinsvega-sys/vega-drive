import { describe, expect, it } from "vitest";
import { decodePreviewText } from "./decode-preview-text";

function buffer(bytes: number[]): ArrayBuffer {
  return new Uint8Array(bytes).buffer;
}

describe("decodificación de archivos de texto", () => {
  it("lee UTF-8 con y sin BOM", () => {
    expect(decodePreviewText(buffer([65, 108, 111, 104, 97]))).toBe("Aloha");
    expect(
      decodePreviewText(buffer([0xef, 0xbb, 0xbf, 65, 108, 111, 104, 97])),
    ).toBe("Aloha");
  });

  it("lee UTF-16 little-endian y big-endian con BOM", () => {
    expect(decodePreviewText(buffer([0xff, 0xfe, 65, 0, 66, 0]))).toBe("AB");
    expect(decodePreviewText(buffer([0xfe, 0xff, 0, 65, 0, 66]))).toBe("AB");
  });

  it("detecta UTF-16 sin BOM", () => {
    expect(decodePreviewText(buffer([65, 0, 66, 0, 67, 0, 68, 0]))).toBe("ABCD");
  });

  it("usa Windows-1252 cuando el texto no es UTF-8 válido", () => {
    expect(decodePreviewText(buffer([99, 97, 102, 233]))).toBe("café");
  });
});
