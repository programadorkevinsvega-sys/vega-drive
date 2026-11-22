import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPreviewBytes } from "./preview-http-client";

afterEach(() => vi.unstubAllGlobals());

describe("descarga privada para vista previa", () => {
  it("lee el contenido desde el mismo origen con la sesión autenticada", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([65, 66, 67]), {
        headers: { "Content-Length": "3" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchPreviewBytes("/api/files/file_a/preview/content");

    expect([...new Uint8Array(result)]).toEqual([65, 66, 67]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://r2.example.test/signed",
      expect.objectContaining({
        mode: "cors",
        credentials: "same-origin",
        cache: "no-store",
        referrerPolicy: "no-referrer",
      }),
    );
  });

  it("rechaza un tamaño declarado inválido antes de leer el cuerpo", async () => {
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array([1]));
      },
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(body, { headers: { "Content-Length": "-1" } }),
        ),
    );

    await expect(
      fetchPreviewBytes("https://r2.example.test/signed"),
    ).rejects.toThrow("tamaño de archivo no válido");
  });

  it("rechaza archivos mayores de 25 MiB según Content-Length", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        headers: { "Content-Length": String(25 * 1024 * 1024 + 1) },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchPreviewBytes("https://r2.example.test/signed"),
    ).rejects.toThrow("mayor de 25 MB");
  });

  it("propaga la señal de cancelación al navegador", async () => {
    const controller = new AbortController();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(new Uint8Array([1])));
    vi.stubGlobal("fetch", fetchMock);

    await fetchPreviewBytes(
      "https://r2.example.test/signed",
      controller.signal,
    );

    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ signal: controller.signal }),
    );
  });
});
