import type {
  FilesCatalogNameRepository,
  FilesFolderRepository,
  FilesItemRecord,
  FilesItemRepository,
} from "./ports/files-repositories.js";
import {
  failure,
  success,
  toFileView,
  type CatalogResult,
  type FilesActor,
  type FilesFileView,
} from "./catalog-contracts.js";
import {
  hasValidActor,
  isValidCatalogId,
  normalizeNodeName,
} from "../domain/catalog-validation.js";
import {
  activeFolderPath,
  activeParentExists,
  nameIsAvailable,
} from "./catalog-service-utils.js";

export interface ItemCatalogDependencies {
  folders: FilesFolderRepository;
  items: FilesItemRepository;
  names: FilesCatalogNameRepository;
  now?: () => Date;
  createId?: () => string;
}
export function createItemCatalog(deps: ItemCatalogDependencies) {
  const now = deps.now ?? (() => new Date());
  async function findActive(actor: FilesActor, id: string): Promise<FilesItemRecord | null> {
    const item = await deps.items.findByIdForOwner(id, actor.userId);
    if (!item || item.deletedAt !== null) return null;
    if (item.folderId !== null && !(await activeFolderPath(deps.folders, actor.userId, item.folderId))) return null;
    return item;
  }
  async function getFileMetadata(actor: FilesActor, id: unknown) {
    if (!hasValidActor(actor) || !isValidCatalogId(id)) return failure<{ id: string; name: string }>("invalid-input");
    try {
      const item = await findActive(actor, id);
      return item ? success({ id: item.id, name: item.name }) : failure<{ id: string; name: string }>("not-found");
    } catch { return failure<{ id: string; name: string }>("unavailable"); }
  }
  async function renameFile(actor: FilesActor, id: unknown, rawName: unknown): Promise<CatalogResult<FilesFileView>> {
    if (!hasValidActor(actor) || !isValidCatalogId(id)) return failure("invalid-input");
    const name = normalizeNodeName(rawName);
    if (!name) return failure("invalid-input");
    try {
      const item = await findActive(actor, id);
      if (!item) return failure("not-found");
      if (!(await nameIsAvailable(deps.folders, deps.items, actor.userId, item.folderId, name, undefined, item.id))) return failure("duplicate-name");
      const updatedAt = now().toISOString();
      const claim = { ownerId: actor.userId, parentFolderId: item.folderId, name, nodeType: "file" as const, nodeId: item.id };
      if (!(await deps.names.set(claim))) return failure("duplicate-name");
      try {
        if (!(await deps.items.updateMetadata(item.id, actor.userId, item.folderId, name, updatedAt))) {
          await deps.names.set({ ...claim, name: item.name });
          return failure("not-found");
        }
      } catch (error) {
        await deps.names.set({ ...claim, name: item.name });
        throw error;
      }
      return success({ ...toFileView(item), name, updatedAt });
    } catch { return failure("unavailable"); }
  }
  return { getFileMetadata, renameFile };
}