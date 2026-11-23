import {
  failure,
  success,
  toFileView,
  type CatalogResult,
  type FilesActor,
  type FilesFileView,
} from "./catalog-contracts.js";
import type {
  FilesFavoritesCursor,
  FilesFavoritesRepository,
  FilesFolderRepository,
  FilesItemRepository,
} from "./ports/files-repositories.js";
import {
  hasValidActor,
  isValidCatalogId,
  parseCatalogLimit,
  parseSafeRecord,
} from "../domain/catalog-validation.js";
import { activeFolderPath } from "./catalog-service-utils.js";

export interface FilesFavoriteItem {
  file: FilesFileView;
  favoritedAt: string;
}
export interface FilesFavoritesListing {
  items: FilesFavoriteItem[];
  nextCursor: string | null;
}
interface FavoriteCursor extends FilesFavoritesCursor {}

export interface FavoritesDependencies {
  folders: FilesFolderRepository;
  items: FilesItemRepository;
  favorites: FilesFavoritesRepository;
  now?: () => Date;
}

function parseCursor(value: unknown): FavoriteCursor | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > 2048) return undefined;
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(value));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return undefined;
    const cursor = parsed as Record<string, unknown>;
    if (
      Object.keys(cursor).some(
        (key) => key !== "favoritedAt" && key !== "itemId",
      ) ||
      typeof cursor.favoritedAt !== "string" ||
      !Number.isFinite(Date.parse(cursor.favoritedAt)) ||
      !isValidCatalogId(cursor.itemId)
    )
      return undefined;
    return { favoritedAt: cursor.favoritedAt, itemId: cursor.itemId };
  } catch {
    return undefined;
  }
}
function encodeCursor(cursor: FavoriteCursor): string {
  return encodeURIComponent(JSON.stringify(cursor));
}

export function createFavorites(deps: FavoritesDependencies) {
  const now = deps.now ?? (() => new Date());

  async function add(
    actor: FilesActor,
    rawItemId: unknown,
  ): Promise<CatalogResult<{ favorited: true }>> {
    if (!hasValidActor(actor) || !isValidCatalogId(rawItemId))
      return failure("invalid-input");
    try {
      const file = await deps.items.findByIdForOwner(rawItemId, actor.userId);
      if (
        !file ||
        file.deletedAt !== null ||
        (file.folderId !== null &&
          !(await activeFolderPath(deps.folders, actor.userId, file.folderId)))
      ) {
        return failure("not-found");
      }
      await deps.favorites.add(actor.userId, file.id, now().toISOString());
      return success({ favorited: true });
    } catch {
      return failure("unavailable");
    }
  }

  async function remove(
    actor: FilesActor,
    rawItemId: unknown,
  ): Promise<CatalogResult<{ favorited: false }>> {
    if (!hasValidActor(actor) || !isValidCatalogId(rawItemId))
      return failure("invalid-input");
    try {
      await deps.favorites.remove(actor.userId, rawItemId);
      return success({ favorited: false });
    } catch {
      return failure("unavailable");
    }
  }

  async function list(
    actor: FilesActor,
    input: unknown,
  ): Promise<CatalogResult<FilesFavoritesListing>> {
    if (!hasValidActor(actor)) return failure("invalid-input");
    const value = parseSafeRecord(input, ["limit", "cursor"]);
    if (!value) return failure("invalid-input");
    const limit = parseCatalogLimit(value.limit);
    const cursor = parseCursor(value.cursor);
    if (limit === null || cursor === undefined) return failure("invalid-input");
    try {
      const rows = await deps.favorites.listByOwner(
        actor.userId,
        limit + 1,
        cursor,
      );
      const page = rows.slice(0, limit);
      const items: FilesFavoriteItem[] = [];
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
        )
          continue;
        items.push({ file: toFileView(file), favoritedAt: row.favoritedAt });
      }
      const last = page[page.length - 1];
      return success({
        items,
        nextCursor:
          rows.length > limit && last
            ? encodeCursor({
                favoritedAt: last.favoritedAt,
                itemId: last.itemId,
              })
            : null,
      });
    } catch {
      return failure("unavailable");
    }
  }

  return { addFavorite: add, removeFavorite: remove, listFavorites: list };
}
