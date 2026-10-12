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

  it("rechaza y limpia una subida directa cuyo Content-Type real no coincide", async () => {
    const fixture = await createFilesCatalogFixture();
    try {
      fixture.storage.presignPutUrl = vi
        .fn()
        .mockResolvedValue("https://r2.test/object");
      const started = await fixture.api.beginDirectUpload(
        { userId: "owner-a" },
        {
          name: "type-mismatch.txt",
          folderId: null,
          sizeBytes: 4,
          contentType: "text/plain",
        },
      );
      expect(started.ok).toBe(true);
      if (!started.ok) {
        throw new Error("No se pudo iniciar la subida de prueba.");
      }

      const storageKey = "u/owner-a/" + started.value.uploadId;
      fixture.objects.set(storageKey, {
        bytes: new Uint8Array(4),
        contentType: "application/octet-stream",
      });

      await expect(
        fixture.api.completeDirectUpload(
          { userId: "owner-a" },
          started.value.uploadId,
        ),
      ).resolves.toEqual({ ok: false, reason: "integrity-mismatch" });

      expect(fixture.objects.has(storageKey)).toBe(false);
      expect(
        await fixture.db
          .prepare("SELECT id FROM files_items WHERE id = ?")
          .bind(started.value.uploadId)
          .first(),
      ).toBeNull();
      expect(
        await fixture.db
          .prepare("SELECT id FROM files_uploads WHERE item_id = ?")
          .bind(started.value.uploadId)
          .first(),
      ).toBeNull();
    } finally {
      fixture.close();
    }
  });

  it("rechaza una subida same-origin si el Content-Type almacenado difiere", async () => {
    const fixture = await createFilesCatalogFixture();
    try {
      fixture.storage.put = async (key, body) => {
        const bytes = new Uint8Array(await new Response(body).arrayBuffer());
        fixture.objects.set(key, {
          bytes,
          contentType: "application/octet-stream",
        });
      };

      const result = await fixture.api.uploadFile(
        { userId: "owner-a" },
        {
          name: "fallback-type-mismatch.txt",
          folderId: null,
          sizeBytes: 4,
          contentType: "text/plain",
        },
        new Response(new Uint8Array(4)).body,
      );

      expect(result).toEqual({ ok: false, reason: "integrity-mismatch" });
      expect(fixture.objects.size).toBe(0);
      expect(
        await fixture.db
          .prepare("SELECT id FROM files_items WHERE name = ?")
          .bind("fallback-type-mismatch.txt")
          .first(),
      ).toBeNull();
      expect(
        await fixture.db
          .prepare("SELECT id FROM files_uploads WHERE owner_id = ?")
          .bind("owner-a")
          .first(),
      ).toBeNull();
    } finally {
      fixture.close();
    }
  });

  it("retiene la sesión cancelada para limpiar un PUT tardío tras expirar su URL", async () => {
    const fixture = await createFilesCatalogFixture();
    try {
      fixture.storage.presignPutUrl = vi
        .fn()
        .mockResolvedValue("https://r2.test/object");
      const started = await fixture.api.beginDirectUpload(
        { userId: "owner-a" },
        {
          name: "cancelled-late-put.txt",
          folderId: null,
          sizeBytes: 4,
          contentType: "text/plain",
        },
      );
      expect(started.ok).toBe(true);
      if (!started.ok) {
        throw new Error("No se pudo iniciar la subida de prueba.");
      }

      const storageKey = "u/owner-a/" + started.value.uploadId;
      fixture.objects.set(storageKey, {
        bytes: new Uint8Array(4),
        contentType: "text/plain",
      });
      await expect(
        fixture.api.abortMultipartUpload(
          { userId: "owner-a" },
          started.value.uploadId,
        ),
      ).resolves.toEqual({ ok: true, value: undefined });
      expect(fixture.objects.has(storageKey)).toBe(false);

      const reservation = await fixture.db
        .prepare("SELECT status FROM files_uploads WHERE item_id = ?")
        .bind(started.value.uploadId)
        .first<{ status: string }>();
      expect(reservation?.status).toBe("failed");
      expect(
        await fixture.db
          .prepare("SELECT id FROM files_multipart_uploads WHERE id = ?")
          .bind(started.value.uploadId)
          .first(),
      ).not.toBeNull();
      await expect(
        fixture.api.completeDirectUpload(
          { userId: "owner-a" },
          started.value.uploadId,
        ),
      ).resolves.toEqual({ ok: false, reason: "not-found" });

      // Model a late PUT while its issued URL is still valid.
      fixture.objects.set(storageKey, {
        bytes: new Uint8Array(4),
        contentType: "text/plain",
      });
      const cleanupTime = new Date(
        Date.now() + 2 * 60 * 60 * 1000,
      ).toISOString();
      expect(
        await fixture.api.cleanupExpiredUploads(cleanupTime, 100),
      ).toBe(1);
      expect(fixture.objects.has(storageKey)).toBe(false);
      expect(
        await fixture.db
          .prepare("SELECT id FROM files_uploads WHERE item_id = ?")
          .bind(started.value.uploadId)
          .first(),
      ).toBeNull();
      expect(
        await fixture.db
          .prepare("SELECT id FROM files_multipart_uploads WHERE id = ?")
          .bind(started.value.uploadId)
          .first(),
      ).toBeNull();
      expect(
        await fixture.db
          .prepare("SELECT id FROM files_items WHERE id = ?")
          .bind(started.value.uploadId)
          .first(),
      ).toBeNull();
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
