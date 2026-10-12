import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadFile } from "./files-transfer-service";

class FakeXMLHttpRequest extends EventTarget {
  static instances: FakeXMLHttpRequest[] = [];
  readonly upload = new EventTarget();
  readonly headers = new Map<string, string>();
  method = "";
  url = "";
  status = 0;
  responseText = "";

  constructor() {
    super();
    FakeXMLHttpRequest.instances.push(this);
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string) {
    this.headers.set(name.toLowerCase(), value);
  }

  send(_body: unknown) {}
}

afterEach(() => {
  FakeXMLHttpRequest.instances = [];
  vi.unstubAllGlobals();
});

describe("sesiones multipart", () => {
  it("aborta una sesión creada si la respuesta multipart es incompatible", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXMLHttpRequest);
    const task = uploadFile(
      {
        name: "demo.bin",
        size: 100 * 1024 * 1024,
        type: "application/octet-stream",
        slice: (start = 0, end = 0) => ({ size: end - start }) as Blob,
      } as File,
      null,
    );
    const start = FakeXMLHttpRequest.instances[0];
    if (!start) throw new Error("No se creó la sesión multipart.");

    start.status = 201;
    start.responseText = JSON.stringify({
      uploadId: "session-stale",
      partSizeBytes: 16 * 1024 * 1024,
      totalParts: 7,
      directTransfersEnabled: false,
    });
    start.dispatchEvent(new Event("load"));

    await vi.waitFor(() => {
      expect(FakeXMLHttpRequest.instances[1]?.url).toBe(
        "/api/files/multipart/session-stale/abort",
      );
    });
    const abort = FakeXMLHttpRequest.instances[1];
    if (!abort) throw new Error("No se intentó limpiar la sesión inválida.");
    abort.status = 200;
    abort.responseText = JSON.stringify({ ok: true });
    abort.dispatchEvent(new Event("load"));

    await expect(task).rejects.toMatchObject({
      name: "FilesApiError",
      status: 500,
      message: "El servidor devolvió una sesión de subida inválida.",
    });
  });
});
