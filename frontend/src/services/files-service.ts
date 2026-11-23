import type {
  FilesFileView,
  FilesFolderListing,
  FilesFolderView,
  FilesTrashListing,
  FilesRecentListing,
  FilesFavoritesListing,
  FilesSearchListing,
} from "./files-contract";
export type {
  FilesCatalogNode,
  FilesFileView,
  FilesFolderListing,
  FilesFolderView,
  FilesTrashListing,
  FilesRecentListing,
  FilesRecentItem,
  FilesFavoriteItem,
  FilesSearchListing,
} from "./files-contract";

export { FilesApiError } from "./files-api-error";

import {
  queryString,
  requestJson,
  sendJson,
  sendNoBody,
} from "./files-http-client";
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

export function searchFiles(
  query: string,
  type: "all" | "files" | "folders" = "all",
  cursor?: string,
): Promise<FilesSearchListing> {
  return requestJson<FilesSearchListing>(
    "/api/files/search" + queryString({ q: query, type, limit: "50", cursor }),
  );
}

export function listFavorites(cursor?: string): Promise<FilesFavoritesListing> {
  return requestJson<FilesFavoritesListing>(
    "/api/files/favorites" + queryString({ limit: "50", cursor }),
  );
}

export function addFavorite(id: string): Promise<{ favorited: true }> {
  return sendNoBody<{ favorited: true }>(
    "/api/files/items/" + encodeURIComponent(id) + "/favorite",
    "POST",
  );
}

export function removeFavorite(id: string): Promise<{ favorited: false }> {
  return sendNoBody<{ favorited: false }>(
    "/api/files/items/" + encodeURIComponent(id) + "/favorite",
    "DELETE",
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

export interface FilesPreviewUrl {
  url: string;
  expiresInSeconds: number;
}
export function createFilePreviewUrl(id: string): Promise<FilesPreviewUrl> {
  return requestJson<FilesPreviewUrl>(
    "/api/files/" + encodeURIComponent(id) + "/preview",
  );
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

export interface ShareEntry {
  id: string;
  itemId: string;
  fileName: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
}
export interface CreatedShare extends ShareEntry { token: string; permission: "read"; }
export function createShare(itemId: string, expiresInSeconds: number): Promise<CreatedShare> {
  return sendJson<CreatedShare>("/api/shares", "POST", { itemId, expiresInSeconds });
}
export function listShares(): Promise<{ shares: ShareEntry[] }> {
  return requestJson<{ shares: ShareEntry[] }>("/api/shares");
}
export function revokeShare(id: string): Promise<{ revoked: true }> {
  return sendNoBody<{ revoked: true }>("/api/shares/" + encodeURIComponent(id), "DELETE");
}
