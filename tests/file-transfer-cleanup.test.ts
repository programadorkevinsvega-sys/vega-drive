import { describe, expect, it, vi } from "vitest";
import { createFileTransferCleanup } from "../src/modules/files/application/file-transfer-cleanup.js";
import type { FileTransferDependencies } from "../src/modules/files/application/file-transfer-dependencies.js";
import type { FilesMultipartSession } from "../src/modules/files/application/ports/files-multipart-repository.js";

const expiredSession: FilesMultipartSession = {
  id: "session-a",
  ownerId: "owner-a",
  reservationId: "reservation-a",
  itemId: "item-a",
  folderId: null,
  name: "large-video.mp4",
  storageKey: "u/owner-a/item-a",
  r2UploadId: "r2-upload-a",
  expectedSizeBytes: 32 * 1024 * 1024,
  contentType: "video/mp4",
  createdAt: "2026-10-11T12:00:00.000Z",
  expiresAt: "2026-10-11T13:00:00.000Z",
};

describe("limpieza de transferencias expiradas", () => {
  it("conserva la sesión durable si R2 no confirma el aborto multipart", async () => {
    const abortMultipartUpload = vi
      .fn()
      .mockRejectedValue(new Error("R2 unavailable"));
    const deleteObject = vi.fn().mockResolvedValue(undefined);
    const deleteSession = vi.fn().mockResolvedValue(true);
    const releaseName = vi.fn().mockResolvedValue(true);
    const deleteReservation = vi.fn().mockResolvedValue(true);
    const deps = {
      multipartUploads: {
        listExpired: vi.fn().mockResolvedValue([expiredSession]),
        delete: deleteSession,
      },
      storage: {
        abortMultipartUpload,
        delete: deleteObject,
      },
      names: { release: releaseName },
      uploads: {
        listNeedingCleanup: vi.fn().mockResolvedValue([]),
        deleteByIdForOwner: deleteReservation,
      },
      items: { deletePermanently: vi.fn().mockResolvedValue(true) },
      transferEvents: { cleanupBefore: vi.fn().mockResolvedValue(undefined) },
    } as unknown as FileTransferDependencies;

    const cleaned = await createFileTransferCleanup(deps)(
      "2026-10-12T12:00:00.000Z",
      100,
    );

    expect(cleaned).toBe(0);
    expect(abortMultipartUpload).toHaveBeenCalledWith(
      expiredSession.storageKey,
      expiredSession.r2UploadId,
    );
    expect(deleteObject).not.toHaveBeenCalled();
    expect(releaseName).not.toHaveBeenCalled();
    expect(deleteReservation).not.toHaveBeenCalled();
    expect(deleteSession).not.toHaveBeenCalled();
  });

  it("no intenta abortar una sesión de subida directa simple", async () => {
    const directSession = { ...expiredSession, r2UploadId: "direct-put" };
    const abortMultipartUpload = vi.fn().mockResolvedValue(undefined);
    const deleteObject = vi.fn().mockResolvedValue(undefined);
    const deleteSession = vi.fn().mockResolvedValue(true);
    const releaseName = vi.fn().mockResolvedValue(true);
    const deleteReservation = vi.fn().mockResolvedValue(true);
    const deps = {
      multipartUploads: {
        listExpired: vi.fn().mockResolvedValue([directSession]),
        delete: deleteSession,
      },
      storage: {
        abortMultipartUpload,
        delete: deleteObject,
      },
      names: { release: releaseName },
      uploads: {
        listNeedingCleanup: vi.fn().mockResolvedValue([]),
        deleteByIdForOwner: deleteReservation,
      },
      items: { deletePermanently: vi.fn().mockResolvedValue(true) },
      transferEvents: { cleanupBefore: vi.fn().mockResolvedValue(undefined) },
    } as unknown as FileTransferDependencies;

    const cleaned = await createFileTransferCleanup(deps)(
      "2026-10-12T12:00:00.000Z",
      100,
    );

    expect(cleaned).toBe(1);
    expect(abortMultipartUpload).not.toHaveBeenCalled();
    expect(deleteObject).toHaveBeenCalledWith(directSession.storageKey);
    expect(deleteSession).toHaveBeenCalledWith(
      directSession.id,
      directSession.ownerId,
    );
  });
});
