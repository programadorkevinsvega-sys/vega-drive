import type { FilesActor } from "./catalog-contracts.js";
import type { FileTransferDependencies } from "./file-transfer-dependencies.js";
import { DOWNLOADS_PER_HOUR } from "./transfer-contracts.js";
import {
  hasValidActor,
  isValidCatalogId,
} from "../domain/catalog-validation.js";
import { activeFolderPath } from "./catalog-service-utils.js";

export type FilesDownloadUrlResult =
  | { ok: true; value: { url: string; expiresInSeconds: number } }
  | { ok: false; reason: string };

export function createFileDownloadUrl(deps: FileTransferDependencies) {
  const now = deps.now ?? (() => new Date());
  const createId = deps.createId ?? (() => crypto.randomUUID());

  return async function createDownloadUrl(
    actor: FilesActor,
    rawId: unknown,
  ): Promise<FilesDownloadUrlResult> {
    if (!hasValidActor(actor) || !isValidCatalogId(rawId)) {
      return { ok: false, reason: "invalid-input" };
    }
    if (!deps.storage.presignGetUrl) {
      return { ok: false, reason: "unavailable" };
    }
    try {
      const item = await deps.items.findByIdForOwner(rawId, actor.userId);
      if (
        !item ||
        item.deletedAt !== null ||
        (item.folderId !== null &&
          !(await activeFolderPath(
            deps.folders,
            actor.userId,
            item.folderId,
          )))
      ) {
        return { ok: false, reason: "not-found" };
      }

      const timestamp = now();
      if (
        !(await deps.transferEvents.consume(
          createId(),
          actor.userId,
          "download",
          timestamp.toISOString(),
          new Date(timestamp.getTime() - 3_600_000).toISOString(),
          DOWNLOADS_PER_HOUR,
        ))
      ) {
        return { ok: false, reason: "rate-limited" };
      }

      const head = await deps.storage.head(item.storageKey);
      if (!head || head.sizeBytes !== item.sizeBytes) {
        return { ok: false, reason: "unavailable" };
      }
      const url = await deps.storage.presignGetUrl(
        item.storageKey,
        120,
        item.name,
      );
      if (!url) return { ok: false, reason: "unavailable" };
      return { ok: true, value: { url, expiresInSeconds: 120 } };
    } catch {
      return { ok: false, reason: "unavailable" };
    }
  };
}
