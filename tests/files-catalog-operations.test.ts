import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FilesPublicApi } from "../src/modules/files/module.public-api.js";
import { createFilesCatalogFixture } from "./helpers/files-catalog.js";

const ownerA = { userId: "owner-a" };

describe("files catalog operations", () => {
  let fixture: Awaited<ReturnType<typeof createFilesCatalogFixture>>;
  let api: FilesPublicApi;

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
});
