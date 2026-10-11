import type {
  FilesFolderRecord,
  FilesFolderRepository,
} from "./ports/files-repositories.js";
import {
  failure,
  success,
  toFolderView,
  type CatalogResult,
  type FilesActor,
  type FilesFolderView,
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
import type { FolderCatalogDependencies } from "./folder-catalog.js";

export function createFolderMutations(deps: FolderCatalogDependencies) {
  const now = deps.now ?? (() => new Date());

  async function findActive(
    actor: FilesActor,
    id: string,
  ): Promise<FilesFolderRecord | null> {
    const path = await activeFolderPath(deps.folders, actor.userId, id);
    return path?.[0] ?? null;
  }

  async function moveFolder(
    actor: FilesActor,
    id: unknown,
    rawParentId: unknown,
  ): Promise<CatalogResult<FilesFolderView>> {
    if (!hasValidActor(actor) || !isValidCatalogId(id)) {
      return failure("invalid-input");
    }
    if (rawParentId !== null && !isValidCatalogId(rawParentId)) {
      return failure("invalid-input");
    }
    try {
      const folder = await findActive(actor, id);
      if (!folder) return failure("not-found");
      let destinationPath: FilesFolderRecord[] = [];
      if (rawParentId !== null) {
        const path = await activeFolderPath(
          deps.folders,
          actor.userId,
          rawParentId,
        );
        if (!path) return failure("not-found");
        destinationPath = path;
      }
      if (destinationPath.some((entry) => entry.id === folder.id)) {
        return failure("cycle");
      }
      if (
        !(await nameIsAvailable(
          deps.folders,
          deps.items,
          actor.userId,
          rawParentId,
          folder.name,
          folder.id,
        ))
      ) {
        return failure("duplicate-name");
      }
      const updatedAt = now().toISOString();
      const claim = {
        ownerId: actor.userId,
        parentFolderId: rawParentId,
        name: folder.name,
        nodeType: "folder" as const,
        nodeId: folder.id,
      };
      if (!(await deps.names.set(claim))) return failure("duplicate-name");
      try {
        if (
          !(await deps.folders.updateMetadata(
            folder.id,
            actor.userId,
            rawParentId,
            folder.name,
            updatedAt,
          ))
        ) {
          await deps.names.set({
            ...claim,
            parentFolderId: folder.parentFolderId,
          });
          return failure("not-found");
        }
      } catch (error) {
        await deps.names.set({
          ...claim,
          parentFolderId: folder.parentFolderId,
        });
        throw error;
      }
      return success({
        ...toFolderView(folder),
        parentFolderId: rawParentId,
        updatedAt,
      });
    } catch {
      return failure("unavailable");
    }
  }

  async function deleteFolder(
    actor: FilesActor,
    id: unknown,
  ): Promise<CatalogResult<void>> {
    if (!hasValidActor(actor) || !isValidCatalogId(id)) {
      return failure("invalid-input");
    }
    try {
      if (!(await findActive(actor, id))) return failure("not-found");
      const deletedAt = now().toISOString();
      if (!(await deps.folders.markDeleted(id, actor.userId, deletedAt))) {
        return failure("not-found");
      }
      await deps.names.release(actor.userId, "folder", id);
      return success(undefined);
    } catch {
      return failure("unavailable");
    }
  }

  async function restoreFolder(
    actor: FilesActor,
    id: unknown,
  ): Promise<CatalogResult<FilesFolderView>> {
    if (!hasValidActor(actor) || !isValidCatalogId(id)) {
      return failure("invalid-input");
    }
    try {
      const folder = await deps.folders.findByIdForOwner(id, actor.userId);
      if (!folder || !folder.deletedAt) return failure("not-found");
      if (
        !(await activeParentExists(
          deps.folders,
          actor.userId,
          folder.parentFolderId,
        ))
      ) {
        return failure("not-found");
      }
      if (
        !(await nameIsAvailable(
          deps.folders,
          deps.items,
          actor.userId,
          folder.parentFolderId,
          folder.name,
          folder.id,
        ))
      ) {
        return failure("duplicate-name");
      }
      const updatedAt = now().toISOString();
      const claim = {
        ownerId: actor.userId,
        parentFolderId: folder.parentFolderId,
        name: folder.name,
        nodeType: "folder" as const,
        nodeId: folder.id,
      };
      if (!(await deps.names.set(claim))) return failure("duplicate-name");
      try {
        if (
          !(await deps.folders.restore(
            folder.id,
            actor.userId,
            folder.deletedAt,
            updatedAt,
          ))
        ) {
          await deps.names.release(actor.userId, "folder", folder.id);
          return failure("not-found");
        }
      } catch (error) {
        await deps.names.release(actor.userId, "folder", folder.id);
        throw error;
      }
      return success({ ...toFolderView(folder), deletedAt: null, updatedAt });
    } catch {
      return failure("unavailable");
    }
  }

  return { moveFolder, deleteFolder, restoreFolder };
}
