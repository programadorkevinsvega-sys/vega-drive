import { afterEach, describe, expect, it, vi } from "vitest";
import { FilesApiError } from "./files-service";
import { uploadFile } from "./files-transfer-service";

class FakeXMLHttpRequest extends EventTarget {
  static instances: FakeXMLHttpRequest[] = [];
  readonly upload = new EventTarget();
  readonly headers = new Map<string, string>();
  method = "";
  url = "";
  status = 0;
  responseText = "";
  body: unknown;

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

  send(body: unknown) {
    this.body = body;
  }
}

function file(overrides: Partial<File> = {}): File {
  return {
    name: "demo.txt",
    size: 100,
    type: "text/plain",
    lastModified: 1,
    ...overrides,
  } as File;
}

function emitProgress(request: FakeXMLHttpRequest, loaded: number, total: number) {
  const event = new Event("progress");
  Object.defineProperties(event, {
    lengthComputable: { value: true },
    loaded: { value: loaded },
    total: { value: total },
  });
  request.upload.dispatchEvent(event);
}

afterEach(() => {
  FakeXMLHttpRequest.instances = [];
  vi.unstubAllGlobals();
});

describe("subida binaria con progreso", () => {
  it("usa el endpoint same-origin y comunica el progreso real", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXMLHttpRequest);
    const progress = vi.fn();
    const task = uploadFile(file(), "folder-1", progress);
    const request = FakeXMLHttpRequest.instances[0];
    expect(request).toBeDefined();
    if (!request) throw new Error("No se creó la solicitud de subida.");

    expect(request.method).toBe("POST");
    expect(request.url).toBe("/api/files");
    expect(request.headers.get("content-type")).toBe("text/plain");
    expect(request.headers.get("x-file-name")).toBe("demo.txt");
    expect(request.headers.get("x-file-size")).toBe("100");
    expect(request.headers.get("x-file-folder-id")).toBe("folder-1");

    emitProgress(request, 45, 100);
    expect(progress).toHaveBeenCalledWith(45);

    request.status = 201;
    request.responseText = JSON.stringify({ type: "file", id: "file-1" });
    request.dispatchEvent(new Event("load"));
    await expect(task).resolves.toMatchObject({ type: "file", id: "file-1" });
    expect(progress).toHaveBeenLastCalledWith(100);
  });

  it("no anuncia el 100 % antes de que el servidor confirme la subida", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXMLHttpRequest);
    const progress = vi.fn();
    const task = uploadFile(file(), null, progress);
    const request = FakeXMLHttpRequest.instances[0];
    if (!request) throw new Error("No se creó la solicitud de subida.");

    emitProgress(request, 100, 100);
    expect(progress).toHaveBeenCalledWith(99);

    request.status = 200;
    request.responseText = JSON.stringify({ type: "file", id: "file-2" });
    request.dispatchEvent(new Event("load"));
    await task;
    expect(progress).toHaveBeenLastCalledWith(100);
  });

  it("traduce los errores HTTP sin exponer el cuerpo del servidor", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXMLHttpRequest);
    const task = uploadFile(file(), null);
    const request = FakeXMLHttpRequest.instances[0];
    if (!request) throw new Error("No se creó la solicitud de subida.");

    request.status = 429;
    request.responseText = JSON.stringify({ error: "PRIVATE DETAILS" });
    request.dispatchEvent(new Event("load"));

    await expect(task).rejects.toMatchObject<Partial<FilesApiError>>({
      name: "FilesApiError",
      status: 429,
      message: expect.stringContaining("límite temporal"),
    });
  });

  it("rechaza archivos que superan el límite antes de abrir una solicitud", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXMLHttpRequest);
    const oversized = file({ size: 95 * 1024 * 1024 + 1 });

    await expect(uploadFile(oversized, null)).rejects.toMatchObject({
      name: "FilesApiError",
      status: 413,
    });
    expect(FakeXMLHttpRequest.instances).toHaveLength(0);
  });
});
