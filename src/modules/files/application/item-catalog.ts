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
  parseSafeRecord,
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
  const createId = deps.createId ?? (() => crypto.randomUUID());

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

  async function createFileMetadata(
    actor: FilesActor,
    input: unknown,
  ): Promise<CatalogResult<FilesFileView>> {
    if (!hasValidActor(actor)) return failure("invalid-input");
    const value = parseSafeRecord(input, [
      "name",
      "folderId",
      "sizeBytes",
      "contentType",
    ]);
    if (!value) return failure("invalid-input");
    const name = normalizeNodeName(value.name);
    const folderId = value.folderId ?? null;
    const sizeBytes = value.sizeBytes;
    const contentType = value.contentType ?? "application/octet-stream";
    if (
      !name ||
      (folderId !== null && !isValidCatalogId(folderId)) ||
      typeof sizeBytes !== "number" ||
      !Number.isSafeInteger(sizeBytes) ||
      sizeBytes < 0 ||
      typeof contentType !== "string" ||
      contentType.length < 3 ||
      contentType.length > 255 ||
      !/^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+$/.test(contentType)
    ) {
      return failure("invalid-input");
    }
    try {
      if (!(await activeParentExists(deps.folders, actor.userId, folderId))) {
        return failure("not-found");
      }
      if (
        !(await nameIsAvailable(
          deps.folders,
          deps.items,
          actor.userId,
          folderId,
          name,
        ))
      ) {
        return failure("duplicate-name");
      }
      const id = createId();
      const timestamp = now().toISOString();
      const item: FilesItemRecord = {
        id,
        ownerId: actor.userId,
        folderId,
        storageKey: "u/" + actor.userId + "/" + id,
        name,
        contentType,
        sizeBytes,
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
      };
      const claimed = await deps.names.claim({
        ownerId: actor.userId,
        parentFolderId: folderId,
        name,
        nodeType: "file",
        nodeId: item.id,
      });
      if (!claimed) return failure("duplicate-name");
      try {
        await deps.items.insert(item);
      } catch (error) {
        await deps.names.release(actor.userId, "file", item.id);
        throw error;
      }
      return success(toFileView(item));
    } catch {
      return failure("unavailable");
    }
  }

  async function renameFile(
    actor: FilesActor,
    id: unknown,
    rawName: unknown,
  ): Promise<CatalogResult<FilesFileView>> {
    if (!hasValidActor(actor) || !isValidCatalogId(id)) {
      return failure("invalid-input");
    }
    const name = normalizeNodeName(rawName);
    if (!name) return failure("invalid-input");
    try {
      const item = await findActive(actor, id);
      if (!item) return failure("not-found");
      if (
        !(await nameIsAvailable(
          deps.folders,
          deps.items,
          actor.userId,
          item.folderId,
          name,
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
        name,
        nodeType: "file" as const,
        nodeId: item.id,
      };
      if (!(await deps.names.set(claim))) return failure("duplicate-name");
      try {
        if (
          !(await deps.items.updateMetadata(
            item.id,
            actor.userId,
            item.folderId,
            name,
            updatedAt,
          ))
        ) {
          await deps.names.set({ ...claim, name: item.name });
          return failure("not-found");
        }
      } catch (error) {
        await deps.names.set({ ...claim, name: item.name });
        throw error;
      }
      return success({ ...toFileView(item), name, updatedAt });
    } catch {
      return failure("unavailable");
    }
  }

  return { createFileMetadata, renameFile };
}
