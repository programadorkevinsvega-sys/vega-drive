import { describe, expect, it } from "vitest";
import { D1FilesFolderRepository } from "../src/modules/files/infrastructure/persistence/d1/d1-files-folder.repository.js";
import { D1FilesItemRepository } from "../src/modules/files/infrastructure/persistence/d1/d1-files-item.repository.js";
import { D1FilesOutboxRepository } from "../src/modules/files/infrastructure/persistence/d1/d1-files-outbox.repository.js";
import { D1FilesUploadRepository } from "../src/modules/files/infrastructure/persistence/d1/d1-files-upload.repository.js";
import { createFakeD1 } from "./helpers/fake-d1.js";

describe("files D1 repositories", () => {
  it("filters item lookup by resource ID and owner", async () => {
    const fake = createFakeD1();
    const repository = new D1FilesItemRepository(fake.db);

    await repository.findByIdForOwner("item-b", "user-a");

    expect(fake.calls[0]?.sql).toContain(
      "FROM files_items WHERE id = ? AND owner_id = ?",
    );
    expect(fake.calls[0]?.sql).not.toContain("item-b");
    expect(fake.calls[0]?.bindings).toEqual(["item-b", "user-a"]);
  });

  it("filters item lists by owner and folder and bounds pagination", async () => {
    const fake = createFakeD1({ results: [] });
    const repository = new D1FilesItemRepository(fake.db);

    await repository.listByOwnerAndFolder("user-a", null, 10000);

    expect(fake.calls[0]?.sql).toContain(
      "WHERE owner_id = ? AND folder_id IS ?",
    );
    expect(fake.calls[0]?.sql).toContain("AND deleted_at IS NULL");
    expect(fake.calls[0]?.sql).toContain("LIMIT ?");
    expect(fake.calls[0]?.bindings).toEqual(["user-a", null, 100]);
  });

  it("filters folder lookup by resource ID and owner", async () => {
    const fake = createFakeD1();
    const repository = new D1FilesFolderRepository(fake.db);

    await repository.findByIdForOwner("folder-b", "user-a");

    expect(fake.calls[0]?.sql).toContain(
      "FROM files_folders WHERE id = ? AND owner_id = ?",
    );
    expect(fake.calls[0]?.bindings).toEqual(["folder-b", "user-a"]);
  });

  it("scopes file metadata mutations and soft deletion to the owner", async () => {
    const fake = createFakeD1({ changes: 1 });
    const repository = new D1FilesItemRepository(fake.db);

    await repository.updateMetadata(
      "item-b",
      "user-a",
      "folder-a",
      "new name",
      "2026-10-10T00:00:00Z",
    );
    await repository.markDeleted("item-b", "user-a", "2026-10-10T00:01:00Z");

    expect(fake.calls[0]?.sql).toContain(
      "WHERE id = ? AND owner_id = ? AND deleted_at IS NULL",
    );
    expect(fake.calls[0]?.bindings).toEqual([
      "folder-a",
      "new name",
      "2026-10-10T00:00:00Z",
      "item-b",
      "user-a",
    ]);
    expect(fake.calls[1]?.sql).toContain(
      "WHERE id = ? AND owner_id = ? AND deleted_at IS NULL",
    );
    expect(fake.calls[1]?.bindings).toEqual([
      "2026-10-10T00:01:00Z",
      "2026-10-10T00:01:00Z",
      "item-b",
      "user-a",
    ]);
  });

  it("filters child folders by owner including the requested parent", async () => {
    const fake = createFakeD1({ results: [] });
    const repository = new D1FilesFolderRepository(fake.db);

    await repository.listChildren("user-a", "parent-b", 25);

    expect(fake.calls[0]?.sql).toContain(
      "WHERE owner_id = ? AND parent_folder_id IS ?",
    );
    expect(fake.calls[0]?.bindings).toEqual(["user-a", "parent-b", 25]);
  });

  it("filters uploads by owner and parameterizes status mutations", async () => {
    const fake = createFakeD1({ changes: 1 });
    const repository = new D1FilesUploadRepository(fake.db);

    await repository.findByIdForOwner("upload-b", "user-a");
    await repository.updateStatus(
      "upload-b",
      "user-a",
      "failed",
      "2026-10-10T00:00:00Z",
    );

    expect(fake.calls[0]?.sql).toContain(
      "FROM files_uploads WHERE id = ? AND owner_id = ?",
    );
    expect(fake.calls[0]?.bindings).toEqual(["upload-b", "user-a"]);
    expect(fake.calls[1]?.sql).toContain("WHERE id = ? AND owner_id = ?");
    expect(fake.calls[1]?.bindings).toEqual([
      "failed",
      "2026-10-10T00:00:00Z",
      "upload-b",
      "user-a",
      "failed",
    ]);
  });

  it("reads only the files-owned outbox with a bounded bound limit", async () => {
    const fake = createFakeD1({ results: [] });
    const repository = new D1FilesOutboxRepository(fake.db);

    await repository.listUnpublished(0);

    expect(fake.calls[0]?.sql).toContain("FROM files_outbox");
    expect(fake.calls[0]?.sql).toContain("LIMIT ?");
    expect(fake.calls[0]?.bindings).toEqual([1]);
  });
});
