import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFilesCatalogFixture } from "./helpers/files-catalog.js";

const ownerA = { userId: "owner-a" };

describe("files catalog operations", () => {
  let fixture: Awaited<ReturnType<typeof createFilesCatalogFixture>>;
  let api: Awaited<ReturnType<typeof createFilesCatalogFixture>>["api"];

  beforeEach(async () => {
    fixture = await createFilesCatalogFixture();
    api = fixture.api;
  });

  afterEach(() => fixture.close());

  it("creates folders and metadata with normalized names and rejects sibling duplicates", async () => {
    const folder = await api.createFolder(ownerA, { name: " Reports " });
    expect(folder.ok).toBe(true);
    if (!folder.ok) return;
    expect(folder.value.name).toBe("Reports");

    const duplicateFolder = await api.createFolder(ownerA, { name: "reports" });
    expect(duplicateFolder).toEqual({ ok: false, reason: "duplicate-name" });

    const file = await api.createFileMetadata(ownerA, {
      name: "summary.txt",
      sizeBytes: 14,
      contentType: "text/plain",
    });
    expect(file.ok).toBe(true);
    if (!file.ok) return;
    const duplicateAcrossTypes = await api.createFolder(ownerA, {
      name: "SUMMARY.TXT",
    });
    expect(duplicateAcrossTypes).toEqual({
      ok: false,
      reason: "duplicate-name",
    });
    expect("storageKey" in file.value).toBe(false);
  });

  it("rejects invalid names and unexpected input fields", async () => {
    expect(await api.createFolder(ownerA, { name: "../outside" })).toEqual({
      ok: false,
      reason: "invalid-input",
    });
    expect(
      await api.createFolder(ownerA, {
        name: "Normal",
        ownerId: "owner-b",
      }),
    ).toEqual({ ok: false, reason: "invalid-input" });
  });

  it("prevents moving a folder into its own descendant", async () => {
    const parent = await api.createFolder(ownerA, { name: "Parent" });
    if (!parent.ok) throw new Error("Folder creation failed");
    const child = await api.createFolder(ownerA, {
      name: "Child",
      parentFolderId: parent.value.id,
    });
    if (!child.ok) throw new Error("Child creation failed");

    expect(
      await api.moveFolder(ownerA, parent.value.id, child.value.id),
    ).toEqual({
      ok: false,
      reason: "cycle",
    });
  });

  it("releases deleted names and prevents conflicting restoration", async () => {
    const original = await api.createFolder(ownerA, { name: "Reusable" });
    if (!original.ok) throw new Error("Folder creation failed");

    expect(await api.deleteFolder(ownerA, original.value.id)).toEqual({
      ok: true,
      value: undefined,
    });
    const replacement = await api.createFolder(ownerA, { name: "Reusable" });
    expect(replacement.ok).toBe(true);
    expect(await api.restoreFolder(ownerA, original.value.id)).toEqual({
      ok: false,
      reason: "duplicate-name",
    });
  });

  it("soft-deletes folders, blocks access through deleted ancestors, and restores them", async () => {
    const parent = await api.createFolder(ownerA, { name: "Archive" });
    if (!parent.ok) throw new Error("Folder creation failed");
    const child = await api.createFolder(ownerA, {
      name: "Nested",
      parentFolderId: parent.value.id,
    });
    if (!child.ok) throw new Error("Child creation failed");

    expect(await api.deleteFolder(ownerA, parent.value.id)).toEqual({
      ok: true,
      value: undefined,
    });
    expect(await api.listFolder(ownerA, { folderId: child.value.id })).toEqual({
      ok: false,
      reason: "not-found",
    });

    const trash = await api.listTrash(ownerA, { limit: 10 });
    expect(trash.ok).toBe(true);
    if (trash.ok) {
      expect(
        trash.value.nodes.some((node) => node.id === parent.value.id),
      ).toBe(true);
    }

    expect(await api.restoreFolder(ownerA, parent.value.id)).toMatchObject({
      ok: true,
      value: { id: parent.value.id, deletedAt: null },
    });
    expect(
      await api.listFolder(ownerA, { folderId: child.value.id }),
    ).toMatchObject({ ok: true });
  });

  it("does not restore a trashed item into a deleted parent", async () => {
    const parent = await api.createFolder(ownerA, { name: "Parent" });
    if (!parent.ok) throw new Error("Folder creation failed");
    const file = await api.createFileMetadata(ownerA, {
      name: "notes.txt",
      folderId: parent.value.id,
      sizeBytes: 1,
      contentType: "text/plain",
    });
    if (!file.ok) throw new Error("File metadata creation failed");
    await api.deleteFile(ownerA, file.value.id);
    await api.deleteFolder(ownerA, parent.value.id);

    expect(await api.restoreFile(ownerA, file.value.id)).toEqual({
      ok: false,
      reason: "not-found",
    });
    await api.restoreFolder(ownerA, parent.value.id);
    expect(await api.restoreFile(ownerA, file.value.id)).toMatchObject({
      ok: true,
      value: { id: file.value.id, deletedAt: null },
    });
  });

  it("renames and moves folders and files while preserving navigable metadata", async () => {
    const parent = await api.createFolder(ownerA, { name: "Parent" });
    if (!parent.ok) throw new Error("Parent folder creation failed");
    const child = await api.createFolder(ownerA, { name: "Child" });
    if (!child.ok) throw new Error("Child folder creation failed");
    const file = await api.createFileMetadata(ownerA, {
      name: "before.txt",
      sizeBytes: 12,
      contentType: "text/plain",
    });
    if (!file.ok) throw new Error("File metadata creation failed");

    expect(
      await api.renameFolder(ownerA, child.value.id, "Renamed child"),
    ).toMatchObject({
      ok: true,
      value: { id: child.value.id, name: "Renamed child" },
    });
    expect(
      await api.moveFolder(ownerA, child.value.id, parent.value.id),
    ).toMatchObject({
      ok: true,
      value: { id: child.value.id, parentFolderId: parent.value.id },
    });
    expect(
      await api.renameFile(ownerA, file.value.id, "after.txt"),
    ).toMatchObject({
      ok: true,
      value: { id: file.value.id, name: "after.txt" },
    });
    expect(
      await api.moveFile(ownerA, file.value.id, child.value.id),
    ).toMatchObject({
      ok: true,
      value: { id: file.value.id, folderId: child.value.id },
    });

    const nested = await api.listFolder(ownerA, { folderId: child.value.id });
    expect(nested.ok).toBe(true);
    if (nested.ok) {
      expect(nested.value.breadcrumbs.map((entry) => entry.name)).toEqual([
        "Mi unidad",
        "Parent",
        "Renamed child",
      ]);
      expect(nested.value.files.map((entry) => entry.id)).toContain(
        file.value.id,
      );
    }
  });

  it("keeps active nodes unchanged when move or restore is rejected for duplicate names", async () => {
    const destination = await api.createFolder(ownerA, { name: "Destination" });
    if (!destination.ok) throw new Error("Destination creation failed");
    const existingFolder = await api.createFolder(ownerA, {
      name: "Duplicate folder",
      parentFolderId: destination.value.id,
    });
    if (!existingFolder.ok) throw new Error("Existing folder creation failed");
    const movingFolder = await api.createFolder(ownerA, {
      name: "Duplicate folder",
    });
    if (!movingFolder.ok) throw new Error("Moving folder creation failed");

    expect(
      await api.moveFolder(ownerA, movingFolder.value.id, destination.value.id),
    ).toEqual({ ok: false, reason: "duplicate-name" });

    const originalFile = await api.createFileMetadata(ownerA, {
      name: "restore-conflict.txt",
      sizeBytes: 1,
      contentType: "text/plain",
    });
    if (!originalFile.ok) throw new Error("Original file creation failed");
    expect(await api.deleteFile(ownerA, originalFile.value.id)).toEqual({
      ok: true,
      value: undefined,
    });
    const replacementFile = await api.createFileMetadata(ownerA, {
      name: "restore-conflict.txt",
      sizeBytes: 2,
      contentType: "text/plain",
    });
    if (!replacementFile.ok) {
      throw new Error("Replacement file creation failed");
    }

    expect(await api.restoreFile(ownerA, originalFile.value.id)).toEqual({
      ok: false,
      reason: "duplicate-name",
    });

    const root = await api.listFolder(ownerA, { folderId: null });
    expect(root.ok).toBe(true);
    if (root.ok) {
      expect(root.value.folders.map((entry) => entry.id)).toContain(
        movingFolder.value.id,
      );
      expect(root.value.files.map((entry) => entry.id)).toContain(
        replacementFile.value.id,
      );
      expect(root.value.files.map((entry) => entry.id)).not.toContain(
        originalFile.value.id,
      );
    }
    const destinationView = await api.listFolder(ownerA, {
      folderId: destination.value.id,
    });
    expect(destinationView.ok).toBe(true);
    if (destinationView.ok) {
      expect(destinationView.value.folders.map((entry) => entry.id)).toEqual([
        existingFolder.value.id,
      ]);
    }
  });
});
