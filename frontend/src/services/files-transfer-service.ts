import type { FilesFileView } from "./files-contract";
import { FilesApiError, messageForStatus } from "./files-api-error";

const MAX_FILE_SIZE_BYTES = 95 * 1024 * 1024;

export type UploadProgressListener = (percentage: number) => void;

/** Sube bytes al Worker same-origin y expone el progreso real del navegador. */
export function uploadFile(
  file: File,
  folderId: string | null,
  onProgress?: UploadProgressListener,
): Promise<FilesFileView> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return Promise.reject(
      new FilesApiError(
        "El archivo supera el tamaño máximo permitido de 95 MiB.",
        413,
      ),
    );
  }

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", "/api/files", true);
    request.setRequestHeader("Accept", "application/json");
    request.setRequestHeader(
      "Content-Type",
      file.type || "application/octet-stream",
    );
    request.setRequestHeader("Cache-Control", "no-store");
    request.setRequestHeader("X-File-Name", encodeURIComponent(file.name));
    request.setRequestHeader("X-File-Size", String(file.size));
    if (folderId) {
      request.setRequestHeader("X-File-Folder-Id", folderId);
    }

    request.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable || file.size === 0) return;
      // El 100 % se reserva para la respuesta satisfactoria del servidor.
      const percentage = Math.min(
        99,
        Math.floor((event.loaded / event.total) * 100),
      );
      onProgress?.(percentage);
    });

    request.addEventListener("error", () => {
      reject(new FilesApiError(messageForStatus(0), 0));
    });
    request.addEventListener("abort", () => {
      reject(new FilesApiError(messageForStatus(0), 0));
    });
    request.addEventListener("load", () => {
      if (request.status < 200 || request.status >= 300) {
        reject(new FilesApiError(messageForStatus(request.status), request.status));
        return;
      }

      let payload: unknown;
      try {
        payload = JSON.parse(request.responseText);
      } catch {
        payload = null;
      }

      if (
        !payload ||
        typeof payload !== "object" ||
        Array.isArray(payload) ||
        (payload as { type?: unknown }).type !== "file" ||
        typeof (payload as { id?: unknown }).id !== "string"
      ) {
        reject(
          new FilesApiError(
            "El servidor devolvió una respuesta de archivo inválida.",
            request.status,
          ),
        );
        return;
      }

      onProgress?.(100);
      resolve(payload as FilesFileView);
    });

    request.send(file);
  });
}
