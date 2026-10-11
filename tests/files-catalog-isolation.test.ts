import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFilesCatalogFixture } from "./helpers/files-catalog.js";

const ownerA = { userId: "owner-a" };
const ownerB = { userId: "owner-b" };

describe("files catalog owner isolation", () => {
  let fixture: Awaited<ReturnType<typeof createFilesCatalogFixture>>;

  beforeEach(async () => {
    fixture = await createFilesCatalogFixture();
  });

  afterEach(() => fixture.close());

  it("hides foreign resources and rejects cross-owner mutations", async () => {
    const folder = await fixture.api.createFolder(ownerB, { name: "Private" });
    if (!folder.ok) throw new Error("Folder creation failed");
    const file = await fixture.api.createFileMetadata(ownerB, {
      name: "private.txt",
      sizeBytes: 7,
      contentType: "text/plain",
    });
    if (!file.ok) throw new Error("File metadata creation failed");

    expect(
      await fixture.api.renameFolder(ownerA, folder.value.id, "Stolen"),
    ).toEqual({
      ok: false,
      reason: "not-found",
    });
    expect(
      await fixture.api.listFolder(ownerA, { folderId: folder.value.id }),
    ).toEqual({ ok: false, reason: "not-found" });
    expect(await fixture.api.deleteFolder(ownerA, folder.value.id)).toEqual({
      ok: false,
      reason: "not-found",
    });
    expect(
      await fixture.api.renameFile(ownerA, file.value.id, "stolen.txt"),
    ).toEqual({
      ok: false,
      reason: "not-found",
    });
    expect(await fixture.api.deleteFile(ownerA, file.value.id)).toEqual({
      ok: false,
      reason: "not-found",
    });

    const foreignView = await fixture.api.listFolder(ownerA, {
      folderId: null,
    });
    expect(foreignView.ok).toBe(true);
    if (foreignView.ok) {
      expect(foreignView.value.files.map((entry) => entry.id)).not.toContain(
        file.value.id,
      );
    }

    const ownerView = await fixture.api.listFolder(ownerB, { folderId: null });
    expect(ownerView.ok).toBe(true);
    if (ownerView.ok) {
      expect(ownerView.value.folders.map((entry) => entry.id)).toContain(
        folder.value.id,
      );
      expect(ownerView.value.files.map((entry) => entry.id)).toContain(
        file.value.id,
      );
    }
  });

  it("reserves a parent name across file and folder node types", async () => {
    const results = await Promise.all([
      fixture.api.createFolder(ownerA, { name: "shared-name" }),
      fixture.api.createFileMetadata(ownerA, {
        name: "shared-name",
        sizeBytes: 1,
        contentType: "text/plain",
      }),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(
      results.filter(
        (result) => !result.ok && result.reason === "duplicate-name",
      ),
    ).toHaveLength(1);
  });
  
  it(
    "rejects cross-owner moves and creation inside foreign folders",
    async () => {
    const foreignFolder = await fixture.api.createFolder(ownerB, {
      name: "Foreign destination",
    });
    if (!foreignFolder.ok) throw new Error("Foreign folder creation failed");
    const ownFolder = await fixture.api.createFolder(ownerA, {
      name: "Own folder",
    });
    if (!ownFolder.ok) throw new Error("Own folder creation failed");
    const ownFile = await fixture.api.createFileMetadata(ownerA, {
      name: "own.txt",
      sizeBytes: 3,
      contentType: "text/plain",
    });
    if (!ownFile.ok) throw new Error("Own file creation failed");
    const foreignFile = await fixture.api.createFileMetadata(ownerB, {
      name: "foreign.txt",
      folderId: foreignFolder.value.id,
      sizeBytes: 5,
      contentType: "text/plain",
    });
    if (!foreignFile.ok) throw new Error("Foreign file creation failed");

    expect(
      await fixture.api.moveFolder(
        ownerA,
        ownFolder.value.id,
        foreignFolder.value.id,
      ),
    ).toEqual({ ok: false, reason: "not-found" });
    expect(
      await fixture.api.moveFolder(ownerA, foreignFolder.value.id, null),
    ).toEqual({ ok: false, reason: "not-found" });
    expect(
      await fixture.api.moveFile(
        ownerA,
        ownFile.value.id,
        foreignFolder.value.id,
      ),
    ).toEqual({ ok: false, reason: "not-found" });
    expect(
      await fixture.api.moveFile(ownerA, foreignFile.value.id, null),
    ).toEqual({ ok: false, reason: "not-found" });
    expect(
      await fixture.api.createFolder(ownerA, {
        name: "Should not exist",
        parentFolderId: foreignFolder.value.id,
      }),
    ).toEqual({ ok: false, reason: "not-found" });
    expect(
      await fixture.api.createFileMetadata(ownerA, {
        name: "should-not-exist.txt",
        folderId: foreignFolder.value.id,
        sizeBytes: 1,
        contentType: "text/plain",
      }),
    ).toEqual({ ok: false, reason: "not-found" });

    const ownerARoot = await fixture.api.listFolder(ownerA, { folderId: null });
    expect(ownerARoot.ok).toBe(true);
    if (ownerARoot.ok) {
      expect(ownerARoot.value.folders.map((entry) => entry.id)).toContain(
        ownFolder.value.id,
      );
      expect(ownerARoot.value.files.map((entry) => entry.id)).toContain(
        ownFile.value.id,
      );
      expect(ownerARoot.value.folders.map((entry) => entry.name)).not.toContain(
        "Should not exist",
      );
    }

    const ownerBFolder = await fixture.api.listFolder(ownerB, {
      folderId: foreignFolder.value.id,
    });
    expect(ownerBFolder.ok).toBe(true);
    if (ownerBFolder.ok) {
      expect(ownerBFolder.value.files.map((entry) => entry.id)).toContain(
        foreignFile.value.id,
      );
      expect(ownerBFolder.value.folders).toHaveLength(0);
    }
  });

  it(
    "isolates trash and rejects restoration of another owner's deleted nodes",
    async () => {
    const foreignFolder = await fixture.api.createFolder(ownerB, {
      name: "Trashed foreign folder",
    });
    if (!foreignFolder.ok) throw new Error("Foreign folder creation failed");
    const foreignFile = await fixture.api.createFileMetadata(ownerB, {
      name: "trashed-foreign.txt",
      sizeBytes: 9,
      contentType: "text/plain",
    });
    if (!foreignFile.ok) throw new Error("Foreign file creation failed");

    expect(
      await fixture.api.deleteFolder(ownerB, foreignFolder.value.id),
    ).toEqual({
      ok: true,
      value: undefined,
    });
    expect(await fixture.api.deleteFile(ownerB, foreignFile.value.id)).toEqual({
      ok: true,
      value: undefined,
    });

    expect(
      await fixture.api.restoreFolder(ownerA, foreignFolder.value.id),
    ).toEqual({ ok: false, reason: "not-found" });
    expect(
      await fixture.api.restoreFile(ownerA, foreignFile.value.id),
    ).toEqual({ ok: false, reason: "not-found" });

    const ownerATrash = await fixture.api.listTrash(ownerA, { limit: 50 });
    expect(ownerATrash.ok).toBe(true);
    if (ownerATrash.ok) {
      const ids = ownerATrash.value.nodes.map((node) => node.id);
      expect(ids).not.toContain(foreignFolder.value.id);
      expect(ids).not.toContain(foreignFile.value.id);
    }

    const ownerBTrash = await fixture.api.listTrash(ownerB, { limit: 50 });
    expect(ownerBTrash.ok).toBe(true);
    if (ownerBTrash.ok) {
      const ids = ownerBTrash.value.nodes.map((node) => node.id);
      expect(ids).toContain(foreignFolder.value.id);
      expect(ids).toContain(foreignFile.value.id);
    }
  });

});
