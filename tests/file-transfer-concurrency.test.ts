import { describe, expect, it } from "vitest";
import {
  D1FilesCatalogNameRepository,
} from "../src/modules/files/infrastructure/persistence/d1/d1-files-catalog-name.repository.js";
import {
  D1FilesTransferEventRepository,
} from "../src/modules/files/infrastructure/persistence/d1/d1-files-transfer-event.repository.js";
import {
  D1FilesUploadRepository,
} from "../src/modules/files/infrastructure/persistence/d1/d1-files-upload.repository.js";
import {
  MAX_USER_STORAGE_BYTES,
} from "../src/modules/files/application/transfer-contracts.js";
import { createSqliteD1 } from "./helpers/sqlite-d1.js";

describe("concurrencia de reservas y límites de transferencia", () => {
  it(
    "no permite que dos reservas simultáneas excedan la cuota del propietario",
    async () => {
      const fixture = createSqliteD1();
      try {
        fixture.exec(`
          CREATE TABLE files_items (
            id TEXT PRIMARY KEY,
            owner_id TEXT NOT NULL,
            size_bytes INTEGER NOT NULL
          );
          CREATE TABLE files_uploads (
            id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, item_id TEXT NOT NULL,
            storage_key TEXT NOT NULL, expected_size_bytes INTEGER NOT NULL,
            content_type TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL,
            expires_at TEXT NOT NULL, completed_at TEXT
          );
        `);
        const uploads = new D1FilesUploadRepository(fixture.db);
        const makeReservation = (id: string) => ({
          id,
          ownerId: "owner-a",
          itemId: "item-" + id,
          storageKey: "u/owner-a/item-" + id,
          expectedSizeBytes: 6 * 1024 * 1024 * 1024,
          contentType: "application/octet-stream",
          status: "pending" as const,
          createdAt: "2026-10-13T00:00:00.000Z",
          expiresAt: "2026-10-13T01:00:00.000Z",
          completedAt: null,
        });

        const results = await Promise.all([
          uploads.reserve(
            makeReservation("reservation-a"),
            MAX_USER_STORAGE_BYTES,
          ),
          uploads.reserve(
            makeReservation("reservation-b"),
            MAX_USER_STORAGE_BYTES,
          ),
        ]);

        expect(results.filter(Boolean)).toHaveLength(1);
        const rows = await fixture.db
          .prepare(
            "SELECT SUM(expected_size_bytes) AS total " +
              "FROM files_uploads WHERE owner_id = ?",
          )
          .bind("owner-a")
          .first<{ total: number }>();
        expect(rows?.total).toBe(6 * 1024 * 1024 * 1024);
      } finally {
        fixture.close();
      }
    },
  );

  it(
    "aplica el límite de eventos incluso con solicitudes simultáneas",
    async () => {
      const fixture = createSqliteD1();
      try {
        fixture.exec(`
          CREATE TABLE files_transfer_events (
            id TEXT PRIMARY KEY NOT NULL,
            owner_id TEXT NOT NULL,
            event_type TEXT NOT NULL CHECK (event_type IN ('upload', 'download')),
            occurred_at TEXT NOT NULL
          );
        `);
        const events = new D1FilesTransferEventRepository(fixture.db);
        const occurredAt = "2026-10-13T00:00:00.000Z";
        const results = await Promise.all(
          Array.from({ length: 40 }, (_, index) =>
            events.consume(
              "event-" + index,
              "owner-a",
              "upload",
              occurredAt,
              "2026-10-12T23:00:00.000Z",
              20,
            ),
          ),
        );

        expect(results.filter(Boolean)).toHaveLength(20);
        const count = await fixture.db
          .prepare(
            "SELECT COUNT(*) AS count " +
              "FROM files_transfer_events WHERE owner_id = ?",
          )
          .bind("owner-a")
          .first<{ count: number }>();
        expect(count?.count).toBe(20);
      } finally {
        fixture.close();
      }
    },
  );

  it(
    "reserva un nombre de archivo una sola vez ante solicitudes simultáneas",
    async () => {
      const fixture = createSqliteD1();
      try {
        fixture.exec(`
          CREATE TABLE files_catalog_names (
            owner_id TEXT NOT NULL,
            parent_key TEXT NOT NULL,
            name_key TEXT NOT NULL,
            node_type TEXT NOT NULL,
            node_id TEXT NOT NULL,
            UNIQUE(owner_id, parent_key, name_key)
          );
        `);
        const names = new D1FilesCatalogNameRepository(fixture.db);
        const results = await Promise.all([
          names.claim({
            ownerId: "owner-a",
            parentFolderId: null,
            name: "Report.txt",
            nodeType: "file",
            nodeId: "file-a",
          }),
          names.claim({
            ownerId: "owner-a",
            parentFolderId: null,
            name: "report.TXT",
            nodeType: "file",
            nodeId: "file-b",
          }),
        ]);

        expect(results.filter(Boolean)).toHaveLength(1);
        const count = await fixture.db
          .prepare(
            "SELECT COUNT(*) AS count " +
              "FROM files_catalog_names WHERE owner_id = ?",
          )
          .bind("owner-a")
          .first<{ count: number }>();
        expect(count?.count).toBe(1);
      } finally {
        fixture.close();
      }
    },
  );
});
