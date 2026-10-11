import type {
  FilesFileView,
  FilesFolderListing,
  FilesFolderView,
  FilesTrashListing,
} from "./files-contract";
export type {
  FilesCatalogNode,
  FilesFileView,
  FilesFolderListing,
  FilesFolderView,
  FilesTrashListing,
} from "./files-contract";

export class FilesApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "FilesApiError";
    this.status = status;
  }
}

function messageForStatus(status: number): string {
  if (status === 0) {
    return "No se pudo conectar con Vega Drive. Comprueba tu conexión e inténtalo de nuevo.";
  }
  if (status === 400) {
    return "La solicitud no es válida. Revisa los datos e inténtalo de nuevo.";
  }
  if (status === 401) {
    return "Tu sesión ya no es válida. Inicia sesión de nuevo.";
  }
  if (status === 403) {
    return "El servidor rechazó el origen de la solicitud.";
  }
  if (status === 404) {
    return "El elemento ya no está disponible o no pertenece a esta cuenta.";
  }
  if (status === 409) {
    return "Ya existe un elemento con ese nombre o el movimiento no es válido.";
  }
  if (status === 413) {
    return "El archivo supera el tamaño máximo permitido de 95 MiB.";
  }
  if (status === 429) {
    return "Se alcanzó el límite temporal de transferencias. Inténtalo más tarde.";
  }
  if (status === 503) {
    return "El catálogo no está disponible temporalmente. Inténtalo de nuevo.";
  }
  return "No se pudo completar la operación. Inténtalo de nuevo.";
}

/** Cliente HTTP same-origin; nunca expone detalles internos del servidor. */
export async function requestJson<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(init.body && !(init.body instanceof File)
          ? { "Content-Type": "application/json" }
          : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new FilesApiError(messageForStatus(0), 0);
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new FilesApiError(messageForStatus(response.status), response.status);
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new FilesApiError(
      "El servidor devolvió una respuesta inválida.",
      response.status,
    );
  }
  return payload as T;
}

function queryString(
  values: Record<string, string | null | undefined>,
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, value);
    }
  }
  const serialized = query.toString();
  return serialized ? "?" + serialized : "";
}

function sendJson<T>(path: string, method: string, body: unknown): Promise<T> {
  return requestJson<T>(path, { method, body: JSON.stringify(body) });
}

function sendNoBody<T>(path: string, method: string): Promise<T> {
  return requestJson<T>(path, { method });
}

export function listFolder(
  folderId: string | null,
  cursor?: string,
): Promise<FilesFolderListing> {
  return requestJson<FilesFolderListing>(
    "/api/files" + queryString({ folderId, limit: "50", cursor }),
  );
}

export function listTrash(cursor?: string): Promise<FilesTrashListing> {
  return requestJson<FilesTrashListing>(
    "/api/files/trash" + queryString({ limit: "50", cursor }),
  );
}

export function downloadFileUrl(id: string): string {
  return "/api/files/" + encodeURIComponent(id) + "/download";
}

export function createFolder(
  name: string,
  parentFolderId: string | null,
): Promise<FilesFolderView> {
  return sendJson<FilesFolderView>("/api/files/folders", "POST", {
    name,
    parentFolderId,
  });
}

export function renameFolder(
  id: string,
  name: string,
): Promise<FilesFolderView> {
  return sendJson<FilesFolderView>(
    "/api/files/folders/" + encodeURIComponent(id),
    "PATCH",
    { name },
  );
}

export function moveFolder(
  id: string,
  parentFolderId: string | null,
): Promise<FilesFolderView> {
  return sendJson<FilesFolderView>(
    "/api/files/folders/" + encodeURIComponent(id) + "/move",
    "POST",
    { parentFolderId },
  );
}

export function deleteFolder(id: string): Promise<{ ok: true }> {
  return sendNoBody<{ ok: true }>(
    "/api/files/folders/" + encodeURIComponent(id),
    "DELETE",
  );
}

export function restoreFolder(id: string): Promise<FilesFolderView> {
  return sendNoBody<FilesFolderView>(
    "/api/files/trash/folders/" + encodeURIComponent(id) + "/restore",
    "POST",
  );
}

export function renameFile(id: string, name: string): Promise<FilesFileView> {
  return sendJson<FilesFileView>(
    "/api/files/items/" + encodeURIComponent(id),
    "PATCH",
    { name },
  );
}

export function moveFile(
  id: string,
  folderId: string | null,
): Promise<FilesFileView> {
  return sendJson<FilesFileView>(
    "/api/files/items/" + encodeURIComponent(id) + "/move",
    "POST",
    { folderId },
  );
}

export function deleteFile(id: string): Promise<{ ok: true }> {
  return sendNoBody<{ ok: true }>(
    "/api/files/items/" + encodeURIComponent(id),
    "DELETE",
  );
}

export function restoreFile(id: string): Promise<FilesFileView> {
  return sendNoBody<FilesFileView>(
    "/api/files/trash/items/" + encodeURIComponent(id) + "/restore",
    "POST",
  );
}
