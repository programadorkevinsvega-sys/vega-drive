import type {
  FilesUploadRecord,
  FilesUploadRepository,
} from "../../../application/ports/files-repositories.js";

const UPLOAD_COLUMNS =
  "id, owner_id AS ownerId, item_id AS itemId, storage_key AS storageKey, " +
  "expected_size_bytes AS expectedSizeBytes, content_type AS contentType, status, " +
  "created_at AS createdAt, expires_at AS expiresAt, completed_at AS completedAt";

export class D1FilesUploadRepository implements FilesUploadRepository {
  constructor(private readonly db: D1Database) {}

  findByIdForOwner(
    id: string,
    ownerId: string,
  ): Promise<FilesUploadRecord | null> {
    return this.db
      .prepare(
        "SELECT " +
          UPLOAD_COLUMNS +
          " FROM files_uploads WHERE id = ? AND owner_id = ? LIMIT 1",
      )
      .bind(id, ownerId)
      .first<FilesUploadRecord>();
  }

  async insert(upload: FilesUploadRecord): Promise<void> {
    await this.db
      .prepare(
        "INSERT INTO files_uploads " +
          "(id, owner_id, item_id, storage_key, expected_size_bytes, content_type, " +
          "status, created_at, expires_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        upload.id,
        upload.ownerId,
        upload.itemId,
        upload.storageKey,
        upload.expectedSizeBytes,
        upload.contentType,
        upload.status,
        upload.createdAt,
        upload.expiresAt,
        upload.completedAt,
      )
      .run();
  }

  async updateStatus(
    id: string,
    ownerId: string,
    status: FilesUploadRecord["status"],
    completedAt: string | null,
  ): Promise<boolean> {
    const result = await this.db
      .prepare(
        "UPDATE files_uploads SET status = ?, completed_at = ? " +
          "WHERE id = ? AND owner_id = ?",
      )
      .bind(status, completedAt, id, ownerId)
      .run();
    return result.meta.changes > 0;
  }
}
