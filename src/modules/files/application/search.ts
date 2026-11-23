import {
  failure,
  success,
  toFileView,
  toFolderView,
  type CatalogResult,
  type FilesActor,
  type FilesFileView,
  type FilesFolderView,
} from "./catalog-contracts.js";
import type {
  FilesSearchCursor,
  FilesSearchRecord,
  FilesSearchRepository,
  FilesSearchType,
} from "./ports/files-search-repository.js";
import type { FilesFolderRepository } from "./ports/files-repositories.js";
import {
  hasValidActor,
  isValidCatalogId,
  parseCatalogLimit,
  parseSafeRecord,
} from "../domain/catalog-validation.js";
import { activeFolderPath } from "./catalog-service-utils.js";

export type FilesSearchNode = FilesFileView | FilesFolderView;

export interface FilesSearchListing {
  nodes: FilesSearchNode[];
  nextCursor: string | null;
}

export interface FilesSearchDependencies {
  search: FilesSearchRepository;
  folders: FilesFolderRepository;
}

function parseCursor(value: unknown): FilesSearchCursor | null | undefined {
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
        (key) => !["name", "type", "id"].includes(key),
      ) ||
      typeof cursor.name !== "string" ||
      cursor.name.length > 255 ||
      (cursor.type !== "file" && cursor.type !== "folder") ||
      !isValidCatalogId(cursor.id)
    ) {
      return undefined;
    }

    return { name: cursor.name, type: cursor.type, id: cursor.id };
  } catch {
    return undefined;
  }
}

function encodeCursor(cursor: FilesSearchCursor): string {
  return encodeURIComponent(JSON.stringify(cursor));
}

export function createFilesSearch(deps: FilesSearchDependencies) {
  async function search(
    actor: FilesActor,
    input: unknown,
  ): Promise<CatalogResult<FilesSearchListing>> {
    if (!hasValidActor(actor)) return failure("invalid-input");

    const value = parseSafeRecord(input, ["q", "type", "limit", "cursor"]);
    if (!value || typeof value.q !== "string") {
      return failure("invalid-input");
    }

    const query = value.q.normalize("NFC").trim();
    const type = value.type === undefined ? "all" : value.type;
    const limit = parseCatalogLimit(value.limit);
    const cursor = parseCursor(value.cursor);

    if (
      query.length < 1 ||
      query.length > 200 ||
      !["all", "files", "folders"].includes(String(type)) ||
      limit === null ||
      cursor === undefined
    ) {
      return failure("invalid-input");
    }

    try {
      const visibleRows: FilesSearchRecord[] = [];
      const visibilityCache = new Map<string, Promise<boolean>>();
      let scanCursor = cursor;
      let hasMore = false;
      const batchSize = 101;

      for (
        let batch = 0;
        batch < 5 && visibleRows.length <= limit;
        batch += 1
      ) {
        const rows = await deps.search.searchByOwner(
          actor.userId,
          query,
          type as FilesSearchType,
          batchSize,
          scanCursor,
        );

        for (const row of rows) {
          scanCursor = { name: row.name, type: row.type, id: row.id };
          if (row.folderId !== null) {
            let visible = visibilityCache.get(row.folderId);
            if (!visible) {
              visible = activeFolderPath(
                deps.folders,
                actor.userId,
                row.folderId,
              ).then(Boolean);
              visibilityCache.set(row.folderId, visible);
            }
            if (!(await visible)) continue;
          }

          visibleRows.push(row);
          if (visibleRows.length > limit) {
            hasMore = true;
            break;
          }
        }

        if (visibleRows.length > limit) break;
        if (rows.length < batchSize) {
          hasMore = false;
          break;
        }
        hasMore = true;
      }

      const page = visibleRows.slice(0, limit);
      const nodes: FilesSearchNode[] = page.map((row) =>
        row.type === "folder"
          ? toFolderView({
              id: row.id,
              ownerId: row.ownerId,
              parentFolderId: row.folderId,
              name: row.name,
              createdAt: row.createdAt,
              updatedAt: row.updatedAt,
              deletedAt: row.deletedAt,
            })
          : toFileView({
              id: row.id,
              ownerId: row.ownerId,
              folderId: row.folderId,
              storageKey: "",
              name: row.name,
              contentType: row.contentType ?? "application/octet-stream",
              sizeBytes: row.sizeBytes ?? 0,
              createdAt: row.createdAt,
              updatedAt: row.updatedAt,
              deletedAt: row.deletedAt,
            }),
      );
      const last = page[page.length - 1];
      const next =
        visibleRows.length > limit && last
          ? { name: last.name, type: last.type, id: last.id }
          : hasMore
            ? scanCursor
            : null;

      return success({
        nodes,
        nextCursor: next ? encodeCursor(next) : null,
      });
    } catch {
      return failure("unavailable");
    }
  }

  return { search };
}
