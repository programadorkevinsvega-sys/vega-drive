import type {
  FilesFavoritesCursor,
  FilesFavoritesRecord,
  FilesFavoritesRepository,
} from "../../../application/ports/files-repositories.js";

function boundedLimit(limit: number): number {
  if (!Number.isFinite(limit)) return 50;
  return Math.min(101, Math.max(1, Math.trunc(limit)));
}

export class D1FilesFavoritesRepository implements FilesFavoritesRepository {
  constructor(private readonly db: D1Database) {}

  async add(
    ownerId: string,
    itemId: string,
    favoritedAt: string,
  ): Promise<void> {
    await this.db
      .prepare(
        "INSERT INTO files_favorites (owner_id, item_id, favorited_at) " +
          "VALUES (?, ?, ?) ON CONFLICT(owner_id, item_id) DO NOTHING",
      )
      .bind(ownerId, itemId, favoritedAt)
      .run();
  }

  async remove(ownerId: string, itemId: string): Promise<boolean> {
    const result = await this.db
      .prepare("DELETE FROM files_favorites WHERE owner_id = ? AND item_id = ?")
      .bind(ownerId, itemId)
      .run();
    return result.meta.changes > 0;
  }

  async listByOwner(
    ownerId: string,
    limit: number,
    cursor?: FilesFavoritesCursor | null,
  ): Promise<FilesFavoritesRecord[]> {
    const after = cursor
      ? " AND (favorited_at < ? OR (favorited_at = ? AND item_id < ?))"
      : "";
    const statement = this.db.prepare(
      "SELECT item_id AS itemId, favorited_at AS favoritedAt " +
        "FROM files_favorites WHERE owner_id = ?" +
        after +
        " ORDER BY favorited_at DESC, item_id DESC LIMIT ?",
    );
    const query = cursor
      ? statement.bind(
          ownerId,
          cursor.favoritedAt,
          cursor.favoritedAt,
          cursor.itemId,
          boundedLimit(limit),
        )
      : statement.bind(ownerId, boundedLimit(limit));
    const result = await query.all<FilesFavoritesRecord>();
    return result.results;
  }
}
