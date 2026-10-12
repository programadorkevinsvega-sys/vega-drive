import type { FileTransferDependencies } from "./file-transfer-dependencies.js";

export function createFileTransferCleanup(deps: FileTransferDependencies) {
  return async function cleanupExpiredUploads(
    nowIso: string,
    limit: number,
  ): Promise<number> {
    let cleaned = 0;
    const boundedLimit = Math.min(100, Math.max(1, Math.trunc(limit)));
    if (deps.multipartUploads) {
      const expiredSessions = await deps.multipartUploads.listExpired(
        nowIso,
        boundedLimit,
      );
      for (const session of expiredSessions) {
        try {
          const reservation = await deps.uploads.findByIdForOwner(
            session.reservationId,
            session.ownerId,
          );
          if (reservation?.status === "completed") {
            await deps.multipartUploads.delete(session.id, session.ownerId);
            cleaned += 1;
            continue;
          }
          if (session.r2UploadId !== "direct-put") {
            if (!deps.storage.abortMultipartUpload) {
              throw new Error("R2 multipart abort is unavailable");
            }
            await deps.storage.abortMultipartUpload(
              session.storageKey,
              session.r2UploadId,
            );
          }
          await deps.storage.delete(session.storageKey);
          await deps.names.release(session.ownerId, "file", session.itemId);
          await deps.uploads.deleteByIdForOwner(
            session.reservationId,
            session.ownerId,
          );
          await deps.multipartUploads.delete(session.id, session.ownerId);
          cleaned += 1;
        } catch {
          // Keep the durable session so a later scheduled run can retry cleanup.
        }
      }
    }
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
        new Date(
          new Date(nowIso).getTime() - 48 * 60 * 60 * 1000,
        ).toISOString(),
        boundedLimit,
      );
    } catch {
      // Rate-limit cleanup is opportunistic and does not authorize a transfer.
    }
    return cleaned;
  };
}
