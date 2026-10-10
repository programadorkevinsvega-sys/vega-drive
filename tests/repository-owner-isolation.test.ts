import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type {
  FilesFolderRecord,
  FilesItemRecord,
  FilesUploadRecord,
} from "../src/modules/files/application/ports/files-repositories.js";
import { D1FilesFolderRepository } from "../src/modules/files/infrastructure/persistence/d1/d1-files-folder.repository.js";
import { D1FilesItemRepository } from "../src/modules/files/infrastructure/persistence/d1/d1-files-item.repository.js";
import { D1FilesUploadRepository } from "../src/modules/files/infrastructure/persistence/d1/d1-files-upload.repository.js";
import type { IdentitySessionRecord } from "../src/modules/identity/application/ports/identity-repositories.js";
import { D1IdentitySessionRepository } from "../src/modules/identity/infrastructure/persistence/d1/d1-identity-session.repository.js";
import { createSqliteD1 } from "./helpers/sqlite-d1.js";

const timestamp = "2026-10-10T00:00:00.000Z";

function item(id: string, ownerId: string): FilesItemRecord {
  return {
    id,
    ownerId,
    folderId: null,
    storageKey: "u/" + ownerId + "/" + id,
    name: id + ".txt",
    contentType: "text/plain",
    sizeBytes: 12,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  };
}

function folder(id: string, ownerId: string): FilesFolderRecord {
  return {
    id,
    ownerId,
    parentFolderId: null,
    name: id,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  };
}

function upload(id: string, ownerId: string): FilesUploadRecord {
  return {
    id,
    ownerId,
    itemId: null,
    storageKey: "u/" + ownerId + "/upload/" + id,
    expectedSizeBytes: 12,
    contentType: "text/plain",
    status: "pending",
    createdAt: timestamp,
    expiresAt: "2026-10-11T00:00:00.000Z",
    completedAt: null,
  };
}

function session(id: string, userId: string): IdentitySessionRecord {
  return {
    id,
    userId,
    tokenHash: "hash-" + id,
    createdAt: timestamp,
    lastSeenAt: timestamp,
    expiresAt: "2026-10-11T00:00:00.000Z",
    revokedAt: null,
  };
}

describe("D1 repository owner isolation against SQLite", () => {
  let fixture: ReturnType<typeof createSqliteD1>;
  let items: D1FilesItemRepository;
  let folders: D1FilesFolderRepository;
  let uploads: D1FilesUploadRepository;
  let sessions: D1IdentitySessionRepository;

  beforeEach(async () => {
    fixture = createSqliteD1();
    const filesMigration = await readFile(
      resolve(
        "src/modules/files/infrastructure/persistence/d1/migrations/0001_files_initial.sql",
      ),
      "utf8",
    );
    const identityMigration = await readFile(
      resolve(
        "src/modules/identity/infrastructure/persistence/d1/migrations/0001_identity_initial.sql",
      ),
      "utf8",
    );
    fixture.exec(filesMigration);
    fixture.exec(identityMigration);
    items = new D1FilesItemRepository(fixture.db);
    folders = new D1FilesFolderRepository(fixture.db);
    uploads = new D1FilesUploadRepository(fixture.db);
    sessions = new D1IdentitySessionRepository(fixture.db);
  });

  afterEach(() => {
    fixture.close();
  });

  it("prevents cross-owner reads, lists, renames, and deletes of file items", async () => {
    await items.insert(item("item-a", "owner-a"));
    await items.insert(item("item-b", "owner-b"));

    expect(await items.findByIdForOwner("item-b", "owner-a")).toBeNull();
    expect(
      (await items.listByOwnerAndFolder("owner-a", null, 50)).map(
        (record) => record.id,
      ),
    ).toEqual(["item-a"]);
    expect(
      await items.updateMetadata(
        "item-b",
        "owner-a",
        null,
        "stolen.txt",
        timestamp,
      ),
    ).toBe(false);
    expect(await items.markDeleted("item-b", "owner-a", timestamp)).toBe(false);

    await expect(
      items.findByIdForOwner("item-b", "owner-b"),
    ).resolves.toMatchObject({
      ownerId: "owner-b",
      name: "item-b.txt",
      deletedAt: null,
    });
  });

  it("prevents cross-owner reads, moves, renames, and deletes of folders", async () => {
    await folders.insert(folder("folder-a", "owner-a"));
    await folders.insert(folder("folder-b", "owner-b"));

    expect(await folders.findByIdForOwner("folder-b", "owner-a")).toBeNull();
    expect(
      (await folders.listChildren("owner-a", null, 50)).map(
        (record) => record.id,
      ),
    ).toEqual(["folder-a"]);
    expect(
      await folders.updateMetadata(
        "folder-b",
        "owner-a",
        "folder-a",
        "stolen-folder",
        timestamp,
      ),
    ).toBe(false);
    expect(await folders.markDeleted("folder-b", "owner-a", timestamp)).toBe(
      false,
    );

    await expect(
      folders.findByIdForOwner("folder-b", "owner-b"),
    ).resolves.toMatchObject({
      ownerId: "owner-b",
      name: "folder-b",
      parentFolderId: null,
      deletedAt: null,
    });
  });

  it("prevents one owner from reading or changing another owner's upload", async () => {
    await uploads.insert(upload("upload-a", "owner-a"));
    await uploads.insert(upload("upload-b", "owner-b"));

    expect(await uploads.findByIdForOwner("upload-b", "owner-a")).toBeNull();
    expect(
      await uploads.updateStatus("upload-b", "owner-a", "completed", timestamp),
    ).toBe(false);

    await expect(
      uploads.findByIdForOwner("upload-b", "owner-b"),
    ).resolves.toMatchObject({
      ownerId: "owner-b",
      status: "pending",
      completedAt: null,
    });
  });

  it("prevents a user from revoking another user's session", async () => {
    await sessions.insert(session("session-a", "user-a"));
    await sessions.insert(session("session-b", "user-b"));

    expect(await sessions.revokeForUser("session-b", "user-a", timestamp)).toBe(
      false,
    );
    await expect(
      sessions.findByTokenHash("hash-session-b"),
    ).resolves.toMatchObject({
      userId: "user-b",
      revokedAt: null,
    });

    expect(await sessions.revokeForUser("session-b", "user-b", timestamp)).toBe(
      true,
    );
    await expect(
      sessions.findByTokenHash("hash-session-b"),
    ).resolves.toMatchObject({
      userId: "user-b",
      revokedAt: timestamp,
    });
  });
});
