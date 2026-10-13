import type {
  FilesFileView,
  FilesFolderListing,
  FilesFolderView,
  FilesTrashListing,
  FilesRecentListing,
} from "./files-contract";
export type {
  FilesCatalogNode,
  FilesFileView,
  FilesFolderListing,
  FilesFolderView,
  FilesTrashListing,
  FilesRecentListing,
  FilesRecentItem,
} from "./files-contract";

export { FilesApiError } from "./files-api-error";

import { queryString, requestJson, sendJson, sendNoBody } from "./files-http-client";
export { requestJson } from "./files-http-client";

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

export function listRecent(cursor?: string): Promise<FilesRecentListing> {
  return requestJson<FilesRecentListing>(
    "/api/files/recent" + queryString({ limit: "50", cursor }),
  );
}

export function recordFileOpen(id: string): Promise<{ recorded: true }> {
  return sendNoBody<{ recorded: true }>(
    "/api/files/items/" + encodeURIComponent(id) + "/open",
    "POST",
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

export function deleteFolderPermanently(id: string): Promise<{ ok: true }> {
  return sendNoBody<{ ok: true }>(
    "/api/files/folders/" + encodeURIComponent(id) + "/permanent-delete",
    "POST",
  );
}

export function emptyTrash(): Promise<{ ok: true }> {
  return sendNoBody<{ ok: true }>("/api/files/trash/empty", "POST");
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

export function deleteFilePermanently(id: string): Promise<{ ok: true }> {
  return sendNoBody<{ ok: true }>(
    "/api/files/items/" + encodeURIComponent(id) + "/permanent-delete",
    "POST",
  );
}

export function restoreFile(id: string): Promise<FilesFileView> {
  return sendNoBody<FilesFileView>(
    "/api/files/trash/items/" + encodeURIComponent(id) + "/restore",
    "POST",
  );
}
