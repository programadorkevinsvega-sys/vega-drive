import type { FilesFileView } from "./files-contract";
import { FilesApiError, messageForStatus } from "./files-api-error";
import {
  UploadCancelledError,
  UploadPausedError,
  UploadController,
} from "./files-transfer-controller";

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
