import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFilesCatalogFixture } from "./helpers/files-catalog.js";

const actor = { userId: "owner-a" };

describe("files catalog listings", () => {
  let fixture: Awaited<ReturnType<typeof createFilesCatalogFixture>>;

  beforeEach(async () => {
    fixture = await createFilesCatalogFixture();
  });

  afterEach(() => fixture.close());

  it("merges files and folders into stable cursor pages", async () => {
    const { api } = fixture;
    await api.createFolder(actor, { name: "Alpha" });
    await api.createFolder(actor, { name: "Gamma" });
    await api.createFileMetadata(actor, {
      name: "Beta.txt",
      sizeBytes: 2,
      contentType: "text/plain",
    });
    await api.createFileMetadata(actor, {
      name: "Delta.txt",
      sizeBytes: 3,
      contentType: "text/plain",
    });

    const first = await api.listFolder(actor, { limit: 2 });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(
      [...first.value.folders, ...first.value.files]
        .map((node) => node.name)
        .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())),
    ).toEqual(["Alpha", "Beta.txt"]);
    expect(first.value.nextCursor).toBeTruthy();

    const second = await api.listFolder(actor, {
      limit: 2,
      cursor: first.value.nextCursor,
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(
      [...second.value.folders, ...second.value.files]
        .map((node) => node.name)
        .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())),
    ).toEqual(["Delta.txt", "Gamma"]);
    expect(second.value.nextCursor).toBeNull();
  });

  it("builds breadcrumbs and rejects malformed cursors", async () => {
    const parent = await fixture.api.createFolder(actor, { name: "Parent" });
    if (!parent.ok) throw new Error("Folder creation failed");
    const child = await fixture.api.createFolder(actor, {
      name: "Child",
      parentFolderId: parent.value.id,
    });
    if (!child.ok) throw new Error("Child creation failed");

    const listing = await fixture.api.listFolder(actor, {
      folderId: child.value.id,
    });
    expect(listing.ok).toBe(true);
    if (listing.ok) {
      expect(listing.value.breadcrumbs.map((part) => part.name)).toEqual([
        "Mi unidad",
        "Parent",
        "Child",
      ]);
    }

    expect(
      await fixture.api.listFolder(actor, {
        cursor: "%7B%22name%22%3A%22bad%22%7D",
      }),
    ).toEqual({ ok: false, reason: "invalid-input" });
    expect(
      await fixture.api.listTrash(actor, { limit: 101 }),
    ).toEqual({ ok: false, reason: "invalid-input" });
  });

  it(
    "paginates trash and keeps deleted entries out of active listings",
    async () => {
    const folder = await fixture.api.createFolder(actor, {
      name: "Old folder",
    });
    if (!folder.ok) throw new Error("Folder creation failed");
    const file = await fixture.api.createFileMetadata(actor, {
      name: "old.txt",
      sizeBytes: 8,
      contentType: "text/plain",
    });
    if (!file.ok) throw new Error("File creation failed");

    await fixture.api.deleteFolder(actor, folder.value.id);
    await fixture.api.deleteFile(actor, file.value.id);

    const active = await fixture.api.listFolder(actor, {});
    expect(active.ok).toBe(true);
    if (active.ok) {
      expect(active.value.folders).toHaveLength(0);
      expect(active.value.files).toHaveLength(0);
    }

    const trash = await fixture.api.listTrash(actor, { limit: 1 });
    expect(trash.ok).toBe(true);
    if (!trash.ok) return;
    expect(trash.value.nodes).toHaveLength(1);
    expect(trash.value.nextCursor).toBeTruthy();

    const next = await fixture.api.listTrash(actor, {
      limit: 1,
      cursor: trash.value.nextCursor,
    });
    expect(next.ok).toBe(true);
    if (next.ok) {
      expect(next.value.nodes).toHaveLength(1);
      expect(next.value.nextCursor).toBeNull();
    }
  });
});
