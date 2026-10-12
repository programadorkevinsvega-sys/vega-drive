import { describe, expect, it, vi } from "vitest";
import {
  createMultipartPartAuthorizations,
} from "../src/modules/files/application/file-multipart-direct.js";
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
        16 * 1024 * 1024,
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
