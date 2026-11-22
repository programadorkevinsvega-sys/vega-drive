import type {
  FilesActor,
  CatalogResult,
  FilesFileView,
} from "./catalog-contracts.js";
import { failure, success, toFileView } from "./catalog-contracts.js";
import type {
  FilesItemRecord,
  FilesUploadRecord,
} from "./ports/files-repositories.js";
import type { FileTransferDependencies } from "./file-transfer-dependencies.js";
import {
  isValidContentType,
  MAX_FILE_SIZE_BYTES,
  MAX_USER_STORAGE_BYTES,
  UPLOAD_RESERVATION_TTL_MS,
  UPLOADS_PER_HOUR,
} from "./transfer-contracts.js";
import {
  hasValidActor,
  isValidCatalogId,
  normalizeNodeName,
  parseSafeRecord,
} from "../domain/catalog-validation.js";
import {
  activeParentExists,
  nameIsAvailable,
} from "./catalog-service-utils.js";

export function createFileUpload(deps: FileTransferDependencies) {
  const now = deps.now ?? (() => new Date());
  const createId = deps.createId ?? (() => crypto.randomUUID());

  return async function uploadFile(
    actor: FilesActor,
    input: unknown,
    body: ReadableStream<Uint8Array> | null,
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
      !isValidContentType(contentType) ||
      (!body && sizeBytes !== 0)
    )
      return failure("invalid-input");
    if (sizeBytes > MAX_FILE_SIZE_BYTES) return failure("too-large");

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

      const timestamp = now();
      const createdAt = timestamp.toISOString();
      const windowStart = new Date(timestamp.getTime() - 3600000).toISOString();
      if (
        !(await deps.transferEvents.consume(
          createId(),
          actor.userId,
          "upload",
          createdAt,
          windowStart,
          UPLOADS_PER_HOUR,
        ))
      )
        return failure("rate-limited");

      const itemId = createId();
      const uploadId = createId();
      const storageKey = "u/" + actor.userId + "/" + itemId;
      const upload: FilesUploadRecord = {
        id: uploadId,
        ownerId: actor.userId,
        itemId,
        storageKey,
        expectedSizeBytes: sizeBytes,
        contentType,
        status: "pending",
        createdAt,
        expiresAt: new Date(
          timestamp.getTime() + UPLOAD_RESERVATION_TTL_MS,
        ).toISOString(),
        completedAt: null,
      };
      if (!(await deps.uploads.reserve(upload, MAX_USER_STORAGE_BYTES))) {
        return failure("quota-exceeded");
      }

      let nameClaimed = false;
      let itemInserted = false;
      let streamFailure:
        "too-large" | "size-mismatch" | "integrity-mismatch" | null = null;
      try {
        nameClaimed = await deps.names.claim({
          ownerId: actor.userId,
          parentFolderId: folderId,
          name,
          nodeType: "file",
          nodeId: itemId,
        });
        if (!nameClaimed) {
          await deps.uploads.deleteByIdForOwner(uploadId, actor.userId);
          return failure("duplicate-name");
        }

        let actualBytes = 0;
        const source =
          body ??
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.close();
            },
          });
        const guardedBody = source.pipeThrough(
          new TransformStream<Uint8Array, Uint8Array>({
            transform(chunk, controller) {
              actualBytes += chunk.byteLength;
              if (actualBytes > MAX_FILE_SIZE_BYTES) {
                streamFailure = "too-large";
                controller.error(new Error("File exceeds maximum size"));
              } else if (actualBytes > sizeBytes) {
                streamFailure = "size-mismatch";
                controller.error(new Error("Upload size mismatch"));
              } else controller.enqueue(chunk);
            },
            flush(controller) {
              if (actualBytes !== sizeBytes) {
                streamFailure = "size-mismatch";
                controller.error(new Error("Upload size mismatch"));
              }
            },
          }),
        );

        await deps.storage.put(storageKey, guardedBody, contentType, sizeBytes);
        const stored = await deps.storage.head(storageKey);
        if (
          !stored ||
          actualBytes !== sizeBytes ||
          stored.sizeBytes !== sizeBytes
        ) {
          streamFailure = "size-mismatch";
          throw new Error("Stored object size mismatch");
        }
        if (stored.contentType !== contentType) {
          streamFailure = "integrity-mismatch";
          throw new Error("Stored object metadata mismatch");
        }

        const item: FilesItemRecord = {
          id: itemId,
          ownerId: actor.userId,
          folderId,
          storageKey,
          name,
          contentType,
          sizeBytes: stored.sizeBytes,
          createdAt,
          updatedAt: now().toISOString(),
          deletedAt: null,
        };
        await deps.items.insert(item);
        itemInserted = true;
        if (
          !(await deps.uploads.updateStatus(
            uploadId,
            actor.userId,
            "completed",
            now().toISOString(),
          ))
        )
          throw new Error("Upload completion record was not updated");
        return success(toFileView(item));
      } catch (error) {
        console.error("[files] upload persistence failed", error);
        let metadataCleanupFailed = false;
        try {
          if (itemInserted)
            await deps.items.deletePermanently(itemId, actor.userId);
        } catch {
          metadataCleanupFailed = true;
        }
        let objectRemoved = false;
        if (!metadataCleanupFailed) {
          try {
            await deps.storage.delete(storageKey);
            objectRemoved = true;
          } catch {
            /* Leave a failed reservation for scheduled cleanup. */
          }
        }
        if (nameClaimed && !metadataCleanupFailed) {
          try {
            await deps.names.release(actor.userId, "file", itemId);
          } catch {
            /* Cleanup retries via the durable upload reservation. */
          }
        }
        try {
          if (objectRemoved) {
            await deps.uploads.deleteByIdForOwner(uploadId, actor.userId);
          } else {
            await deps.uploads.updateStatus(
              uploadId,
              actor.userId,
              "failed",
              null,
            );
          }
        } catch {
          /* Expiry reconciliation retries this reservation. */
        }
        return failure(streamFailure ?? "unavailable");
      }
    } catch (error) {
      console.error("[files] upload preparation failed", error);
      return failure("unavailable");
    }
  };
}
