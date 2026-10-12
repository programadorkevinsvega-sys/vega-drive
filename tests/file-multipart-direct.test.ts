import { describe, expect, it, vi } from "vitest";
import { createFilesCatalogFixture } from "./helpers/files-catalog.js";
import { createMultipartPartAuthorizations } from "../src/modules/files/application/file-multipart-direct.js";
import { MULTIPART_PART_SIZE_BYTES } from "../src/modules/files/application/file-multipart-constants.js";
import type { FilesMultipartSession } from "../src/modules/files/application/ports/files-multipart-repository.js";

const session: FilesMultipartSession = {
  id: "session-a",
  ownerId: "owner-a",
  reservationId: "reservation-a",
  itemId: "item-a",
  folderId: null,
  name: "large-video.mp4",
  storageKey: "u/owner-a/item-a",
  r2UploadId: "r2-upload-a",
  expectedSizeBytes: 100 * 1024 * 1024,
  contentType: "video/mp4",
  createdAt: "2026-10-11T12:00:00.000Z",
  expiresAt: "2026-10-12T12:00:00.000Z",
};

describe("autorizaciones multipart directas a R2", () => {
  it("no publica multipart si el Content-Type real no coincide con la sesión", async () => {
    const fixture = await createFilesCatalogFixture();
    try {
      const sizeBytes = 100 * 1024 * 1024;
      fixture.storage.createMultipartUpload = vi
        .fn()
        .mockResolvedValue("r2-upload-a");
      fixture.storage.completeMultipartUpload = vi
        .fn()
        .mockResolvedValue(undefined);
      fixture.storage.head = vi.fn().mockResolvedValue({
        sizeBytes,
        contentType: "application/octet-stream",
      });
      const deleteObject = vi.spyOn(fixture.storage, "delete");

      const started = await fixture.api.beginMultipartUpload(
        { userId: "owner-a" },
        {
          name: "large-video-metadata-mismatch.mp4",
          folderId: null,
          sizeBytes,
          contentType: "video/mp4",
        },
      );
      expect(started.ok).toBe(true);
      if (!started.ok) {
        throw new Error("No se pudo iniciar la sesión multipart de prueba.");
      }

      const session = await fixture.db
        .prepare(
          "SELECT item_id AS itemId, storage_key AS storageKey FROM files_multipart_uploads WHERE id = ?",
        )
        .bind(started.value.uploadId)
        .first<{ itemId: string; storageKey: string }>();
      expect(session).not.toBeNull();
      if (!session) throw new Error("No se encontró la sesión multipart.");

      for (
        let partNumber = 1;
        partNumber <= started.value.totalParts;
        partNumber += 1
      ) {
        const partSize =
          partNumber === started.value.totalParts
            ? sizeBytes -
              MULTIPART_PART_SIZE_BYTES * (started.value.totalParts - 1)
            : MULTIPART_PART_SIZE_BYTES;
        const recorded = await fixture.api.recordMultipartPart(
          { userId: "owner-a" },
          started.value.uploadId,
          partNumber,
          partSize,
          "0123456789abcdef0123456789abcdef",
        );
        expect(recorded.ok).toBe(true);
      }

      await expect(
        fixture.api.completeMultipartUpload(
          { userId: "owner-a" },
          started.value.uploadId,
        ),
      ).resolves.toEqual({ ok: false, reason: "integrity-mismatch" });

      expect(deleteObject).toHaveBeenCalledWith(session.storageKey);
      expect(
        await fixture.db
          .prepare("SELECT id FROM files_items WHERE id = ?")
          .bind(session.itemId)
          .first(),
      ).toBeNull();
      expect(
        await fixture.db
          .prepare("SELECT id FROM files_uploads WHERE item_id = ?")
          .bind(session.itemId)
          .first(),
      ).toBeNull();
      expect(
        await fixture.db
          .prepare("SELECT id FROM files_multipart_uploads WHERE id = ?")
          .bind(started.value.uploadId)
          .first(),
      ).toBeNull();
    } finally {
      fixture.close();
    }
  });

  it("firma solo la parte y el tamaño esperados para el propietario", async () => {
    const findByIdForOwner = vi.fn().mockResolvedValue(session);
    const presignMultipartPartUrl = vi
      .fn()
      .mockResolvedValue("https://r2.test/part");
    const multipart = {
      findByIdForOwner,
      savePart: vi.fn().mockResolvedValue(undefined),
    };
    const storage = { presignMultipartPartUrl };
    const service = createMultipartPartAuthorizations({
      multipart: multipart as never,
      storage: storage as never,
      now: () => new Date("2026-10-11T14:00:00.000Z"),
    });

    const result = await service.authorizeMultipartPart(
      { userId: "owner-a" },
      session.id,
      7,
    );

    expect(result).toEqual({
      ok: true,
      value: {
        url: "https://r2.test/part",
        partNumber: 7,
        expectedSizeBytes: 4 * 1024 * 1024,
        expiresInSeconds: 120,
      },
    });
    expect(findByIdForOwner).toHaveBeenCalledWith(session.id, "owner-a");
    expect(presignMultipartPartUrl).toHaveBeenCalledWith(
      session.storageKey,
      session.r2UploadId,
      7,
      4 * 1024 * 1024,
      120,
    );
  });

  it("no emite una URL si la sesión pertenece a otro usuario", async () => {
    const findByIdForOwner = vi.fn().mockResolvedValue(null);
    const presignMultipartPartUrl = vi.fn();
    const service = createMultipartPartAuthorizations({
      multipart: { findByIdForOwner } as never,
      storage: { presignMultipartPartUrl } as never,
      now: () => new Date("2026-10-11T14:00:00.000Z"),
    });

    const result = await service.authorizeMultipartPart(
      { userId: "owner-b" },
      session.id,
      1,
    );

    expect(result).toEqual({ ok: false, reason: "not-found" });
    expect(findByIdForOwner).toHaveBeenCalledWith(session.id, "owner-b");
    expect(presignMultipartPartUrl).not.toHaveBeenCalled();
  });

  it("rechaza sesiones expiradas y números de parte fuera de rango", async () => {
    const findByIdForOwner = vi.fn().mockResolvedValue({
      ...session,
      expiresAt: "2026-10-11T13:59:59.000Z",
    });
    const presignMultipartPartUrl = vi.fn();
    const service = createMultipartPartAuthorizations({
      multipart: { findByIdForOwner } as never,
      storage: { presignMultipartPartUrl } as never,
      now: () => new Date("2026-10-11T14:00:00.000Z"),
    });

    await expect(
      service.authorizeMultipartPart({ userId: "owner-a" }, session.id, 1),
    ).resolves.toEqual({
      ok: false,
      reason: "not-found",
    });
    expect(presignMultipartPartUrl).not.toHaveBeenCalled();

    const activeService = createMultipartPartAuthorizations({
      multipart: {
        findByIdForOwner: vi.fn().mockResolvedValue(session),
      } as never,
      storage: { presignMultipartPartUrl } as never,
      now: () => new Date("2026-10-11T14:00:00.000Z"),
    });
    await expect(
      activeService.authorizeMultipartPart(
        { userId: "owner-a" },
        session.id,
        8,
      ),
    ).resolves.toEqual({ ok: false, reason: "invalid-input" });
    expect(presignMultipartPartUrl).not.toHaveBeenCalled();
  });

  it("no registra ETags arbitrarios ni tamaños incorrectos", async () => {
    const findByIdForOwner = vi.fn().mockResolvedValue(session);
    const savePart = vi.fn().mockResolvedValue(undefined);
    const service = createMultipartPartAuthorizations({
      multipart: { findByIdForOwner, savePart } as never,
      storage: { presignMultipartPartUrl: vi.fn() } as never,
      now: () => new Date("2026-10-11T14:00:00.000Z"),
    });

    await expect(
      service.recordMultipartPart(
        { userId: "owner-a" },
        session.id,
        1,
        MULTIPART_PART_SIZE_BYTES,
        "not-an-etag",
      ),
    ).resolves.toEqual({ ok: false, reason: "invalid-input" });
    await expect(
      service.recordMultipartPart(
        { userId: "owner-a" },
        session.id,
        1,
        12,
        "0123456789abcdef0123456789abcdef",
      ),
    ).resolves.toEqual({ ok: false, reason: "size-mismatch" });
    expect(savePart).not.toHaveBeenCalled();
  });
});
