import type { FilesActor } from "./catalog-contracts.js";
import type { FileTransferDependencies } from "./file-transfer-dependencies.js";
import {
  DOWNLOADS_PER_HOUR,
  isValidContentType,
  parseByteRange,
} from "./transfer-contracts.js";
import {
  hasValidActor,
  isValidCatalogId,
} from "../domain/catalog-validation.js";
import { activeFolderPath } from "./catalog-service-utils.js";

export interface FilesDownload {
  name: string;
  contentType: string;
  sizeBytes: number;
  contentLength: number;
  status: 200 | 206;
  contentRange: string | null;
  body: ReadableStream<Uint8Array>;
}

export type FilesDownloadResult =
  | { ok: true; value: FilesDownload }
  | { ok: false; reason: string; totalSizeBytes?: number };

export function createFileDownload(deps: FileTransferDependencies) {
  const now = deps.now ?? (() => new Date());
  const createId = deps.createId ?? (() => crypto.randomUUID());

  return async function downloadFile(
    actor: FilesActor,
    rawId: unknown,
    rawRange: string | null,
  ): Promise<FilesDownloadResult> {
    if (!hasValidActor(actor) || !isValidCatalogId(rawId)) {
      return { ok: false, reason: "invalid-input" };
    }
    try {
      const item = await deps.items.findByIdForOwner(rawId, actor.userId);
      if (
        !item ||
        item.deletedAt !== null ||
        (item.folderId !== null &&
          !(await activeFolderPath(deps.folders, actor.userId, item.folderId)))
      )
        return { ok: false, reason: "not-found" };

      const timestamp = now();
      if (
        !(await deps.transferEvents.consume(
          createId(),
          actor.userId,
          "download",
          timestamp.toISOString(),
          new Date(timestamp.getTime() - 3600000).toISOString(),
          DOWNLOADS_PER_HOUR,
        ))
      )
        return { ok: false, reason: "rate-limited" };

      const head = await deps.storage.head(item.storageKey);
      if (!head || head.sizeBytes !== item.sizeBytes) {
        return { ok: false, reason: "unavailable" };
      }
      const range = parseByteRange(rawRange, head.sizeBytes);
      if (range === false) {
        return {
          ok: false,
          reason: "range-not-satisfiable",
          totalSizeBytes: head.sizeBytes,
        };
      }
      const stored = await deps.storage.get(
        item.storageKey,
        range ? { offset: range.offset, length: range.length } : undefined,
      );
      if (!stored || stored.sizeBytes !== head.sizeBytes) {
        return { ok: false, reason: "unavailable" };
      }
      return {
        ok: true,
        value: {
          name: item.name,
          contentType: isValidContentType(item.contentType)
            ? item.contentType
            : "application/octet-stream",
          sizeBytes: head.sizeBytes,
          contentLength: range ? range.length : head.sizeBytes,
          status: range ? 206 : 200,
          contentRange: range
            ? "bytes " + range.start + "-" + range.end + "/" + head.sizeBytes
            : null,
          body: stored.body,
        },
      };
    } catch {
      return { ok: false, reason: "unavailable" };
    }
  };
}
