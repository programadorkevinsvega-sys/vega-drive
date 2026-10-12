import { describe, expect, it, vi } from "vitest";
import { createRecentActivity } from "./recent-activity.js";
import type {
  FilesFolderRepository,
  FilesItemRecord,
  FilesItemRepository,
  FilesRecentActivityRepository,
} from "./ports/files-repositories.js";

const timestamp = "2026-10-12T17:00:00.000Z";

const file: FilesItemRecord = {
  id: "file_a",
  ownerId: "user_a",
  folderId: null,
  storageKey: "server-only-key",
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
      ownerHasFile && id === file.id && ownerId === file.ownerId ? file : null,
    ),
  } as unknown as FilesItemRepository;
  const folders = {} as FilesFolderRepository;
  const recentActivity = {
    record: vi.fn(async () => undefined),
    listByOwner: vi.fn(async (ownerId: string) =>
      ownerId === file.ownerId
        ? [
            {
              itemId: file.id,
              activityType: "download" as const,
              occurredAt: timestamp,
            },
          ]
        : [],
    ),
  } as unknown as FilesRecentActivityRepository;
  return {
    service: createRecentActivity({
      folders,
      items,
      recentActivity,
      now: () => new Date(timestamp),
    }),
    items,
    recentActivity,
  };
}

describe("files recent activity", () => {
  it("records activity using the authenticated owner's scope", async () => {
    const deps = dependencies();
    const result = await deps.service.recordRecentActivity(
      { userId: "user_a" },
      "file_a",
      "open",
    );

    expect(result).toEqual({ ok: true, value: { recorded: true } });
    expect(deps.items.findByIdForOwner).toHaveBeenCalledWith(
      "file_a",
      "user_a",
    );
    expect(deps.recentActivity.record).toHaveBeenCalledWith(
      "user_a",
      "file_a",
      "open",
      timestamp,
    );
  });

  it("does not record activity for a file owned by another user", async () => {
    const deps = dependencies(false);
    const result = await deps.service.recordRecentActivity(
      { userId: "user_b" },
      "file_a",
      "download",
    );

    expect(result).toEqual({ ok: false, reason: "not-found" });
    expect(deps.recentActivity.record).not.toHaveBeenCalled();
  });

  it("lists only activity returned for the authenticated owner", async () => {
    const deps = dependencies();
    const result = await deps.service.listRecent(
      { userId: "user_a" },
      { limit: 50 },
    );

    expect(result).toEqual({
      ok: true,
      value: {
        items: [
          {
            file: {
              type: "file",
              id: "file_a",
              name: "notes.txt",
              folderId: null,
              sizeBytes: 12,
              contentType: "text/plain",
              createdAt: timestamp,
              updatedAt: timestamp,
              deletedAt: null,
            },
            activityType: "download",
            lastActivityAt: timestamp,
          },
        ],
        nextCursor: null,
      },
    });
    expect(deps.recentActivity.listByOwner).toHaveBeenCalledWith(
      "user_a",
      51,
      null,
    );
  });
});
