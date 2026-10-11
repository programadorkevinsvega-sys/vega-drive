import type {
  FilesCatalogCursor,
  FilesItemRecord,
  FilesItemRepository,
  FilesTrashCursor,
} from "../../../application/ports/files-repositories.js";

const ITEM_COLUMNS =
  "id, owner_id AS ownerId, folder_id AS folderId, " +
  "storage_key AS storageKey, " +
  "name, content_type AS contentType, size_bytes AS sizeBytes, " +
  "created_at AS createdAt, updated_at AS updatedAt, deleted_at AS deletedAt";

function boundedLimit(limit: number): number {
  if (!Number.isFinite(limit)) return 50;
  return Math.min(100, Math.max(1, Math.trunc(limit)));
}

export class D1FilesItemRepository implements FilesItemRepository {
  constructor(private readonly db: D1Database) {}

  findByIdForOwner(
    id: string,
    ownerId: string,
  ): Promise<FilesItemRecord | null> {
    return this.db
      .prepare(
        "SELECT " +
          ITEM_COLUMNS +
          " FROM files_items WHERE id = ? AND owner_id = ? LIMIT 1",
      )
      .bind(id, ownerId)
      .first<FilesItemRecord>();
  }

  async findActiveByName(
    ownerId: string,
    folderId: string | null,
    name: string,
    exceptId?: string,
  ): Promise<boolean> {
    const exclusion = exceptId ? " AND id <> ?" : "";
    const statement = this.db.prepare(
      "SELECT id FROM files_items WHERE owner_id = ? " +
        "AND folder_id IS ? AND lower(name) = lower(?) " +
        "AND deleted_at IS NULL" +
        exclusion +
        " LIMIT 1",
    );
    const query = exceptId
      ? statement.bind(ownerId, folderId, name, exceptId)
      : statement.bind(ownerId, folderId, name);
    return Boolean(await query.first<{ id: string }>());
  }

  async listByOwnerAndFolder(
    ownerId: string,
    folderId: string | null,
    limit: number,
    cursor?: FilesCatalogCursor | null,
  ): Promise<FilesItemRecord[]> {
    const after = cursor
      ? " AND (lower(name) > lower(?) OR " +
        "(lower(name) = lower(?) AND (? = 'folder' OR " +
        "(? = 'file' AND id > ?))))"
      : "";
    const statement = this.db.prepare(
      "SELECT " +
        ITEM_COLUMNS +
        " FROM files_items WHERE owner_id = ? AND folder_id IS ? " +
        "AND deleted_at IS NULL" +
        after +
        " ORDER BY lower(name) ASC, id ASC LIMIT ?",
    );
    const query = cursor
      ? statement.bind(
          ownerId,
          folderId,
          cursor.name,
          cursor.name,
          cursor.type,
          cursor.type,
          cursor.id,
          boundedLimit(limit),
        )
      : statement.bind(ownerId, folderId, boundedLimit(limit));
    const result = await query.all<FilesItemRecord>();
    return result.results;
  }

  async listTrashByOwner(
    ownerId: string,
    limit: number,
    cursor?: FilesTrashCursor | null,
  ): Promise<FilesItemRecord[]> {
    const after = cursor
      ? " AND (deleted_at < ? OR " +
        "(deleted_at = ? AND (? = 'folder' OR " +
        "(? = 'file' AND id > ?))))"
      : "";
    const statement = this.db.prepare(
      "SELECT " +
        ITEM_COLUMNS +
        " FROM files_items WHERE owner_id = ? AND deleted_at IS NOT NULL" +
        after +
        " ORDER BY deleted_at DESC, id ASC LIMIT ?",
    );
    const query = cursor
      ? statement.bind(
          ownerId,
          cursor.deletedAt,
          cursor.deletedAt,
          cursor.type,
          cursor.type,
          cursor.id,
          boundedLimit(limit),
        )
      : statement.bind(ownerId, boundedLimit(limit));
    const result = await query.all<FilesItemRecord>();
    return result.results;
  }

  async listExpiredTrash(
    cutoff: string,
    limit: number,
  ): Promise<FilesItemRecord[]> {
    const result = await this.db
      .prepare(
        "SELECT " +
          ITEM_COLUMNS +
          " FROM files_items WHERE deleted_at IS NOT NULL AND deleted_at <= ? " +
          "ORDER BY deleted_at ASC, id ASC LIMIT ?",
      )
      .bind(cutoff, boundedLimit(limit))
      .all<FilesItemRecord>();
    return result.results;
  }

  async listByFolderIds(
    ownerId: string,
    folderIds: string[],
    limit: number,
  ): Promise<FilesItemRecord[]> {
    const items: FilesItemRecord[] = [];
    const max = boundedLimit(limit);
    for (
      let offset = 0;
      offset < folderIds.length && items.length < max;
      offset += 80
    ) {
      const chunk = folderIds.slice(offset, offset + 80);
      const remaining = max - items.length;
      const placeholders = chunk.map(() => "?").join(", ");
      const result = await this.db
        .prepare(
          "SELECT " +
            ITEM_COLUMNS +
            " FROM files_items WHERE owner_id = ? AND folder_id IN (" +
            placeholders +
            ") ORDER BY id ASC LIMIT ?",
        )
        .bind(ownerId, ...chunk, remaining)
        .all<FilesItemRecord>();
      items.push(...result.results);
    }
    return items;
  }

  async insert(item: FilesItemRecord): Promise<void> {
    await this.db
      .prepare(
        "INSERT INTO files_items " +
          "(id, owner_id, folder_id, storage_key, name, content_type, " +
          "size_bytes, " +
          "created_at, updated_at, deleted_at) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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

  async deletePermanently(id: string, ownerId: string): Promise<boolean> {
    return (
      (
        await this.db
          .prepare("DELETE FROM files_items WHERE id = ? AND owner_id = ?")
          .bind(id, ownerId)
          .run()
      ).meta.changes > 0
    );
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
        "UPDATE files_items SET deleted_at = ?, updated_at = ? " +
          "WHERE id = ? AND owner_id = ? AND deleted_at IS NULL",
      )
      .bind(deletedAt, deletedAt, id, ownerId)
      .run();
    return result.meta.changes > 0;
  }

  async restore(
    id: string,
    ownerId: string,
    expectedDeletedAt: string,
    updatedAt: string,
  ): Promise<boolean> {
    const result = await this.db
      .prepare(
        "UPDATE files_items SET deleted_at = NULL, updated_at = ? " +
          "WHERE id = ? AND owner_id = ? AND deleted_at = ?",
      )
      .bind(updatedAt, id, ownerId, expectedDeletedAt)
      .run();
    return result.meta.changes > 0;
  }
}
