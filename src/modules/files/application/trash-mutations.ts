import {
  failure,
  success,
  type CatalogResult,
  type FilesActor,
} from "./catalog-contracts.js";
import {
  hasValidActor,
  isValidCatalogId,
} from "../domain/catalog-validation.js";
import type {
  FilesCatalogNameRepository,
  FilesFolderRepository,
  FilesItemRepository,
} from "./ports/files-repositories.js";
import type { IFileStoragePort } from "./ports/file-storage.js";

interface TrashMutationDependencies {
  folders: FilesFolderRepository;
  items: FilesItemRepository;
  names: FilesCatalogNameRepository;
  storage: IFileStoragePort;
  now?: () => Date;
}

export function createTrashMutations(deps: TrashMutationDependencies) {
  async function permanentlyDeleteFile(
    actor: FilesActor,
    id: unknown,
  ): Promise<CatalogResult<void>> {
    if (!hasValidActor(actor) || !isValidCatalogId(id)) {
      return failure("invalid-input");
    }
    try {
      const item = await deps.items.findByIdForOwner(id, actor.userId);
      if (!item) return failure("not-found");
      await deps.storage.delete(item.storageKey);
      if (!(await deps.items.deletePermanently(item.id, actor.userId))) {
        return failure("unavailable");
      }
      await deps.names.release(actor.userId, "file", item.id);
      return success(undefined);
    } catch {
      return failure("unavailable");
    }
  }

  async function permanentlyDeleteFolder(
    actor: FilesActor,
    id: unknown,
  ): Promise<CatalogResult<void>> {
    if (!hasValidActor(actor) || !isValidCatalogId(id)) {
      return failure("invalid-input");
    }
    try {
      const root = await deps.folders.findByIdForOwner(id, actor.userId);
      if (!root) return failure("not-found");
      if (
        !deps.folders.listDescendants ||
        !deps.items.listByFolderIds ||
        !deps.folders.deletePermanently
      ) {
        return failure("unavailable");
      }

      // Deactivate first so concurrent uploads or moves cannot add new children.
      if (root.deletedAt === null) {
        const now = (deps.now ?? (() => new Date()))().toISOString();
        if (!(await deps.folders.markDeleted(root.id, actor.userId, now))) {
          return failure("not-found");
        }
        await deps.names.release(actor.userId, "folder", root.id);
      }

      const descendants = await deps.folders.listDescendants(
        actor.userId,
        root.id,
      );
      const folderIds = [root.id, ...descendants.map((folder) => folder.id)];
      while (true) {
        const batch = await deps.items.listByFolderIds(
          actor.userId,
          folderIds,
          100,
        );
        if (batch.length === 0) break;
        for (const item of batch) {
          await deps.storage.delete(item.storageKey);
          if (!(await deps.items.deletePermanently(item.id, actor.userId))) {
            return failure("unavailable");
          }
          await deps.names.release(actor.userId, "file", item.id);
        }
      }

      for (const folder of [...descendants, root]) {
        if (!(await deps.folders.deletePermanently(folder.id, actor.userId))) {
          return failure("unavailable");
        }
        await deps.names.release(actor.userId, "folder", folder.id);
      }
      return success(undefined);
    } catch {
      return failure("unavailable");
    }
  }

  async function cleanupExpiredTrash(
    nowIso: string,
    limit: number,
  ): Promise<number> {
    if (!deps.folders.listExpiredTrash || !deps.items.listExpiredTrash) {
      return 0;
    }
    const clock = deps.now ?? (() => new Date(nowIso));
    const cutoff = new Date(
      clock().getTime() - 30 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const boundedLimit = Math.min(100, Math.max(1, Math.trunc(limit)));
    let cleaned = 0;

    const folders = await deps.folders.listExpiredTrash(cutoff, boundedLimit);
    for (const folder of folders) {
      const result = await permanentlyDeleteFolder(
        { userId: folder.ownerId },
        folder.id,
      );
      if (result.ok) cleaned += 1;
    }

    const items = await deps.items.listExpiredTrash(cutoff, boundedLimit);
    for (const item of items) {
      const result = await permanentlyDeleteFile(
        { userId: item.ownerId },
        item.id,
      );
      if (result.ok) cleaned += 1;
    }
    return cleaned;
  }

  return { permanentlyDeleteFile, permanentlyDeleteFolder, cleanupExpiredTrash };
}
