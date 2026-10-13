import type { ModuleStatus } from "../../worker/env.js";
import { createCatalogListing } from "./application/catalog-listing.js";
import {
  createRecentActivity,
  type FilesRecentListing,
} from "./application/recent-activity.js";
import { createFolderCatalog } from "./application/folder-catalog.js";
import { createFolderMutations } from "./application/folder-mutations.js";
import { createItemCatalog } from "./application/item-catalog.js";
import { createItemMutations } from "./application/item-mutations.js";
import { createFileTransfers } from "./application/file-transfers.js";
import {
  createFileMultipartUploads,
  type MultipartStarted,
} from "./application/file-multipart-uploads.js";
import type { FilesMultipartUploadRepository } from "./application/ports/files-multipart-repository.js";
import { createTrashMutations } from "./application/trash-mutations.js";
import type { FilesDownloadResult } from "./application/file-download.js";
import type { FilesDownloadUrlResult } from "./application/file-download-url.js";
import { createFileDownloadUrl } from "./application/file-download-url.js";
import {
  createFileDirectUploads,
  type DirectUploadStarted,
} from "./application/file-direct-uploads.js";
import {
  createMultipartPartAuthorizations,
  type MultipartPartAuthorization,
} from "./application/file-multipart-direct.js";
import type { IFileStoragePort } from "./application/ports/file-storage.js";
import type {
  FilesCatalogNameRepository,
  FilesFolderRepository,
  FilesItemRepository,
  FilesTransferEventRepository,
  FilesUploadRepository,
  FilesRecentActivityRepository,
} from "./application/ports/files-repositories.js";
import type {
  CatalogResult,
  FilesActor,
  FilesFileView,
  FilesFolderListing,
  FilesFolderView,
  FilesTrashListing,
} from "./application/catalog-contracts.js";

export interface FilesPublicApi {
  status(): ModuleStatus;
  createFolder(
    actor: FilesActor,
    input: unknown,
  ): Promise<CatalogResult<FilesFolderView>>;
  renameFolder(
    actor: FilesActor,
    id: unknown,
    name: unknown,
  ): Promise<CatalogResult<FilesFolderView>>;
  moveFolder(
    actor: FilesActor,
    id: unknown,
    parentFolderId: unknown,
  ): Promise<CatalogResult<FilesFolderView>>;
  deleteFolder(actor: FilesActor, id: unknown): Promise<CatalogResult<void>>;
  restoreFolder(
    actor: FilesActor,
    id: unknown,
  ): Promise<CatalogResult<FilesFolderView>>;
  uploadFile(
    actor: FilesActor,
    input: unknown,
    body: ReadableStream<Uint8Array> | null,
  ): Promise<CatalogResult<FilesFileView>>;
  downloadFile(
    actor: FilesActor,
    id: unknown,
    range: string | null,
  ): Promise<FilesDownloadResult>;
  createDownloadUrl(
    actor: FilesActor,
    id: unknown,
  ): Promise<FilesDownloadUrlResult>;
  createPreviewUrl(
    actor: FilesActor,
    id: unknown,
  ): Promise<FilesDownloadUrlResult>;
  beginDirectUpload(
    actor: FilesActor,
    input: unknown,
  ): Promise<CatalogResult<DirectUploadStarted>>;
  completeDirectUpload(
    actor: FilesActor,
    sessionId: string,
  ): Promise<CatalogResult<FilesFileView>>;
  authorizeMultipartPart(
    actor: FilesActor,
    sessionId: string,
    partNumber: number,
  ): Promise<CatalogResult<MultipartPartAuthorization>>;
  recordMultipartPart(
    actor: FilesActor,
    sessionId: string,
    partNumber: number,
    sizeBytes: number,
    etag: string,
  ): Promise<CatalogResult<{ partNumber: number }>>;
  cleanupExpiredUploads(nowIso: string, limit: number): Promise<number>;
  beginMultipartUpload(
    actor: FilesActor,
    input: unknown,
  ): Promise<CatalogResult<MultipartStarted>>;
  uploadMultipartPart(
    actor: FilesActor,
    sessionId: string,
    partNumber: number,
    body: ReadableStream<Uint8Array> | null,
    sizeBytes: number,
  ): Promise<CatalogResult<{ partNumber: number }>>;
  completeMultipartUpload(
    actor: FilesActor,
    sessionId: string,
  ): Promise<CatalogResult<FilesFileView>>;
  abortMultipartUpload(
    actor: FilesActor,
    sessionId: string,
  ): Promise<CatalogResult<void>>;
  renameFile(
    actor: FilesActor,
    id: unknown,
    name: unknown,
  ): Promise<CatalogResult<FilesFileView>>;
  moveFile(
    actor: FilesActor,
    id: unknown,
    folderId: unknown,
  ): Promise<CatalogResult<FilesFileView>>;
  deleteFile(actor: FilesActor, id: unknown): Promise<CatalogResult<void>>;
  permanentlyDeleteFile(
    actor: FilesActor,
    id: unknown,
  ): Promise<CatalogResult<void>>;
  permanentlyDeleteFolder(
    actor: FilesActor,
    id: unknown,
  ): Promise<CatalogResult<void>>;
  emptyTrash(actor: FilesActor): Promise<CatalogResult<void>>;
  cleanupExpiredTrash(nowIso: string, limit: number): Promise<number>;
  restoreFile(
    actor: FilesActor,
    id: unknown,
  ): Promise<CatalogResult<FilesFileView>>;
  listFolder(
    actor: FilesActor,
    input: unknown,
  ): Promise<CatalogResult<FilesFolderListing>>;
  listTrash(
    actor: FilesActor,
    input: unknown,
  ): Promise<CatalogResult<FilesTrashListing>>;
  recordRecentActivity(
    actor: FilesActor,
    itemId: unknown,
    activityType: unknown,
  ): Promise<CatalogResult<{ recorded: true }>>;
  listRecent(
    actor: FilesActor,
    input: unknown,
  ): Promise<CatalogResult<FilesRecentListing>>;
}

export interface FilesModuleDependencies {
  folders: FilesFolderRepository;
  items: FilesItemRepository;
  names: FilesCatalogNameRepository;
  uploads?: FilesUploadRepository;
  transferEvents?: FilesTransferEventRepository;
  recentActivity?: FilesRecentActivityRepository;
  multipartUploads?: FilesMultipartUploadRepository;
  storage?: IFileStoragePort;
  ready?: boolean;
  now?: () => Date;
  createId?: () => string;
}

export function createFilesModule(
  deps: FilesModuleDependencies,
): FilesPublicApi {
  const folderCatalog = createFolderCatalog(deps);
  const folderMutations = createFolderMutations(deps);
  const itemCatalog = createItemCatalog(deps);
  const itemMutations = createItemMutations(deps);
  const listing = createCatalogListing(deps);
  const recent = deps.recentActivity
    ? createRecentActivity({
        folders: deps.folders,
        items: deps.items,
        recentActivity: deps.recentActivity,
        ...(deps.now ? { now: deps.now } : {}),
      })
    : null;
  const trash = deps.storage
    ? createTrashMutations({
        folders: deps.folders,
        items: deps.items,
        names: deps.names,
        storage: deps.storage,
        ...(deps.now ? { now: deps.now } : {}),
      })
    : null;
  const multipartTransfers =
    deps.uploads && deps.transferEvents && deps.multipartUploads && deps.storage
      ? createFileMultipartUploads({
          folders: deps.folders,
          items: deps.items,
          names: deps.names,
          uploads: deps.uploads,
          transferEvents: deps.transferEvents,
          multipart: deps.multipartUploads,
          storage: deps.storage,
          ...(deps.now ? { now: deps.now } : {}),
          ...(deps.createId ? { createId: deps.createId } : {}),
        })
      : null;
  const directPartAuthorizations =
    deps.multipartUploads && deps.storage
      ? createMultipartPartAuthorizations({
          multipart: deps.multipartUploads,
          storage: deps.storage,
          ...(deps.now ? { now: deps.now } : {}),
        })
      : null;
  const directUploads =
    deps.uploads && deps.transferEvents && deps.multipartUploads && deps.storage
      ? createFileDirectUploads({
          folders: deps.folders,
          items: deps.items,
          names: deps.names,
          uploads: deps.uploads,
          transferEvents: deps.transferEvents,
          multipartUploads: deps.multipartUploads,
          storage: deps.storage,
          ...(deps.now ? { now: deps.now } : {}),
          ...(deps.createId ? { createId: deps.createId } : {}),
        })
      : null;
  const downloadUrl =
    deps.uploads && deps.transferEvents && deps.storage
      ? createFileDownloadUrl({
          folders: deps.folders,
          items: deps.items,
          names: deps.names,
          uploads: deps.uploads,
          transferEvents: deps.transferEvents,
          storage: deps.storage,
          ...(deps.now ? { now: deps.now } : {}),
          ...(deps.createId ? { createId: deps.createId } : {}),
        })
      : null;
  const transfers =
    deps.uploads && deps.transferEvents && deps.storage
      ? createFileTransfers({
          folders: deps.folders,
          items: deps.items,
          names: deps.names,
          uploads: deps.uploads,
          transferEvents: deps.transferEvents,
          storage: deps.storage,
          ...(deps.multipartUploads
            ? { multipartUploads: deps.multipartUploads }
            : {}),
          ...(deps.now ? { now: deps.now } : {}),
          ...(deps.createId ? { createId: deps.createId } : {}),
        })
      : null;

  // prettier-ignore
  return {
    status: () => ({
      module: "files",
      ready: (deps.ready ?? true) && transfers !== null,
    }),
    ...folderCatalog,
    ...folderMutations,
    ...itemCatalog,
    ...itemMutations,
    ...listing,
    recordRecentActivity: (...args) => recent
      ? recent.recordRecentActivity(...args)
      : Promise.resolve({ ok: false, reason: "unavailable" }),
    listRecent: (...args) => recent
      ? recent.listRecent(...args)
      : Promise.resolve({ ok: false, reason: "unavailable" }),
    uploadFile: (...args) =>
      transfers
        ? transfers.uploadFile(...args)
        : Promise.resolve({ ok: false, reason: "unavailable" }),
    downloadFile: (...args) =>
      transfers
        ? transfers.downloadFile(...args)
        : Promise.resolve({ ok: false, reason: "unavailable" }),
    createDownloadUrl: (...args) =>
      downloadUrl
        ? downloadUrl(...args)
        : Promise.resolve({ ok: false, reason: "unavailable" }),
    createPreviewUrl: (actor, id) =>
      downloadUrl
        ? downloadUrl(actor, id, "preview")
        : Promise.resolve({ ok: false, reason: "unavailable" }),
    beginDirectUpload: (...args) =>
      directUploads
        ? directUploads.beginDirectUpload(...args)
        : Promise.resolve({ ok: false, reason: "unavailable" }),
    completeDirectUpload: (...args) =>
      directUploads
        ? directUploads.completeDirectUpload(...args)
        : Promise.resolve({ ok: false, reason: "unavailable" }),
    authorizeMultipartPart: (...args) =>
      directPartAuthorizations
        ? directPartAuthorizations.authorizeMultipartPart(...args)
        : Promise.resolve({ ok: false, reason: "unavailable" }),
    recordMultipartPart: (...args) =>
      directPartAuthorizations
        ? directPartAuthorizations.recordMultipartPart(...args)
        : Promise.resolve({ ok: false, reason: "unavailable" }),
    cleanupExpiredUploads: (nowIso, limit) =>
      transfers
        ? transfers.cleanupExpiredUploads(nowIso, limit)
        : Promise.resolve(0),
    beginMultipartUpload: (...args) => multipartTransfers
      ? multipartTransfers.beginMultipartUpload(...args)
      : Promise.resolve({ ok: false, reason: "unavailable" }),
    uploadMultipartPart: (...args) => multipartTransfers
      ? multipartTransfers.uploadMultipartPart(...args)
      : Promise.resolve({ ok: false, reason: "unavailable" }),
    completeMultipartUpload: (...args) => multipartTransfers
      ? multipartTransfers.completeMultipartUpload(...args)
      : Promise.resolve({ ok: false, reason: "unavailable" }),
    abortMultipartUpload: (...args) => multipartTransfers
      ? multipartTransfers.abortMultipartUpload(...args)
      : Promise.resolve({ ok: false, reason: "unavailable" }),
    permanentlyDeleteFile: (...args) =>
      trash
        ? trash.permanentlyDeleteFile(...args)
        : Promise.resolve({ ok: false, reason: "unavailable" }),
    permanentlyDeleteFolder: (...args) =>
      trash
        ? trash.permanentlyDeleteFolder(...args)
        : Promise.resolve({ ok: false, reason: "unavailable" }),
    emptyTrash: (...args) =>
      trash
        ? trash.emptyTrash(...args)
        : Promise.resolve({ ok: false, reason: "unavailable" }),
    cleanupExpiredTrash: (nowIso, limit) =>
      trash ? trash.cleanupExpiredTrash(nowIso, limit) : Promise.resolve(0),
  };
}
