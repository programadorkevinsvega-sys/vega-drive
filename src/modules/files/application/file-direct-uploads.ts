import type {
  CatalogResult,
  FilesActor,
  FilesFileView,
} from "./catalog-contracts.js";
import { failure, success, toFileView } from "./catalog-contracts.js";
import type {
  FilesItemRecord,
  FilesUploadRecord,
} from "./ports/files-repositories.js";
import type {
  FilesMultipartSession,
  FilesMultipartUploadRepository,
} from "./ports/files-multipart-repository.js";
import type { FileTransferDependencies } from "./file-transfer-dependencies.js";
import {
  isValidContentType,
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

export const DIRECT_UPLOAD_MAX_BYTES = 95 * 1024 * 1024;
const DIRECT_UPLOAD_SENTINEL = "direct-put";

export interface DirectUploadStarted {
  uploadId: string;
  url: string;
  expiresInSeconds: number;
}

export function createFileDirectUploads(
  deps: FileTransferDependencies & {
    multipartUploads: FilesMultipartUploadRepository;
  },
) {
  const now = deps.now ?? (() => new Date());
  const createId = deps.createId ?? (() => crypto.randomUUID());

  async function begin(
    actor: FilesActor,
    input: unknown,
  ): Promise<CatalogResult<DirectUploadStarted>> {
    if (!hasValidActor(actor) || !deps.storage.presignPutUrl) {
      return failure("unavailable");
    }
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
      sizeBytes > DIRECT_UPLOAD_MAX_BYTES ||
      !isValidContentType(contentType)
    ) {
      return failure(
        typeof sizeBytes === "number" && sizeBytes > DIRECT_UPLOAD_MAX_BYTES
          ? "too-large"
          : "invalid-input",
      );
    }

    let reservation: FilesUploadRecord | null = null;
    let claimed = false;
    let sessionInserted = false;
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
      if (
        !(await deps.transferEvents.consume(
          createId(),
          actor.userId,
          "upload",
          createdAt,
          new Date(timestamp.getTime() - 3_600_000).toISOString(),
          UPLOADS_PER_HOUR,
        ))
      ) {
        return failure("rate-limited");
      }

      const itemId = createId();
      const reservationId = createId();
      const storageKey = "u/" + actor.userId + "/" + itemId;
      reservation = {
        id: reservationId,
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
      if (!(await deps.uploads.reserve(reservation, MAX_USER_STORAGE_BYTES))) {
        return failure("quota-exceeded");
      }

      claimed = await deps.names.claim({
        ownerId: actor.userId,
        parentFolderId: folderId,
        name,
        nodeType: "file",
        nodeId: itemId,
      });
      if (!claimed) {
        await deps.uploads.deleteByIdForOwner(reservationId, actor.userId);
        return failure("duplicate-name");
      }

      const session: FilesMultipartSession = {
        id: itemId,
        ownerId: actor.userId,
        reservationId,
        itemId,
        folderId,
        name,
        storageKey,
        r2UploadId: DIRECT_UPLOAD_SENTINEL,
        expectedSizeBytes: sizeBytes,
        contentType,
        createdAt,
        expiresAt: reservation.expiresAt,
      };
      await deps.multipartUploads.insert(session);
      sessionInserted = true;
      const url = await deps.storage.presignPutUrl(
        storageKey,
        contentType,
        sizeBytes,
        120,
      );
      if (!url) throw new Error("Direct R2 signing is not configured");
      return success({ uploadId: itemId, url, expiresInSeconds: 120 });
    } catch {
      const reservedItemId = reservation?.itemId;
      if (sessionInserted && reservedItemId) {
        await deps.multipartUploads
          .delete(reservedItemId, actor.userId)
          .catch(() => false);
      }
      if (claimed && reservedItemId) {
        await deps.names
          .release(actor.userId, "file", reservedItemId)
          .catch(() => undefined);
      }
      if (reservation) {
        await deps.uploads
          .deleteByIdForOwner(reservation.id, actor.userId)
          .catch(() => false);
      }
      return failure("unavailable");
    }
  }

  async function complete(
    actor: FilesActor,
    sessionId: string,
  ): Promise<CatalogResult<FilesFileView>> {
    if (!hasValidActor(actor) || !isValidCatalogId(sessionId)) {
      return failure("invalid-input");
    }
    try {
      const session = await deps.multipartUploads.findByIdForOwner(
        sessionId,
        actor.userId,
      );
      if (!session) {
        const existing = await deps.items.findByIdForOwner(
          sessionId,
          actor.userId,
        );
        return existing && existing.deletedAt === null
          ? success(toFileView(existing))
          : failure("not-found");
      }
      if (session.r2UploadId !== DIRECT_UPLOAD_SENTINEL) {
        return failure("invalid-input");
      }
      const reservation = await deps.uploads.findByIdForOwner(
        session.reservationId,
        actor.userId,
      );
      if (!reservation) return failure("not-found");
      if (reservation.status === "completed") {
        const existing = await deps.items.findByIdForOwner(
          session.itemId,
          actor.userId,
        );
        return existing && existing.deletedAt === null
          ? success(toFileView(existing))
          : failure("not-found");
      }
      if (reservation.status !== "pending") return failure("not-found");
      if (session.expiresAt <= now().toISOString()) {
        return failure("not-found");
      }

      const stored = await deps.storage.head(session.storageKey);
      const sizeMismatch =
        !stored || stored.sizeBytes !== session.expectedSizeBytes;
      const contentTypeMismatch =
        stored !== null && stored.contentType !== session.contentType;
      if (sizeMismatch || contentTypeMismatch) {
        try {
          await deps.storage.delete(session.storageKey);
        } catch {
          await deps.uploads.updateStatus(
            session.reservationId,
            actor.userId,
            "failed",
            null,
          );
          return failure("unavailable");
        }
        await deps.names.release(actor.userId, "file", session.itemId);
        await deps.uploads.deleteByIdForOwner(
          session.reservationId,
          actor.userId,
        );
        await deps.multipartUploads.delete(sessionId, actor.userId);
        return failure(sizeMismatch ? "size-mismatch" : "integrity-mismatch");
      }

      const timestamp = now().toISOString();
      const item: FilesItemRecord = {
        id: session.itemId,
        ownerId: actor.userId,
        folderId: session.folderId,
        storageKey: session.storageKey,
        name: session.name,
        contentType: session.contentType,
        sizeBytes: stored.sizeBytes,
        createdAt: session.createdAt,
        updatedAt: timestamp,
        deletedAt: null,
      };
      await deps.items.insert(item);
      if (
        !(await deps.uploads.updateStatus(
          session.reservationId,
          actor.userId,
          "completed",
          timestamp,
        ))
      ) {
        await deps.items
          .deletePermanently(item.id, actor.userId)
          .catch(() => false);
        throw new Error("Upload reservation could not be completed");
      }
      await deps.multipartUploads.delete(sessionId, actor.userId);
      return success(toFileView(item));
    } catch {
      return failure("unavailable");
    }
  }

  return { beginDirectUpload: begin, completeDirectUpload: complete };
}
