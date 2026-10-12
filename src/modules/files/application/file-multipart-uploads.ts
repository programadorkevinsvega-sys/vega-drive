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
import type {
  FileStorageMultipartPart,
  IFileStoragePort,
} from "./ports/file-storage.js";
import type {
  FilesCatalogNameRepository,
  FilesFolderRepository,
  FilesItemRepository,
  FilesTransferEventRepository,
  FilesUploadRepository,
} from "./ports/files-repositories.js";
import {
  activeParentExists,
  nameIsAvailable,
} from "./catalog-service-utils.js";
import {
  hasValidActor,
  isValidCatalogId,
  normalizeNodeName,
  parseSafeRecord,
} from "../domain/catalog-validation.js";
import {
  isValidContentType,
  MAX_USER_STORAGE_BYTES,
  UPLOADS_PER_HOUR,
} from "./transfer-contracts.js";

export const MULTIPART_PART_SIZE_BYTES = 16 * 1024 * 1024;
const MAX_MULTIPART_FILE_SIZE_BYTES = 5 * 1024 * 1024 * 1024 * 1024;
const MAX_MULTIPART_PARTS = 10_000;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export interface FileMultipartDependencies {
  folders: FilesFolderRepository;
  items: FilesItemRepository;
  names: FilesCatalogNameRepository;
  uploads: FilesUploadRepository;
  transferEvents: FilesTransferEventRepository;
  multipart: FilesMultipartUploadRepository;
  storage: IFileStoragePort;
  now?: () => Date;
  createId?: () => string;
}

export interface MultipartStarted {
  uploadId: string;
  partSizeBytes: number;
  totalParts: number;
}

export function createFileMultipartUploads(deps: FileMultipartDependencies) {
  const now = deps.now ?? (() => new Date());
  const createId = deps.createId ?? (() => crypto.randomUUID());
  const storage = deps.storage;

  async function begin(
    actor: FilesActor,
    input: unknown,
  ): Promise<CatalogResult<MultipartStarted>> {
    if (!hasValidActor(actor) || !storage.createMultipartUpload) {
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
      sizeBytes <= 95 * 1024 * 1024 ||
      !isValidContentType(contentType)
    ) {
      return failure("invalid-input");
    }
    if (sizeBytes > MAX_MULTIPART_FILE_SIZE_BYTES) {
      return failure("too-large");
    }
    const totalParts = Math.ceil(sizeBytes / MULTIPART_PART_SIZE_BYTES);
    if (totalParts < 2 || totalParts > MAX_MULTIPART_PARTS) {
      return failure("too-large");
    }

    try {
      if (
        !(await activeParentExists(deps.folders, actor.userId, folderId))
      ) {
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
      const windowStart = new Date(
        timestamp.getTime() - 3_600_000,
      ).toISOString();
      if (
        !(await deps.transferEvents.consume(
          createId(),
          actor.userId,
          "upload",
          createdAt,
          windowStart,
          UPLOADS_PER_HOUR,
        ))
      ) {
        return failure("rate-limited");
      }

      const itemId = createId();
      const reservationId = createId();
      const sessionId = createId();
      const storageKey = "u/" + actor.userId + "/" + itemId;
      const reservation: FilesUploadRecord = {
        id: reservationId,
        ownerId: actor.userId,
        itemId,
        storageKey,
        expectedSizeBytes: sizeBytes,
        contentType,
        status: "pending",
        createdAt,
        expiresAt: new Date(
          timestamp.getTime() + SESSION_TTL_MS,
        ).toISOString(),
        completedAt: null,
      };
      if (
        !(await deps.uploads.reserve(reservation, MAX_USER_STORAGE_BYTES))
      ) {
        return failure("quota-exceeded");
      }

      let claimed = false;
      let r2UploadId: string | null = null;
      try {
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

        r2UploadId = await storage.createMultipartUpload(
          storageKey,
          contentType,
        );
        const session: FilesMultipartSession = {
          id: sessionId,
          ownerId: actor.userId,
          reservationId,
          itemId,
          folderId,
          name,
          storageKey,
          r2UploadId,
          expectedSizeBytes: sizeBytes,
          contentType,
          createdAt,
          expiresAt: reservation.expiresAt,
        };
        await deps.multipart.insert(session);
        return success({
          uploadId: sessionId,
          partSizeBytes: MULTIPART_PART_SIZE_BYTES,
          totalParts,
        });
      } catch {
        if (r2UploadId && storage.abortMultipartUpload) {
          try {
            await storage.abortMultipartUpload(storageKey, r2UploadId);
          } catch {
            // Best-effort cleanup.
          }
        }
        if (claimed) {
          await deps.names
            .release(actor.userId, "file", itemId)
            .catch(() => undefined);
        }
        await deps.uploads
          .deleteByIdForOwner(reservationId, actor.userId)
          .catch(() => false);
        return failure("unavailable");
      }
    } catch {
      return failure("unavailable");
    }
  }

  async function uploadPart(
    actor: FilesActor,
    sessionId: string,
    partNumber: number,
    body: ReadableStream<Uint8Array> | null,
    declaredSize: number,
  ): Promise<CatalogResult<{ partNumber: number }>> {
    if (!hasValidActor(actor) || !storage.uploadMultipartPart || !body) {
      return failure("invalid-input");
    }
    if (
      !Number.isSafeInteger(partNumber) ||
      partNumber < 1 ||
      partNumber > MAX_MULTIPART_PARTS ||
      !Number.isSafeInteger(declaredSize) ||
      declaredSize <= 0 ||
      declaredSize > MULTIPART_PART_SIZE_BYTES
    ) {
      return failure("invalid-input");
    }

    const session = await deps.multipart.findByIdForOwner(
      sessionId,
      actor.userId,
    );
    if (!session || session.expiresAt <= now().toISOString()) {
      return failure("not-found");
    }
    const totalParts = Math.ceil(
      session.expectedSizeBytes / MULTIPART_PART_SIZE_BYTES,
    );
    if (partNumber > totalParts) return failure("invalid-input");
    const expectedPartSize =
      partNumber === totalParts
        ? session.expectedSizeBytes -
          MULTIPART_PART_SIZE_BYTES * (totalParts - 1)
        : MULTIPART_PART_SIZE_BYTES;
    if (declaredSize !== expectedPartSize) return failure("size-mismatch");

    let actualBytes = 0;
    const guarded = body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          actualBytes += chunk.byteLength;
          if (actualBytes > expectedPartSize) {
            controller.error(new Error("Part too large"));
          } else {
            controller.enqueue(chunk);
          }
        },
        flush(controller) {
          if (actualBytes !== expectedPartSize) {
            controller.error(new Error("Part size mismatch"));
          }
        },
      }),
    );
    try {
      const part = await storage.uploadMultipartPart(
        session.storageKey,
        session.r2UploadId,
        partNumber,
        guarded,
        expectedPartSize,
      );
      if (actualBytes !== expectedPartSize || !part.etag) {
        return failure("size-mismatch");
      }
      await deps.multipart.savePart({
        sessionId,
        partNumber,
        etag: part.etag,
        sizeBytes: actualBytes,
      });
      return success({ partNumber });
    } catch {
      return failure("unavailable");
    }
  }

  async function complete(
    actor: FilesActor,
    sessionId: string,
  ): Promise<CatalogResult<FilesFileView>> {
    if (!hasValidActor(actor) || !storage.completeMultipartUpload) {
      return failure("unavailable");
    }
    const session = await deps.multipart.findByIdForOwner(
      sessionId,
      actor.userId,
    );
    if (!session || session.expiresAt <= now().toISOString()) {
      return failure("not-found");
    }
    const parts = await deps.multipart.listParts(sessionId);
    const totalParts = Math.ceil(
      session.expectedSizeBytes / MULTIPART_PART_SIZE_BYTES,
    );
    if (
      parts.length !== totalParts ||
      parts.some(
        (part, index) =>
          part.partNumber !== index + 1 ||
          part.sizeBytes !==
            (index + 1 === totalParts
              ? session.expectedSizeBytes -
                MULTIPART_PART_SIZE_BYTES * (totalParts - 1)
              : MULTIPART_PART_SIZE_BYTES),
      )
    ) {
      return failure("size-mismatch");
    }

    let itemInserted = false;
    try {
      const storageParts: FileStorageMultipartPart[] = parts.map(
        ({ partNumber, etag, sizeBytes }) => ({
          partNumber,
          etag,
          sizeBytes,
        }),
      );
      await storage.completeMultipartUpload(
        session.storageKey,
        session.r2UploadId,
        storageParts,
      );
      const stored = await storage.head(session.storageKey);
      if (!stored || stored.sizeBytes !== session.expectedSizeBytes) {
        throw new Error("Stored object size mismatch");
      }
      const timestamp = now().toISOString();
      const item: FilesItemRecord = {
        id: session.itemId,
        ownerId: session.ownerId,
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
      itemInserted = true;
      if (
        !(await deps.uploads.updateStatus(
          session.reservationId,
          actor.userId,
          "completed",
          timestamp,
        ))
      ) {
        throw new Error("Upload reservation could not be completed");
      }
      if (!(await deps.multipart.delete(sessionId, actor.userId))) {
        throw new Error("Multipart session could not be removed");
      }
      return success(toFileView(item));
    } catch {
      if (itemInserted) {
        await deps.items
          .deletePermanently(session.itemId, actor.userId)
          .catch(() => false);
      }
      await storage.delete(session.storageKey).catch(() => undefined);
      await deps.names
        .release(actor.userId, "file", session.itemId)
        .catch(() => undefined);
      await deps.uploads
        .deleteByIdForOwner(session.reservationId, actor.userId)
        .catch(() => false);
      await deps.multipart.delete(sessionId, actor.userId).catch(() => false);
      return failure("unavailable");
    }
  }

  async function abort(
    actor: FilesActor,
    sessionId: string,
  ): Promise<CatalogResult<void>> {
    if (!hasValidActor(actor)) return failure("invalid-input");
    const session = await deps.multipart.findByIdForOwner(
      sessionId,
      actor.userId,
    );
    if (!session) return failure("not-found");
    try {
      if (storage.abortMultipartUpload) {
        await storage
          .abortMultipartUpload(session.storageKey, session.r2UploadId)
          .catch(() => undefined);
      }
      await storage.delete(session.storageKey).catch(() => undefined);
      await deps.names.release(actor.userId, "file", session.itemId);
      await deps.uploads.deleteByIdForOwner(
        session.reservationId,
        actor.userId,
      );
      await deps.multipart.delete(sessionId, actor.userId);
      return success(undefined);
    } catch {
      return failure("unavailable");
    }
  }

  return {
    beginMultipartUpload: begin,
    uploadMultipartPart: uploadPart,
    completeMultipartUpload: complete,
    abortMultipartUpload: abort,
  };
}
