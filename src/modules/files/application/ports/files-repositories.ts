export interface FilesCatalogCursor {
  name: string;
  type: "folder" | "file";
  id: string;
}

export interface FilesTrashCursor {
  deletedAt: string;
  type: "folder" | "file";
  id: string;
}

/** Owner IDs must come from the server-validated actor, never request input. */
export interface FilesItemRecord {
  id: string;
  ownerId: string;
  folderId: string | null;
  storageKey: string;
  name: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface FilesItemRepository {
  findByIdForOwner(
    id: string,
    ownerId: string,
  ): Promise<FilesItemRecord | null>;
  findActiveByName(
    ownerId: string,
    folderId: string | null,
    name: string,
    exceptId?: string,
  ): Promise<boolean>;
  listByOwnerAndFolder(
    ownerId: string,
    folderId: string | null,
    limit: number,
    cursor?: FilesCatalogCursor | null,
  ): Promise<FilesItemRecord[]>;
  listTrashByOwner(
    ownerId: string,
    limit: number,
    cursor?: FilesTrashCursor | null,
  ): Promise<FilesItemRecord[]>;
  insert(item: FilesItemRecord): Promise<void>;
  deletePermanently(id: string, ownerId: string): Promise<boolean>;
  listExpiredTrash?(cutoff: string, limit: number): Promise<FilesItemRecord[]>;
  listByFolderIds?(ownerId: string, folderIds: string[], limit: number): Promise<FilesItemRecord[]>;
  updateMetadata(
    id: string,
    ownerId: string,
    folderId: string | null,
    name: string,
    updatedAt: string,
  ): Promise<boolean>;
  markDeleted(id: string, ownerId: string, deletedAt: string): Promise<boolean>;
  restore(
    id: string,
    ownerId: string,
    expectedDeletedAt: string,
    updatedAt: string,
  ): Promise<boolean>;
}

export interface FilesFolderRecord {
  id: string;
  ownerId: string;
  parentFolderId: string | null;
  name: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface FilesFolderRepository {
  findByIdForOwner(
    id: string,
    ownerId: string,
  ): Promise<FilesFolderRecord | null>;
  findActiveByName(
    ownerId: string,
    parentFolderId: string | null,
    name: string,
    exceptId?: string,
  ): Promise<boolean>;
  listChildren(
    ownerId: string,
    parentFolderId: string | null,
    limit: number,
    cursor?: FilesCatalogCursor | null,
  ): Promise<FilesFolderRecord[]>;
  listTrashByOwner(
    ownerId: string,
    limit: number,
    cursor?: FilesTrashCursor | null,
  ): Promise<FilesFolderRecord[]>;
  insert(folder: FilesFolderRecord): Promise<void>;
  deletePermanently?(id: string, ownerId: string): Promise<boolean>;
  listExpiredTrash?(cutoff: string, limit: number): Promise<FilesFolderRecord[]>;
  listDescendants?(ownerId: string, parentFolderId: string): Promise<FilesFolderRecord[]>;
  updateMetadata(
    id: string,
    ownerId: string,
    parentFolderId: string | null,
    name: string,
    updatedAt: string,
  ): Promise<boolean>;
  markDeleted(id: string, ownerId: string, deletedAt: string): Promise<boolean>;
  restore(
    id: string,
    ownerId: string,
    expectedDeletedAt: string,
    updatedAt: string,
  ): Promise<boolean>;
}

export type FilesUploadStatus = "pending" | "completed" | "failed" | "expired";

export type FilesTransferKind = "upload" | "download";

export interface FilesUploadRecord {
  id: string;
  ownerId: string;
  itemId: string | null;
  storageKey: string;
  expectedSizeBytes: number;
  contentType: string;
  status: FilesUploadStatus;
  createdAt: string;
  expiresAt: string;
  completedAt: string | null;
}

export interface FilesUploadRepository {
  reserve(
    upload: FilesUploadRecord,
    maxUserStorageBytes: number,
  ): Promise<boolean>;
  listNeedingCleanup(now: string, limit: number): Promise<FilesUploadRecord[]>;
  deleteByIdForOwner(id: string, ownerId: string): Promise<boolean>;
  findByIdForOwner(
    id: string,
    ownerId: string,
  ): Promise<FilesUploadRecord | null>;
  insert(upload: FilesUploadRecord): Promise<void>;
  updateStatus(
    id: string,
    ownerId: string,
    status: FilesUploadStatus,
    completedAt: string | null,
  ): Promise<boolean>;
}

export interface FilesTransferEventRepository {
  consume(
    id: string,
    ownerId: string,
    kind: FilesTransferKind,
    occurredAt: string,
    windowStart: string,
    limit: number,
  ): Promise<boolean>;
  cleanupBefore(cutoff: string, limit: number): Promise<void>;
}

export interface FilesOutboxRecord {
  id: string;
  eventType: string;
  payloadJson: string;
  createdAt: string;
  publishedAt: string | null;
}

export interface FilesOutboxRepository {
  append(event: FilesOutboxRecord): Promise<void>;
  listUnpublished(limit: number): Promise<FilesOutboxRecord[]>;
  markPublished(id: string, publishedAt: string): Promise<boolean>;
}

export type FilesCatalogNodeType = "folder" | "file";

export interface FilesCatalogNameClaim {
  ownerId: string;
  parentFolderId: string | null;
  name: string;
  nodeType: FilesCatalogNodeType;
  nodeId: string;
}

export interface FilesCatalogNameRepository {
  claim(input: FilesCatalogNameClaim): Promise<boolean>;
  set(input: FilesCatalogNameClaim): Promise<boolean>;
  release(
    ownerId: string,
    nodeType: FilesCatalogNodeType,
    nodeId: string,
  ): Promise<void>;
}
