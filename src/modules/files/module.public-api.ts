import type { ModuleStatus } from "../../worker/env.js";
import { createCatalogListing } from "./application/catalog-listing.js";
import { createFolderCatalog } from "./application/folder-catalog.js";
import { createFolderMutations } from "./application/folder-mutations.js";
import { createItemCatalog } from "./application/item-catalog.js";
import { createItemMutations } from "./application/item-mutations.js";
import type {
  FilesCatalogNameRepository,
  FilesFolderRepository,
  FilesItemRepository,
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
  createFileMetadata(
    actor: FilesActor,
    input: unknown,
  ): Promise<CatalogResult<FilesFileView>>;
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
}

export interface FilesModuleDependencies {
  folders: FilesFolderRepository;
  items: FilesItemRepository;
  names: FilesCatalogNameRepository;
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
  return {
    status: () => ({ module: "files", ready: deps.ready ?? true }),
    ...folderCatalog,
    ...folderMutations,
    ...itemCatalog,
    ...itemMutations,
    ...listing,
  };
}
