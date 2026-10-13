import {
  failure,
  success,
  toFileView,
  type CatalogResult,
  type FilesActor,
  type FilesFileView,
} from "./catalog-contracts.js";
import type {
  FilesFolderRepository,
  FilesItemRepository,
  FilesRecentActivityKind,
  FilesRecentActivityRepository,
} from "./ports/files-repositories.js";
import {
  hasValidActor,
  isValidCatalogId,
  parseCatalogLimit,
  parseSafeRecord,
} from "../domain/catalog-validation.js";
import { activeFolderPath } from "./catalog-service-utils.js";

export interface FilesRecentItemView {
  file: FilesFileView;
  activityType: FilesRecentActivityKind;
  lastActivityAt: string;
}

export interface FilesRecentListing {
  items: FilesRecentItemView[];
  nextCursor: string | null;
}

interface RecentCursor {
  occurredAt: string;
  itemId: string;
}

export interface RecentActivityDependencies {
  folders: FilesFolderRepository;
  items: FilesItemRepository;
  recentActivity: FilesRecentActivityRepository;
  now?: () => Date;
}

function parseCursor(value: unknown): RecentCursor | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > 2048) return undefined;
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(value));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return undefined;
    }
    const cursor = parsed as Record<string, unknown>;
    if (
      Object.keys(cursor).some(
        (key) => key !== "occurredAt" && key !== "itemId",
      ) ||
      typeof cursor.occurredAt !== "string" ||
      !Number.isFinite(Date.parse(cursor.occurredAt)) ||
      !isValidCatalogId(cursor.itemId)
    ) {
      return undefined;
    }
    return { occurredAt: cursor.occurredAt, itemId: cursor.itemId };
  } catch {
    return undefined;
  }
}

function encodeCursor(cursor: RecentCursor): string {
  return encodeURIComponent(JSON.stringify(cursor));
}

export function createRecentActivity(deps: RecentActivityDependencies) {
  const now = deps.now ?? (() => new Date());

  async function record(
    actor: FilesActor,
    rawItemId: unknown,
    rawActivityType: unknown,
  ): Promise<CatalogResult<{ recorded: true }>> {
    if (
      !hasValidActor(actor) ||
      !isValidCatalogId(rawItemId) ||
      (rawActivityType !== "open" && rawActivityType !== "download")
    ) {
      return failure("invalid-input");
    }

    try {
      const item = await deps.items.findByIdForOwner(rawItemId, actor.userId);
      if (
        !item ||
        item.deletedAt !== null ||
        (item.folderId !== null &&
          !(await activeFolderPath(deps.folders, actor.userId, item.folderId)))
      ) {
        return failure("not-found");
      }
      await deps.recentActivity.record(
        actor.userId,
        item.id,
        rawActivityType,
        now().toISOString(),
      );
      return success({ recorded: true });
    } catch {
      return failure("unavailable");
    }
  }

  async function list(
    actor: FilesActor,
    input: unknown,
  ): Promise<CatalogResult<FilesRecentListing>> {
    if (!hasValidActor(actor)) return failure("invalid-input");
    const value = parseSafeRecord(input, ["limit", "cursor"]);
    if (!value) return failure("invalid-input");
    const limit = parseCatalogLimit(value.limit);
    const cursor = parseCursor(value.cursor);
    if (limit === null || cursor === undefined) {
      return failure("invalid-input");
    }

    try {
      const rows = await deps.recentActivity.listByOwner(
        actor.userId,
        limit + 1,
        cursor,
      );
      const page = rows.slice(0, limit);
      const items: FilesRecentItemView[] = [];
      for (const row of page) {
        const file = await deps.items.findByIdForOwner(
          row.itemId,
          actor.userId,
        );
        if (
          !file ||
          file.deletedAt !== null ||
          (file.folderId !== null &&
            !(await activeFolderPath(
              deps.folders,
              actor.userId,
              file.folderId,
            )))
        ) {
          continue;
        }
        items.push({
          file: toFileView(file),
          activityType: row.activityType,
          lastActivityAt: row.occurredAt,
        });
      }
      const last = page[page.length - 1];
      return success({
        items,
        nextCursor:
          rows.length > limit && last
            ? encodeCursor({
                occurredAt: last.occurredAt,
                itemId: last.itemId,
              })
            : null,
      });
    } catch {
      return failure("unavailable");
    }
  }

  return { recordRecentActivity: record, listRecent: list };
}
