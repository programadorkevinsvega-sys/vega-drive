import type {
  FilesSearchCursor,
  FilesSearchRecord,
  FilesSearchRepository,
  FilesSearchType,
} from "../../../application/ports/files-search-repository.js";

function boundedLimit(limit: number): number {
  if (!Number.isFinite(limit)) return 50;
  return Math.min(101, Math.max(1, Math.trunc(limit)));
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => "\\" + character);
}

export class D1FilesSearchRepository implements FilesSearchRepository {
  constructor(private readonly db: D1Database) {}

  async searchByOwner(
    ownerId: string,
    query: string,
    type: FilesSearchType,
    limit: number,
    cursor?: FilesSearchCursor | null,
  ): Promise<FilesSearchRecord[]> {
    const pattern = "%" + escapeLike(query) + "%";
    const typeFilter = type === "all" ? "" : " AND type = ?";
    const after = cursor
      ? " AND (lower(name) > lower(?) OR (lower(name) = lower(?) AND " +
        "(CASE type WHEN 'folder' THEN 0 ELSE 1 END > ? OR " +
        "((CASE type WHEN 'folder' THEN 0 ELSE 1 END) = ? AND id > ?))))"
      : "";
    const sql =
      "SELECT type, id, ownerId, folderId, name, sizeBytes, contentType, " +
      "createdAt, updatedAt, deletedAt FROM (" +
      "SELECT 'folder' AS type, id, owner_id AS ownerId, " +
      "parent_folder_id AS folderId, name, NULL AS sizeBytes, " +
      "NULL AS contentType, created_at AS createdAt, " +
      "updated_at AS updatedAt, deleted_at AS deletedAt " +
      "FROM files_folders WHERE owner_id = ? AND deleted_at IS NULL " +
      "AND lower(name) LIKE lower(?) ESCAPE '\\' UNION ALL " +
      "SELECT 'file' AS type, id, owner_id AS ownerId, " +
      "folder_id AS folderId, name, size_bytes AS sizeBytes, " +
      "content_type AS contentType, created_at AS createdAt, " +
      "updated_at AS updatedAt, deleted_at AS deletedAt " +
      "FROM files_items WHERE owner_id = ? AND deleted_at IS NULL " +
      "AND lower(name) LIKE lower(?) ESCAPE '\\'" +
      ") AS matches WHERE 1 = 1" +
      typeFilter +
      after +
      " ORDER BY lower(name) ASC, " +
      "CASE type WHEN 'folder' THEN 0 ELSE 1 END ASC, id ASC LIMIT ?";
    const bindings: unknown[] = [ownerId, pattern, ownerId, pattern];
    if (type !== "all") {
      bindings.push(type === "folders" ? "folder" : "file");
    }
    if (cursor) {
      bindings.push(
        cursor.name,
        cursor.name,
        cursor.type === "folder" ? 0 : 1,
        cursor.type === "folder" ? 0 : 1,
        cursor.id,
      );
    }
    bindings.push(boundedLimit(limit));
    const result = await this.db
      .prepare(sql)
      .bind(...bindings)
      .all<FilesSearchRecord>();
    return result.results;
  }
}
