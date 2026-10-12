import type { FilesFileView } from "./files-contract";
import { FilesApiError, messageForStatus } from "./files-api-error";
import { uploadMultipartFile } from "./files-transfer-multipart";
import { parseFileResponse } from "./files-transfer-http";
import {
  UploadCancelledError,
  UploadPausedError,
  UploadController,
  type UploadProgressListener,
} from "./files-transfer-controller";
export {
  UploadCancelledError,
  UploadController,
} from "./files-transfer-controller";
export type { UploadProgressListener } from "./files-transfer-controller";

const MAX_SINGLE_UPLOAD_BYTES = 95 * 1024 * 1024;

export function createRequest() {
  return new XMLHttpRequest();
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
