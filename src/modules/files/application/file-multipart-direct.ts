import type { CatalogResult, FilesActor } from "./catalog-contracts.js";
import { failure, success } from "./catalog-contracts.js";
import type { FilesMultipartUploadRepository } from "./ports/files-multipart-repository.js";
import type { IFileStoragePort } from "./ports/file-storage.js";
import {
  hasValidActor,
  isValidCatalogId,
} from "../domain/catalog-validation.js";

const PART_BYTES = 16 * 1024 * 1024;
const MAX_PARTS = 10_000;

interface Dependencies {
  multipart: FilesMultipartUploadRepository;
  storage: IFileStoragePort;
  now?: () => Date;
}

export interface MultipartPartAuthorization {
  url: string;
  partNumber: number;
  expectedSizeBytes: number;
  expiresInSeconds: number;
}

function expectedPartSize(
  totalBytes: number,
  partNumber: number,
  totalParts: number,
): number {
  return partNumber === totalParts
    ? totalBytes - PART_BYTES * (totalParts - 1)
    : PART_BYTES;
}

export function createMultipartPartAuthorizations(deps: Dependencies) {
  const now = deps.now ?? (() => new Date());

  async function authorize(
    actor: FilesActor,
    sessionId: string,
    partNumber: number,
  ): Promise<CatalogResult<MultipartPartAuthorization>> {
    if (!hasValidActor(actor) || !isValidCatalogId(sessionId)) {
      return failure("invalid-input");
    }
    if (!deps.storage.presignMultipartPartUrl) return failure("unavailable");
    if (
      !Number.isSafeInteger(partNumber) ||
      partNumber < 1 ||
      partNumber > MAX_PARTS
    ) {
      return failure("invalid-input");
    }
    const session = await deps.multipart.findByIdForOwner(
      sessionId,
      actor.userId,
    );
    if (
      !session ||
      session.r2UploadId === "direct-put" ||
      session.expiresAt <= now().toISOString()
    ) {
      return failure("not-found");
    }
    const totalParts = Math.ceil(session.expectedSizeBytes / PART_BYTES);
    if (partNumber > totalParts) return failure("invalid-input");
    const expectedSizeBytes = expectedPartSize(
      session.expectedSizeBytes,
      partNumber,
      totalParts,
    );
    try {
      const url = await deps.storage.presignMultipartPartUrl(
        session.storageKey,
        session.r2UploadId,
        partNumber,
        120,
      );
      if (!url) return failure("unavailable");
      return success({
        url,
        partNumber,
        expectedSizeBytes,
        expiresInSeconds: 120,
      });
    } catch {
      return failure("unavailable");
    }
  }

  async function record(
    actor: FilesActor,
    sessionId: string,
    partNumber: number,
    sizeBytes: number,
    rawEtag: string,
  ): Promise<CatalogResult<{ partNumber: number }>> {
    if (!hasValidActor(actor) || !isValidCatalogId(sessionId)) {
      return failure("invalid-input");
    }
    if (
      !Number.isSafeInteger(partNumber) ||
      partNumber < 1 ||
      partNumber > MAX_PARTS
    ) {
      return failure("invalid-input");
    }
    const etag = rawEtag.trim().replace(/^"|"$/g, "");
    if (!/^[A-Fa-f0-9-]{8,128}$/.test(etag)) {
      return failure("invalid-input");
    }
    const session = await deps.multipart.findByIdForOwner(
      sessionId,
      actor.userId,
    );
    if (
      !session ||
      session.r2UploadId === "direct-put" ||
      session.expiresAt <= now().toISOString()
    ) {
      return failure("not-found");
    }
    const totalParts = Math.ceil(session.expectedSizeBytes / PART_BYTES);
    if (partNumber > totalParts) return failure("invalid-input");
    const expected = expectedPartSize(
      session.expectedSizeBytes,
      partNumber,
      totalParts,
    );
    if (sizeBytes !== expected) return failure("size-mismatch");
    try {
      await deps.multipart.savePart({
        sessionId,
        partNumber,
        etag,
        sizeBytes,
      });
      return success({ partNumber });
    } catch {
      return failure("unavailable");
    }
  }

  return {
    authorizeMultipartPart: authorize,
    recordMultipartPart: record,
  };
}
