import type {
  FilesItemRecord,
  FilesItemRepository,
} from "../../../application/ports/files-repositories.js";

const ITEM_COLUMNS =
  "id, owner_id AS ownerId, folder_id AS folderId, storage_key AS storageKey, " +
  "name, content_type AS contentType, size_bytes AS sizeBytes, " +
  "created_at AS createdAt, updated_at AS updatedAt, deleted_at AS deletedAt";

function boundedLimit(limit: number): number {
  if (!Number.isFinite(limit)) return 50;
  return Math.min(100, Math.max(1, Math.trunc(limit)));
}

export class D1FilesItemRepository implements FilesItemRepository {
  constructor(private readonly db: D1Database) {}

  findByIdForOwner(id: string, ownerId: string): Promise<FilesItemRecord | null> {
    return this.db
      .prepare(
        "SELECT " + ITEM_COLUMNS +
          " FROM files_items WHERE id = ? AND owner_id = ? LIMIT 1",
      )
      .bind(id, ownerId)
      .first<FilesItemRecord>();
  }

  async listByOwnerAndFolder(
    ownerId: string,
    folderId: string | null,
    limit: number,
  ): Promise<FilesItemRecord[]> {
    const result = await this.db
      .prepare(
        "SELECT " + ITEM_COLUMNS +
          " FROM files_items WHERE owner_id = ? AND folder_id IS ? " +
          "AND deleted_at IS NULL ORDER BY created_at DESC LIMIT ?",
      )
      .bind(ownerId, folderId, boundedLimit(limit))
      .all<FilesItemRecord>();
    return result.results;
  }

  async insert(item: FilesItemRecord): Promise<void> {
    await this.db
      .prepare(
        "INSERT INTO files_items " +
          "(id, owner_id, folder_id, storage_key, name, content_type, size_bytes, " +
          "created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        item.id,
        item.ownerId,
        item.folderId,
        item.storageKey,
        item.name,
        item.contentType,
        item.sizeBytes,
        item.createdAt,
        item.updatedAt,
        item.deletedAt,
      )
      .run();
  }

  async updateMetadata(
    id: string,
    ownerId: string,
    folderId: string | null,
    name: string,
    updatedAt: string,
  ): Promise<boolean> {
    const result = await this.db
      .prepare(
        "UPDATE files_items SET folder_id = ?, name = ?, updated_at = ? " +
          "WHERE id = ? AND owner_id = ? AND deleted_at IS NULL",
      )
      .bind(folderId, name, updatedAt, id, ownerId)
      .run();
    return result.meta.changes > 0;
  }

  async markDeleted(
    id: string,
    ownerId: string,
    deletedAt: string,
  ): Promise<boolean> {
    const result = await this.db
      .prepare(
        "UPDATE files_items SET deleted_at = ? " +
          "WHERE id = ? AND owner_id = ? AND deleted_at IS NULL",
      )
      .bind(deletedAt, id, ownerId)
      .run();
    return result.meta.changes > 0;
  }
}
