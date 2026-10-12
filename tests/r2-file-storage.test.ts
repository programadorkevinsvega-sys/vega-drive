import { describe, expect, it, vi } from "vitest";
import type { Env } from "../src/worker/env.js";
import { R2FileStorage } from "../src/modules/files/infrastructure/storage/r2/r2-file-storage.js";

function storageWithAbort(abort: ReturnType<typeof vi.fn>): R2FileStorage {
  const bucket = {
    resumeMultipartUpload: vi.fn().mockReturnValue({ abort }),
  } as unknown as Env["FILES_BUCKET"];
  return new R2FileStorage(bucket, {} as Env);
}

describe("limpieza multipart de R2", () => {
  it("trata una carga ya abortada como limpieza completada", async () => {
    const abort = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error("NoSuchUpload"), { status: 404 }),
      );
    const storage = storageWithAbort(abort);

    await expect(
      storage.abortMultipartUpload("u/owner-a/item-a", "upload-a"),
    ).resolves.toBeUndefined();
    expect(abort).toHaveBeenCalledOnce();
  });

  it("conserva los errores temporales para que la limpieza se reintente", async () => {
    const abort = vi.fn().mockRejectedValue(new Error("R2 unavailable"));
    const storage = storageWithAbort(abort);

    await expect(
      storage.abortMultipartUpload("u/owner-a/item-a", "upload-a"),
    ).rejects.toThrow("R2 unavailable");
  });
});
