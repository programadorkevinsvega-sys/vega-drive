import type {
  FilesFolderRecord,
  FilesItemRecord,
} from "./ports/files-repositories.js";

export interface FilesActor {
  userId: string;
}

export type CatalogFailureReason =
  | "invalid-input"
  | "not-found"
  | "duplicate-name"
  | "cycle"
  | "unavailable"
  | "too-large"
  | "quota-exceeded"
  | "rate-limited"
  | "size-mismatch";

export type CatalogResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: CatalogFailureReason };

export interface FilesFolderView {
  type: "folder";
  id: string;
  name: string;
  parentFolderId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface FilesFileView {
  type: "file";
  id: string;
  name: string;
  folderId: string | null;
  sizeBytes: number;
  contentType: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface FilesBreadcrumb {
  id: string | null;
  name: string;
}

export interface FilesFolderListing {
  folder: FilesFolderView | null;
  breadcrumbs: FilesBreadcrumb[];
  folders: FilesFolderView[];
  files: FilesFileView[];
  nextCursor: string | null;
}

export interface FilesTrashListing {
  nodes: Array<FilesFolderView | FilesFileView>;
  nextCursor: string | null;
}

export function toFolderView(record: FilesFolderRecord): FilesFolderView {
  return {
    type: "folder",
    id: record.id,
    name: record.name,
    parentFolderId: record.parentFolderId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    deletedAt: record.deletedAt,
  };
}

export function toFileView(record: FilesItemRecord): FilesFileView {
  return {
    type: "file",
    id: record.id,
    name: record.name,
    folderId: record.folderId,
    sizeBytes: record.sizeBytes,
    contentType: record.contentType,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    deletedAt: record.deletedAt,
  };
}

export function success<T>(value: T): CatalogResult<T> {
  return { ok: true, value };
}

export function failure<T = never>(
  reason: CatalogFailureReason,
): CatalogResult<T> {
  return { ok: false, reason };
}
