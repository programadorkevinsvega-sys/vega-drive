import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { D1FilesTransferEventRepository } from "../src/modules/files/infrastructure/persistence/d1/d1-files-transfer-event.repository.js";
import { createFilesCatalogFixture } from "./helpers/files-catalog.js";
import { D1FilesUploadRepository } from "../src/modules/files/infrastructure/persistence/d1/d1-files-upload.repository.js";
import type { FilesUploadRecord } from "../src/modules/files/application/ports/files-repositories.js";
import { createSqliteD1 } from "./helpers/sqlite-d1.js";

async function fixture() {
  const db = createSqliteD1();
  for (const path of [
    "src/modules/files/infrastructure/persistence/d1/migrations/0001_files_initial.sql",
    "src/modules/files/infrastructure/persistence/d1/migrations/0002_files_catalog_names.sql",
    "src/modules/files/infrastructure/persistence/d1/migrations/0003_files_transfers.sql",
    "src/modules/files/infrastructure/persistence/d1/migrations/0004_files_multipart_uploads.sql",
  ])
    db.exec(await readFile(resolve(path), "utf8"));
  return db;
}

function pendingUpload(id: string, sizeBytes: number): FilesUploadRecord {
  const now = new Date("2026-10-11T12:00:00.000Z");
  return {
    id,
    ownerId: "owner-a",
    itemId: "item-" + id,
    storageKey: "u/owner-a/item-" + id,
    expectedSizeBytes: sizeBytes,
    contentType: "application/octet-stream",
    status: "pending",
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 3600000).toISOString(),
    completedAt: null,
  };
}

describe("file transfer reservations and rate limits", () => {
  it("atomically prevents reservations from exceeding the per-owner storage cap", async () => {
    const db = await fixture();
    try {
      const uploads = new D1FilesUploadRepository(db.db);
      const max = 1024 * 1024 * 1024;
      const each = 100 * 1024 * 1024;
      for (let i = 0; i < 10; i++) {
        expect(await uploads.reserve(pendingUpload("up-" + i, each), max)).toBe(
          true,
        );
      }
      expect(
        await uploads.reserve(
          pendingUpload("over-limit", 30 * 1024 * 1024),
          max,
        ),
      ).toBe(false);
      expect(
        await uploads.reserve(
          {
            ...pendingUpload("other-owner", 1),
            ownerId: "owner-b",
            storageKey: "u/owner-b/item-other-owner",
          },
          max,
        ),
      ).toBe(true);
    } finally {
      db.close();
    }
  });

  it("limits transfer attempts per authenticated owner without sharing counters across users", async () => {
    const db = await fixture();
    try {
      const events = new D1FilesTransferEventRepository(db.db);
      const occurredAt = "2026-10-11T12:00:00.000Z";
      const windowStart = "2026-10-11T11:00:00.000Z";
      for (let i = 0; i < 20; i++) {
        expect(
          await events.consume(
            "event-" + i,
            "owner-a",
            "upload",
            occurredAt,
            windowStart,
            20,
          ),
        ).toBe(true);
      }
      expect(
        await events.consume(
          "event-over-limit",
          "owner-a",
          "upload",
          occurredAt,
          windowStart,
          20,
        ),
      ).toBe(false);
      expect(
        await events.consume(
          "other-user",
          "owner-b",
          "upload",
          occurredAt,
          windowStart,
          20,
        ),
      ).toBe(true);
    } finally {
      db.close();
    }
  });

  it("removes expired upload objects and reconciles any pending metadata", async () => {
    const fixture = await createFilesCatalogFixture();
    try {
      const now = "2026-10-11T12:00:00.000Z";
      const objectKey = "u/owner-a/item-stale";
      fixture.objects.set(objectKey, {
        bytes: new TextEncoder().encode("stale"),
        contentType: "text/plain",
      });
      await fixture.db
        .prepare(
          "INSERT INTO files_catalog_names (owner_id, parent_key, name_key, node_type, node_id) VALUES (?, ?, ?, ?, ?)",
        )
        .bind("owner-a", "", "stale.txt", "file", "item-stale")
        .run();
      await fixture.db
        .prepare(
          "INSERT INTO files_items (id, owner_id, folder_id, storage_key, name, content_type, size_bytes, created_at, updated_at, deleted_at) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, NULL)",
        )
        .bind(
          "item-stale",
          "owner-a",
          objectKey,
          "stale.txt",
          "text/plain",
          5,
          now,
          now,
        )
        .run();
      await fixture.db
        .prepare(
          "INSERT INTO files_uploads (id, owner_id, item_id, storage_key, expected_size_bytes, content_type, status, created_at, expires_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)",
        )
        .bind(
          "upload-stale",
          "owner-a",
          "item-stale",
          objectKey,
          5,
          "text/plain",
          "pending",
          "2026-10-11T10:00:00.000Z",
          "2026-10-11T11:00:00.000Z",
        )
        .run();

      expect(await fixture.api.cleanupExpiredUploads(now, 10)).toBe(1);
      expect(fixture.objects.has(objectKey)).toBe(false);
      expect(
        await fixture.db
          .prepare("SELECT id FROM files_items WHERE id = ?")
          .bind("item-stale")
          .first(),
      ).toBeNull();
      expect(
        await fixture.db
          .prepare("SELECT id FROM files_uploads WHERE id = ?")
          .bind("upload-stale")
          .first(),
      ).toBeNull();
      expect(
        await fixture.db
          .prepare("SELECT node_id FROM files_catalog_names WHERE node_id = ?")
          .bind("item-stale")
          .first(),
      ).toBeNull();
    } finally {
      fixture.close();
    }
  });

  it("leaves multipart reservations to the session cleanup path", async () => {
    const db = await fixture();
    try {
      const uploads = new D1FilesUploadRepository(db.db);
      const stale = {
        ...pendingUpload("multipart-reservation", 100 * 1024 * 1024),
        expiresAt: "2026-10-11T10:00:00.000Z",
      };
      await uploads.insert(stale);
      await db.db
        .prepare(
          "INSERT INTO files_multipart_uploads (id, owner_id, reservation_id, item_id, folder_id, name, storage_key, r2_upload_id, expected_size_bytes, content_type, created_at, expires_at) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          "multipart-session",
          stale.ownerId,
          stale.id,
          stale.itemId,
          "large-video.mp4",
          stale.storageKey,
          "r2-upload",
          stale.expectedSizeBytes,
          stale.contentType,
          stale.createdAt,
          stale.expiresAt,
        )
        .run();

      await expect(
        uploads.listNeedingCleanup("2026-10-11T12:00:00.000Z", 20),
      ).resolves.toEqual([]);
      await db.db
        .prepare("DELETE FROM files_multipart_uploads WHERE id = ?")
        .bind("multipart-session")
        .run();
      await expect(
        uploads.listNeedingCleanup("2026-10-11T12:00:00.000Z", 20),
      ).resolves.toMatchObject([{ id: stale.id }]);
    } finally {
      db.close();
    }
  });

  it("finds expired and failed uploads for retryable scheduled cleanup", async () => {
    const db = await fixture();
    try {
      const uploads = new D1FilesUploadRepository(db.db);
      const stale = {
        ...pendingUpload("stale", 1),
        expiresAt: "2026-10-11T10:00:00.000Z",
      };
      const failed = {
        ...pendingUpload("failed", 1),
        status: "failed" as const,
      };
      await uploads.insert(stale);
      await uploads.insert(failed);
      const found = await uploads.listNeedingCleanup(
        "2026-10-11T12:00:00.000Z",
        20,
      );
      expect(found.map((upload) => upload.id).sort()).toEqual([
        "failed",
        "stale",
      ]);
    } finally {
      db.close();
    }
  });
});
