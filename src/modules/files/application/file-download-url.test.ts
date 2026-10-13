import { describe, expect, it, vi } from "vitest";
import { createFileDownloadUrl } from "./file-download-url.js";
import type { FilesItemRecord, FilesItemRepository, FilesFolderRepository, FilesCatalogNameRepository, FilesUploadRepository, FilesTransferEventRepository } from "./ports/files-repositories.js";
import type { IFileStoragePort } from "./ports/file-storage.js";
import type { FileTransferDependencies } from "./file-transfer-dependencies.js";

const timestamp = "2026-10-13T00:00:00.000Z";
const item: FilesItemRecord = {
  id: "file_a",
  ownerId: "user_a",
  folderId: null,
  storageKey: "private/server/key",
  name: "notes.txt",
  contentType: "text/plain",
  sizeBytes: 12,
  createdAt: timestamp,
  updatedAt: timestamp,
  deletedAt: null,
};

function dependencies(ownerHasFile = true) {
  const items = {
    findByIdForOwner: vi.fn(async (id: string, ownerId: string) =>
      ownerHasFile && id === item.id && ownerId === item.ownerId ? item : null,
    ),
  } as unknown as FilesItemRepository;
  const transferEvents = {
    consume: vi.fn(async () => true),
  } as unknown as FilesTransferEventRepository;
  const storage = {
    head: vi.fn(async () => ({ sizeBytes: item.sizeBytes, contentType: item.contentType })),
    presignGetUrl: vi.fn(async () => "https://r2.example/signed-object"),
  } as unknown as IFileStoragePort;
  const deps = {
    items,
    folders: {} as FilesFolderRepository,
    names: {} as FilesCatalogNameRepository,
    uploads: {} as FilesUploadRepository,
    transferEvents,
    storage,
    now: () => new Date(timestamp),
    createId: () => "event_a",
  } satisfies FileTransferDependencies;
  return { service: createFileDownloadUrl(deps), items, storage, transferEvents };
}

describe("file preview URL authorization", () => {
  it("returns a short-lived inline URL with a server-selected safe MIME type", async () => {
    const deps = dependencies();
    const result = await deps.service({ userId: "user_a" }, "file_a", "preview");

    expect(result).toEqual({
      ok: true,
      value: {
        url: "https://r2.example/signed-object",
        expiresInSeconds: 900,
      },
    });
    expect(deps.items.findByIdForOwner).toHaveBeenCalledWith("file_a", "user_a");
    expect(deps.storage.presignGetUrl).toHaveBeenCalledWith(
      "private/server/key",
      900,
      "notes.txt",
      { disposition: "inline", responseContentType: "text/plain; charset=utf-8" },
    );
  });

  it("does not issue a signed URL for a file owned by another user", async () => {
    const deps = dependencies(false);
    const result = await deps.service({ userId: "user_b" }, "file_a", "preview");

    expect(result).toEqual({ ok: false, reason: "not-found" });
    expect(deps.storage.presignGetUrl).not.toHaveBeenCalled();
  });

  it("refuses active or unsupported formats before signing", async () => {
    const deps = dependencies();
    const active = { ...item, name: "payload.html" };
    vi.mocked(deps.items.findByIdForOwner).mockResolvedValue(active);

    const result = await deps.service({ userId: "user_a" }, "file_a", "preview");

    expect(result).toEqual({ ok: false, reason: "unsupported-preview" });
    expect(deps.storage.presignGetUrl).not.toHaveBeenCalled();
  });

  it("keeps ordinary downloads as attachment URLs with their shorter lifetime", async () => {
    const deps = dependencies();
    const result = await deps.service({ userId: "user_a" }, "file_a");

    expect(result).toMatchObject({
      ok: true,
      value: { expiresInSeconds: 120 },
    });
    expect(deps.storage.presignGetUrl).toHaveBeenCalledWith(
      "private/server/key",
      120,
      "notes.txt",
      undefined,
    );
  });
});
