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
});
