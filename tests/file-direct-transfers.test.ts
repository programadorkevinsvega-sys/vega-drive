import { describe, expect, it, vi } from "vitest";
import { createFilesCatalogFixture } from "./helpers/files-catalog.js";

describe("transferencias directas a R2", () => {
  it("vincula la subida directa a la sesión y al propietario", async () => {
    const fixture = await createFilesCatalogFixture();
    try {
      const presignPutUrl = vi.fn().mockResolvedValue("https://r2.test/object");
      fixture.storage.presignPutUrl = presignPutUrl;
      const started = await fixture.api.beginDirectUpload(
        { userId: "owner-a" },
        {
          name: "small.txt",
          folderId: null,
          sizeBytes: 4,
          contentType: "text/plain",
        },
      );
      expect(started.ok).toBe(true);
      if (!started.ok) {
        throw new Error("No se pudo iniciar la subida de prueba.");
      }

      expect(started.value.url).toBe("https://r2.test/object");
      expect(started.value.expiresInSeconds).toBe(120);
      expect(presignPutUrl).toHaveBeenCalledWith(
        "u/owner-a/" + started.value.uploadId,
        "text/plain",
        4,
        120,
      );

      fixture.objects.set("u/owner-a/" + started.value.uploadId, {
        bytes: new Uint8Array(4),
        contentType: "text/plain",
      });
      await expect(
        fixture.api.completeDirectUpload(
          { userId: "owner-b" },
          started.value.uploadId,
        ),
      ).resolves.toEqual({ ok: false, reason: "not-found" });

      const completed = await fixture.api.completeDirectUpload(
        { userId: "owner-a" },
        started.value.uploadId,
      );
      expect(completed).toMatchObject({
        ok: true,
        value: { id: started.value.uploadId, name: "small.txt", sizeBytes: 4 },
      });
    } finally {
      fixture.close();
    }
  });

  it("solo firma descargas de archivos activos del propietario", async () => {
    const fixture = await createFilesCatalogFixture();
    try {
      const created = await fixture.api.createFileMetadata(
        { userId: "owner-a" },
        { name: "private.txt", sizeBytes: 4, contentType: "text/plain" },
      );
      expect(created.ok).toBe(true);
      if (!created.ok) {
        throw new Error("No se pudo crear el archivo de prueba.");
      }

      const presignGetUrl = vi
        .fn()
        .mockResolvedValue("https://r2.test/download");
      fixture.storage.presignGetUrl = presignGetUrl;

      await expect(
        fixture.api.createDownloadUrl({ userId: "owner-b" }, created.value.id),
      ).resolves.toEqual({ ok: false, reason: "not-found" });
      expect(presignGetUrl).not.toHaveBeenCalled();

      await expect(
        fixture.api.createDownloadUrl({ userId: "owner-a" }, created.value.id),
      ).resolves.toEqual({
        ok: true,
        value: { url: "https://r2.test/download", expiresInSeconds: 120 },
      });
      expect(presignGetUrl).toHaveBeenCalledWith(
        "u/owner-a/" + created.value.id,
        120,
        "private.txt",
      );
    } finally {
      fixture.close();
    }
  });
});
