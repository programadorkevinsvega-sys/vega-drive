import type {
  FilesCatalogNameRepository,
  FilesFolderRecord,
  FilesFolderRepository,
  FilesItemRepository,
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
  normalizeNodeName,
  parseSafeRecord,
} from "../domain/catalog-validation.js";
import {
  activeFolderPath,
  activeParentExists,
  nameIsAvailable,
} from "./catalog-service-utils.js";

export interface FolderCatalogDependencies {
  folders: FilesFolderRepository;
  items: FilesItemRepository;
  names: FilesCatalogNameRepository;
  now?: () => Date;
  createId?: () => string;
}

export function createFolderCatalog(deps: FolderCatalogDependencies) {
  const now = deps.now ?? (() => new Date());
  const createId = deps.createId ?? (() => crypto.randomUUID());

  async function findActive(
    actor: FilesActor,
    id: string,
  ): Promise<FilesFolderRecord | null> {
    const path = await activeFolderPath(deps.folders, actor.userId, id);
    return path?.[0] ?? null;
  }

  async function createFolder(
    actor: FilesActor,
    input: unknown,
  ): Promise<CatalogResult<FilesFolderView>> {
    if (!hasValidActor(actor)) return failure("invalid-input");
    const value = parseSafeRecord(input, ["name", "parentFolderId"]);
    if (!value) return failure("invalid-input");
    const name = normalizeNodeName(value.name);
    const parentId = value.parentFolderId ?? null;
    if (!name || (parentId !== null && !isValidCatalogId(parentId))) {
      return failure("invalid-input");
    }
    try {
      if (!(await activeParentExists(deps.folders, actor.userId, parentId))) {
        return failure("not-found");
      }
      if (
        !(await nameIsAvailable(
          deps.folders,
          deps.items,
          actor.userId,
          parentId,
          name,
        ))
      ) {
        return failure("duplicate-name");
      }
      const timestamp = now().toISOString();
      const folder: FilesFolderRecord = {
        id: createId(),
        ownerId: actor.userId,
        parentFolderId: parentId,
        name,
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
      };
      const claimed = await deps.names.claim({
        ownerId: actor.userId,
        parentFolderId: parentId,
        name,
        nodeType: "folder",
        nodeId: folder.id,
      });
      if (!claimed) return failure("duplicate-name");
      try {
        await deps.folders.insert(folder);
      } catch (error) {
        await deps.names.release(actor.userId, "folder", folder.id);
        throw error;
      }
      return success(toFolderView(folder));
    } catch {
      return failure("unavailable");
    }
  }

  async function renameFolder(
    actor: FilesActor,
    id: unknown,
    rawName: unknown,
  ): Promise<CatalogResult<FilesFolderView>> {
    if (!hasValidActor(actor) || !isValidCatalogId(id)) {
      return failure("invalid-input");
    }
    const name = normalizeNodeName(rawName);
    if (!name) return failure("invalid-input");
    try {
      const folder = await findActive(actor, id);
      if (!folder) return failure("not-found");
      if (
        !(await nameIsAvailable(
          deps.folders,
          deps.items,
          actor.userId,
          folder.parentFolderId,
          name,
          folder.id,
        ))
      ) {
        return failure("duplicate-name");
      }
      const updatedAt = now().toISOString();
      const claim = {
        ownerId: actor.userId,
        parentFolderId: folder.parentFolderId,
        name,
        nodeType: "folder" as const,
        nodeId: folder.id,
      };
      if (!(await deps.names.set(claim))) return failure("duplicate-name");
      try {
        if (
          !(await deps.folders.updateMetadata(
            folder.id,
            actor.userId,
            folder.parentFolderId,
            name,
            updatedAt,
          ))
        ) {
          await deps.names.set({
            ...claim,
            name: folder.name,
          });
          return failure("not-found");
        }
      } catch (error) {
        await deps.names.set({ ...claim, name: folder.name });
        throw error;
      }
      return success({ ...toFolderView(folder), name, updatedAt });
    } catch {
      return failure("unavailable");
    }
  }

  return { createFolder, renameFolder };
}
