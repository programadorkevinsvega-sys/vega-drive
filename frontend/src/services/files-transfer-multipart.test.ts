import { afterEach, describe, expect, it, vi } from "vitest";
import { UploadController } from "./files-transfer-controller";
import { uploadMultipartFile } from "./files-transfer-multipart";

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
    let response: unknown;
    if (this.method === "POST" && this.url === "/api/files/multipart") {
      response = {
        uploadId: "session-a",
        partSizeBytes: 16 * 1024 * 1024,
        totalParts: 6,
        directTransfersEnabled: false,
      };
    } else if (
      this.method === "PUT" &&
      this.url.startsWith("/api/files/multipart/session-a/parts/")
    ) {
      const partNumber = Number(this.url.match(/parts\/(\d+)$/)?.[1]);
      response = { partNumber };
    } else if (
      this.method === "POST" &&
      this.url === "/api/files/multipart/session-a/complete"
    ) {
      response = { type: "file", id: "file-a" };
    } else {
      throw new Error("Unexpected test request");
    }

    this.status = 200;
    this.responseText = JSON.stringify(response);
    this.dispatchEvent(new Event("load"));
  }

  abort() {
    this.dispatchEvent(new Event("abort"));
  }
}

afterEach(() => {
  FakeXMLHttpRequest.instances = [];
  vi.unstubAllGlobals();
});

describe("transferencia multipart con direct R2 deshabilitado", () => {
  it("usa el respaldo por Worker sin solicitar URLs directas", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXMLHttpRequest);
    const size = 96 * 1024 * 1024;
    const file = {
      name: "VSCodeUserSetup-x64-1.141.0.exe",
      size,
      type: "application/x-msdownload",
      lastModified: 1,
      slice: (start: number, end: number) =>
        ({ size: end - start }) as Blob,
    } as File;

    const result = await uploadMultipartFile(
      file,
      null,
      undefined,
      new UploadController(),
    );

    expect(result).toMatchObject({ type: "file", id: "file-a" });
    const requests = FakeXMLHttpRequest.instances;
    expect(requests[0]?.url).toBe("/api/files/multipart");
    expect(
      requests.filter((request) => request.method === "PUT"),
    ).toHaveLength(6);
    expect(
      requests.some((request) => request.url.endsWith("/url")),
    ).toBe(false);
    expect(requests.at(-1)?.url).toBe(
      "/api/files/multipart/session-a/complete",
    );
  });
});
