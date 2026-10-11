import type { FileTransferDependencies } from "./file-transfer-dependencies.js";

export function createFileTransferCleanup(deps: FileTransferDependencies) {
  return async function cleanupExpiredUploads(nowIso: string, limit: number): Promise<number> {
    let cleaned = 0;
    const boundedLimit = Math.min(100, Math.max(1, Math.trunc(limit)));
    const pending = await deps.uploads.listNeedingCleanup(nowIso, boundedLimit);
    for (const upload of pending) {
      try {
        if (upload.itemId) {
          await deps.items.deletePermanently(upload.itemId, upload.ownerId);
          await deps.names.release(upload.ownerId, "file", upload.itemId);
        }
        await deps.storage.delete(upload.storageKey);
        await deps.uploads.deleteByIdForOwner(upload.id, upload.ownerId);
        cleaned += 1;
      } catch {
        // Keep pending/failed state so a later scheduled run retries cleanup.
      }
    }
    try {
      await deps.transferEvents.cleanupBefore(
        new Date(new Date(nowIso).getTime() - 48 * 60 * 60 * 1000).toISOString(),
        boundedLimit,
      );
    } catch {
      // Rate-limit cleanup is opportunistic and does not authorize a transfer.
    }
    return cleaned;
  };
}
