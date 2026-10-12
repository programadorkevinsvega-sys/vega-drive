import type { FilesFileView } from "./files-contract";
import { FilesApiError, messageForStatus } from "./files-api-error";

const MAX_SINGLE_UPLOAD_BYTES = 95 * 1024 * 1024;
const MULTIPART_PART_BYTES = 16 * 1024 * 1024;

export type UploadProgressListener = (percentage: number) => void;

interface MultipartStart {
  uploadId: string;
  partSizeBytes: number;
  totalParts: number;
}

function createRequest() {
  return new XMLHttpRequest();
}

// prettier-ignore
function parseFileResponse(value: unknown, status: number): FilesFileView {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
    (value as { type?: unknown }).type !== "file" ||
    typeof (value as { id?: unknown }).id !== "string") {
    throw new FilesApiError("El servidor devolvió una respuesta de archivo inválida.", status);
  }
  return value as FilesFileView;
}

// prettier-ignore
function requestJson<T>(
  method: string, url: string, body: Blob | string | null,
  headers: Record<string, string> = {}, onProgress?: (loaded: number) => void,
  totalBytes = 0,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = createRequest();
    request.open(method, url, true);
    request.setRequestHeader("Accept", "application/json");
    request.setRequestHeader("Cache-Control", "no-store");
    for (const [name, value] of Object.entries(headers)) request.setRequestHeader(name, value);
    if (onProgress) request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(Math.min(event.loaded, totalBytes));
    });
    request.addEventListener("error", () => reject(new FilesApiError(messageForStatus(0), 0)));
    request.addEventListener("abort", () => reject(new FilesApiError(messageForStatus(0), 0)));
    request.addEventListener("load", () => {
      if (request.status < 200 || request.status >= 300) {
        reject(new FilesApiError(messageForStatus(request.status), request.status));
        return;
      }
      try { resolve(JSON.parse(request.responseText) as T); }
      catch { reject(new FilesApiError("El servidor devolvió una respuesta inválida.", request.status)); }
    });
    request.send(body);
  });
}

/** Las transferencias grandes se dividen en fragmentos autenticados de 16 MiB. */
// prettier-ignore
async function uploadMultipartFile(
  file: File, folderId: string | null, onProgress?: UploadProgressListener,
): Promise<FilesFileView> {
  const started = await requestJson<MultipartStart>("POST", "/api/files/multipart", JSON.stringify({
    name: file.name, folderId, sizeBytes: file.size,
    contentType: file.type || "application/octet-stream",
  }), { "Content-Type": "application/json" });
  if (!started || typeof started.uploadId !== "string" ||
    started.partSizeBytes !== MULTIPART_PART_BYTES ||
    !Number.isSafeInteger(started.totalParts) || started.totalParts < 2) {
    throw new FilesApiError("El servidor devolvió una sesión de subida inválida.", 500);
  }

  try {
    for (let index = 0; index < started.totalParts; index += 1) {
      const start = index * started.partSizeBytes;
      const chunk = file.slice(start, Math.min(start + started.partSizeBytes, file.size));
      const partNumber = index + 1;
      await requestJson<{ partNumber: number }>(
        "PUT", "/api/files/multipart/" + encodeURIComponent(started.uploadId) + "/parts/" + partNumber,
        chunk, { "Content-Type": "application/octet-stream", "X-Part-Size": String(chunk.size) },
        (loaded) => onProgress?.(Math.min(99, Math.floor(((start + loaded) / file.size) * 100))),
        chunk.size,
      );
    }
    const result = await requestJson<unknown>(
      "POST", "/api/files/multipart/" + encodeURIComponent(started.uploadId) + "/complete", null,
    );
    const uploadedFile = parseFileResponse(result, 201);
    onProgress?.(100);
    return uploadedFile;
  } catch (error) {
    try {
      await requestJson("POST", "/api/files/multipart/" + encodeURIComponent(started.uploadId) + "/abort", null);
    } catch {
      // The server's expiry cleanup handles a session that cannot be aborted here.
    }
    throw error;
  }
}

/** Sube bytes al Worker same-origin y expone el progreso real del navegador. */
// prettier-ignore
export function uploadFile(
  file: File, folderId: string | null, onProgress?: UploadProgressListener,
): Promise<FilesFileView> {
  if (file.size > MAX_SINGLE_UPLOAD_BYTES) return uploadMultipartFile(file, folderId, onProgress);
  return new Promise((resolve, reject) => {
    const request = createRequest();
    // Keep the small-file route explicit; all requests remain same-origin.
    request.open("POST", "/api/files", true);
    request.setRequestHeader("Accept", "application/json");
    request.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    request.setRequestHeader("Cache-Control", "no-store");
    request.setRequestHeader("X-File-Name", encodeURIComponent(file.name));
    request.setRequestHeader("X-File-Size", String(file.size));
    if (folderId) request.setRequestHeader("X-File-Folder-Id", folderId);
    request.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable || file.size === 0) return;
      onProgress?.(Math.min(99, Math.floor((event.loaded / event.total) * 100)));
    });
    request.addEventListener("error", () => reject(new FilesApiError(messageForStatus(0), 0)));
    request.addEventListener("abort", () => reject(new FilesApiError(messageForStatus(0), 0)));
    request.addEventListener("load", () => {
      if (request.status < 200 || request.status >= 300) {
        reject(new FilesApiError(messageForStatus(request.status), request.status));
        return;
      }
      let payload: unknown;
      try { payload = JSON.parse(request.responseText); } catch { payload = null; }
      try {
        const result = parseFileResponse(payload, request.status);
        onProgress?.(100);
        resolve(result);
      } catch (error) { reject(error); }
    });
    request.send(file);
  });
}
