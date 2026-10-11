import type {
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
} from "../domain/catalog-validation.js";
import {
  activeFolderPath,
  activeParentExists,
  nameIsAvailable,
} from "./catalog-service-utils.js";
import type { ItemCatalogDependencies } from "./item-catalog.js";

export function createItemMutations(deps: ItemCatalogDependencies) {
  const now = deps.now ?? (() => new Date());

  async function findActive(
    actor: FilesActor,
    id: string,
  ): Promise<FilesItemRecord | null> {
    const item = await deps.items.findByIdForOwner(id, actor.userId);
    if (!item || item.deletedAt !== null) return null;
    if (
      item.folderId !== null &&
      !(await activeFolderPath(deps.folders, actor.userId, item.folderId))
    ) {
      return null;
    }
    return item;
  }

  async function moveFile(
    actor: FilesActor,
    id: unknown,
    rawFolderId: unknown,
  ): Promise<CatalogResult<FilesFileView>> {
    if (!hasValidActor(actor) || !isValidCatalogId(id)) {
      return failure("invalid-input");
    }
    if (rawFolderId !== null && !isValidCatalogId(rawFolderId)) {
      return failure("invalid-input");
    }
    try {
      const item = await findActive(actor, id);
      if (!item) return failure("not-found");
      if (
        !(await activeParentExists(deps.folders, actor.userId, rawFolderId))
      ) {
        return failure("not-found");
      }
      if (
        !(await nameIsAvailable(
          deps.folders,
          deps.items,
          actor.userId,
          rawFolderId,
          item.name,
          undefined,
          item.id,
        ))
      ) {
        return failure("duplicate-name");
      }
      const updatedAt = now().toISOString();
      const claim = {
        ownerId: actor.userId,
        parentFolderId: rawFolderId,
        name: item.name,
        nodeType: "file" as const,
        nodeId: item.id,
      };
      if (!(await deps.names.set(claim))) return failure("duplicate-name");
      try {
        if (
          !(await deps.items.updateMetadata(
            item.id,
            actor.userId,
            rawFolderId,
            item.name,
            updatedAt,
          ))
        ) {
          await deps.names.set({
            ...claim,
            parentFolderId: item.folderId,
          });
          return failure("not-found");
        }
      } catch (error) {
        await deps.names.set({
          ...claim,
          parentFolderId: item.folderId,
        });
        throw error;
      }
      return success({ ...toFileView(item), folderId: rawFolderId, updatedAt });
    } catch {
      return failure("unavailable");
    }
  }

  async function deleteFile(
    actor: FilesActor,
    id: unknown,
  ): Promise<CatalogResult<void>> {
    if (!hasValidActor(actor) || !isValidCatalogId(id)) {
      return failure("invalid-input");
    }
    try {
      if (!(await findActive(actor, id))) return failure("not-found");
      const deletedAt = now().toISOString();
      if (!(await deps.items.markDeleted(id, actor.userId, deletedAt))) {
        return failure("not-found");
      }
      await deps.names.release(actor.userId, "file", id);
      return success(undefined);
    } catch {
      return failure("unavailable");
    }
  }

  async function restoreFile(
    actor: FilesActor,
    id: unknown,
  ): Promise<CatalogResult<FilesFileView>> {
    if (!hasValidActor(actor) || !isValidCatalogId(id)) {
      return failure("invalid-input");
    }
    try {
      const item = await deps.items.findByIdForOwner(id, actor.userId);
      if (!item || !item.deletedAt) return failure("not-found");
      if (
        !(await activeParentExists(deps.folders, actor.userId, item.folderId))
      ) {
        return failure("not-found");
      }
      if (
        !(await nameIsAvailable(
          deps.folders,
          deps.items,
          actor.userId,
          item.folderId,
          item.name,
          undefined,
          item.id,
        ))
      ) {
        return failure("duplicate-name");
      }
      const updatedAt = now().toISOString();
      const claim = {
        ownerId: actor.userId,
        parentFolderId: item.folderId,
        name: item.name,
        nodeType: "file" as const,
        nodeId: item.id,
      };
      if (!(await deps.names.set(claim))) return failure("duplicate-name");
      try {
        if (
          !(await deps.items.restore(
            item.id,
            actor.userId,
            item.deletedAt,
            updatedAt,
          ))
        ) {
          await deps.names.release(actor.userId, "file", item.id);
          return failure("not-found");
        }
      } catch (error) {
        await deps.names.release(actor.userId, "file", item.id);
        throw error;
      }
      return success({ ...toFileView(item), deletedAt: null, updatedAt });
    } catch {
      return failure("unavailable");
    }
  }

  return { moveFile, deleteFile, restoreFile };
}
