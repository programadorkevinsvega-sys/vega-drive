import type { FilesFileView } from "./files-contract";
import { FilesApiError, requestJson } from "./files-service";

const MAX_FILE_SIZE_BYTES = 95 * 1024 * 1024;

/** Sube bytes al Worker same-origin; el servidor sigue siendo autoridad de tamaño y permisos. */
export async function uploadFile(
  file: File,
  folderId: string | null,
): Promise<FilesFileView> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new FilesApiError(
      "El archivo supera el tamaño máximo permitido de 95 MiB.",
      413,
    );
  }

  const payload = await requestJson<unknown>("/api/files", {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "X-File-Name": encodeURIComponent(file.name),
      "X-File-Size": String(file.size),
      ...(folderId ? { "X-File-Folder-Id": folderId } : {}),
    },
    body: file,
  });

  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    (payload as { type?: unknown }).type !== "file" ||
    typeof (payload as { id?: unknown }).id !== "string"
  ) {
    throw new FilesApiError(
      "El servidor devolvió una respuesta de archivo inválida.",
      200,
    );
  }
  return payload as FilesFileView;
}
