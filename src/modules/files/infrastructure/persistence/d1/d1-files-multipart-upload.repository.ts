import type {
  FilesMultipartPart,
  FilesMultipartSession,
  FilesMultipartUploadRepository,
} from "../../../application/ports/files-multipart-repository.js";

const SESSION_COLUMNS =
  "id, owner_id AS ownerId, reservation_id AS reservationId, " +
  "item_id AS itemId, folder_id AS folderId, name, storage_key AS storageKey, " +
  "r2_upload_id AS r2UploadId, expected_size_bytes AS expectedSizeBytes, " +
  "content_type AS contentType, created_at AS createdAt, expires_at AS expiresAt";

export class D1FilesMultipartUploadRepository implements FilesMultipartUploadRepository {
  constructor(private readonly db: D1Database) {}

  async insert(session: FilesMultipartSession): Promise<void> {
    await this.db
      .prepare(
        "INSERT INTO files_multipart_uploads " +
          "(id, owner_id, reservation_id, item_id, folder_id, name, storage_key, " +
          "r2_upload_id, expected_size_bytes, content_type, created_at, expires_at) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        session.id,
        session.ownerId,
        session.reservationId,
        session.itemId,
        session.folderId,
        session.name,
        session.storageKey,
        session.r2UploadId,
        session.expectedSizeBytes,
        session.contentType,
        session.createdAt,
        session.expiresAt,
      )
      .run();
  }

  findByIdForOwner(
    id: string,
    ownerId: string,
  ): Promise<FilesMultipartSession | null> {
    return this.db
      .prepare(
        "SELECT " +
          SESSION_COLUMNS +
          " FROM files_multipart_uploads WHERE id = ? AND owner_id = ? LIMIT 1",
      )
      .bind(id, ownerId)
      .first<FilesMultipartSession>();
  }

  findAbandonedUnstartedForOwnerAndName(
    ownerId: string,
    folderId: string | null,
    name: string,
    createdBefore: string,
  ): Promise<FilesMultipartSession | null> {
    return this.db
      .prepare(
        "SELECT " +
          SESSION_COLUMNS +
          " FROM files_multipart_uploads " +
          "WHERE owner_id = ? AND COALESCE(folder_id, '') = COALESCE(?, '') " +
          "AND lower(name) = lower(?) AND created_at <= ? " +
          "AND r2_upload_id != 'direct-put' " +
          "AND NOT EXISTS (SELECT 1 FROM files_multipart_parts " +
          "WHERE session_id = files_multipart_uploads.id) " +
          "ORDER BY created_at ASC LIMIT 1",
      )
      .bind(ownerId, folderId, name, createdBefore)
      .first<FilesMultipartSession>();
  }

  async savePart(part: FilesMultipartPart): Promise<void> {
    await this.db
      .prepare(
        "INSERT INTO files_multipart_parts (session_id, part_number, etag, size_bytes) " +
          "VALUES (?, ?, ?, ?) ON CONFLICT(session_id, part_number) DO UPDATE SET " +
          "etag = excluded.etag, size_bytes = excluded.size_bytes",
      )
      .bind(part.sessionId, part.partNumber, part.etag, part.sizeBytes)
      .run();
  }

  listParts(sessionId: string): Promise<FilesMultipartPart[]> {
    return this.db
      .prepare(
        "SELECT session_id AS sessionId, part_number AS partNumber, etag, " +
          "size_bytes AS sizeBytes FROM files_multipart_parts " +
          "WHERE session_id = ? ORDER BY part_number ASC",
      )
      .bind(sessionId)
      .all<FilesMultipartPart>()
      .then((result) => result.results);
  }

  async delete(id: string, ownerId: string): Promise<boolean> {
    await this.db
      .prepare("DELETE FROM files_multipart_parts WHERE session_id = ?")
      .bind(id)
      .run();
    const result = await this.db
      .prepare(
        "DELETE FROM files_multipart_uploads WHERE id = ? AND owner_id = ?",
      )
      .bind(id, ownerId)
      .run();
    return result.meta.changes > 0;
  }

  listExpired(now: string, limit: number): Promise<FilesMultipartSession[]> {
    return this.db
      .prepare(
        "SELECT " +
          SESSION_COLUMNS +
          " FROM files_multipart_uploads WHERE expires_at <= ? " +
          "ORDER BY created_at ASC LIMIT ?",
      )
      .bind(now, Math.min(100, Math.max(1, Math.trunc(limit))))
      .all<FilesMultipartSession>()
      .then((result) => result.results);
  }
}
