import type { FilesFileView } from "./files-contract";
import { FilesApiError, messageForStatus } from "./files-api-error";
import { uploadMultipartFile } from "./files-transfer-multipart";

const MAX_SINGLE_UPLOAD_BYTES = 95 * 1024 * 1024;
export const MULTIPART_PART_BYTES = 16 * 1024 * 1024;

export type UploadProgressListener = (percentage: number) => void;


export class UploadCancelledError extends Error {
  constructor() {
    super("La subida se canceló.");
    this.name = "UploadCancelledError";
  }
}

export class UploadPausedError extends Error {
  constructor() {
    super("La subida está pausada.");
    this.name = "UploadPausedError";
  }
}

/** Control compartido por la cola y el transporte HTTP de cada archivo. */
export export class UploadController {
  paused = false;
  cancelled = false;
  private request: XMLHttpRequest | null = null;
  private waiters: Array<() => void> = [];

  pause() {
    if (this.cancelled || this.paused) return;
    this.paused = true;
    this.request?.abort();
  }

  resume() {
    if (this.cancelled) return;
    this.paused = false;
    this.wake();
  }

  cancel() {
    if (this.cancelled) return;
    this.cancelled = true;
    this.paused = false;
    this.request?.abort();
    this.wake();
  }

  async waitUntilReady(): Promise<void> {
    while (this.paused && !this.cancelled) {
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }
    if (this.cancelled) throw new UploadCancelledError();
  }

  attach(request: XMLHttpRequest) {
    this.request = request;
  }

  detach(request: XMLHttpRequest) {
    if (this.request === request) this.request = null;
  }

  private wake() {
    for (const resolve of this.waiters.splice(0)) resolve();
  }
}

function createRequest() {
  return new XMLHttpRequest();
}

export function parseFileResponse(value: unknown, status: number): FilesFileView {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    (value as { type?: unknown }).type !== "file" ||
    typeof (value as { id?: unknown }).id !== "string"
  ) {
    throw new FilesApiError(
      "El servidor devolvió una respuesta de archivo inválida.",
      status,
    );
  }
  return value as FilesFileView;
}

export function requestJson<T>(
  method: string,
  url: string,
  body: Blob | string | null,
  headers: Record<string, string> = {},
  onProgress?: (loaded: number) => void,
  totalBytes = 0,
  control?: UploadController,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = createRequest();
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      control?.detach(request);
      callback();
    };
    request.open(method, url, true);
    request.setRequestHeader("Accept", "application/json");
    request.setRequestHeader("Cache-Control", "no-store");
    for (const [name, value] of Object.entries(headers)) {
      request.setRequestHeader(name, value);
    }
    if (control) control.attach(request);
    if (onProgress) {
      request.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          onProgress(Math.min(event.loaded, totalBytes));
        }
      });
    }
    request.addEventListener("error", () =>
      finish(() => reject(new FilesApiError(messageForStatus(0), 0))),
    );
    request.addEventListener("abort", () =>
      finish(() => {
        if (control?.cancelled) reject(new UploadCancelledError());
        else if (control?.paused) reject(new UploadPausedError());
        else reject(new FilesApiError(messageForStatus(0), 0));
      }),
    );
    request.addEventListener("load", () =>
      finish(() => {
        if (request.status < 200 || request.status >= 300) {
          reject(
            new FilesApiError(messageForStatus(request.status), request.status),
          );
          return;
        }
        try {
          resolve(JSON.parse(request.responseText) as T);
        } catch {
          reject(
            new FilesApiError(
              "El servidor devolvió una respuesta inválida.",
              request.status,
            ),
          );
        }
      }),
    );
    request.send(body);
  });
}


function uploadSingleFile(
  file: File,
  folderId: string | null,
  onProgress: UploadProgressListener | undefined,
  control: UploadController,
): Promise<FilesFileView> {
  return new Promise((resolve, reject) => {
    const request = createRequest();
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      control.detach(request);
      callback();
    };
    request.open("POST", "/api/files", true);
    request.setRequestHeader("Accept", "application/json");
    request.setRequestHeader(
      "Content-Type",
      file.type || "application/octet-stream",
    );
    request.setRequestHeader("Cache-Control", "no-store");
    request.setRequestHeader("X-File-Name", encodeURIComponent(file.name));
    request.setRequestHeader("X-File-Size", String(file.size));
    if (folderId) request.setRequestHeader("X-File-Folder-Id", folderId);
    control.attach(request);
    request.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable || file.size === 0) return;
      onProgress?.(
        Math.min(99, Math.floor((event.loaded / event.total) * 100)),
      );
    });
    request.addEventListener("error", () =>
      finish(() => reject(new FilesApiError(messageForStatus(0), 0))),
    );
    request.addEventListener("abort", () =>
      finish(() => {
        if (control.cancelled) reject(new UploadCancelledError());
        else if (control.paused) reject(new UploadPausedError());
        else reject(new FilesApiError(messageForStatus(0), 0));
      }),
    );
    request.addEventListener("load", () =>
      finish(() => {
        if (request.status < 200 || request.status >= 300) {
          reject(
            new FilesApiError(messageForStatus(request.status), request.status),
          );
          return;
        }
        let payload: unknown;
        try {
          payload = JSON.parse(request.responseText);
        } catch {
          payload = null;
        }
        try {
          const result = parseFileResponse(payload, request.status);
          onProgress?.(100);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }),
    );
    request.send(file);
  });
}

/** Sube por el mismo origen. Las partes multipart se reintentan al reanudar. */
export async function uploadFile(
  file: File,
  folderId: string | null,
  onProgress?: UploadProgressListener,
  control = new UploadController(),
): Promise<FilesFileView> {
  if (file.size > MAX_SINGLE_UPLOAD_BYTES) {
    return uploadMultipartFile(file, folderId, onProgress, control);
  }

  // El endpoint simple no soporta offsets: al reanudar se reinicia
  // desde cero. Para archivos grandes, multipart conserva las partes
  // aceptadas.
  while (true) {
    if (control.paused) await control.waitUntilReady();
    if (control.cancelled) throw new UploadCancelledError();
    try {
      return await uploadSingleFile(file, folderId, onProgress, control);
    } catch (error) {
      if (control.cancelled) throw new UploadCancelledError();
      if (control.paused || error instanceof UploadPausedError) {
        await control.waitUntilReady();
        onProgress?.(0);
        continue;
      }
      throw error;
    }
  }
}
