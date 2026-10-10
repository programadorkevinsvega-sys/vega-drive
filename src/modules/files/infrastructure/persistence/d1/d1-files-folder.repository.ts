import type {
  FilesFolderRecord,
  FilesFolderRepository,
} from "../../../application/ports/files-repositories.js";

const FOLDER_COLUMNS =
  "id, owner_id AS ownerId, parent_folder_id AS parentFolderId, name, " +
  "created_at AS createdAt, updated_at AS updatedAt, deleted_at AS deletedAt";

function boundedLimit(limit: number): number {
  if (!Number.isFinite(limit)) return 50;
  return Math.min(100, Math.max(1, Math.trunc(limit)));
}

export class D1FilesFolderRepository implements FilesFolderRepository {
  constructor(private readonly db: D1Database) {}

  findByIdForOwner(
    id: string,
    ownerId: string,
  ): Promise<FilesFolderRecord | null> {
    return this.db
      .prepare(
        "SELECT " +
          FOLDER_COLUMNS +
          " FROM files_folders WHERE id = ? AND owner_id = ? LIMIT 1",
      )
      .bind(id, ownerId)
      .first<FilesFolderRecord>();
  }

  async listChildren(
    ownerId: string,
    parentFolderId: string | null,
    limit: number,
  ): Promise<FilesFolderRecord[]> {
    const result = await this.db
      .prepare(
        "SELECT " + FOLDER_COLUMNS +
          " FROM files_folders WHERE owner_id = ? AND parent_folder_id IS ? " +
          "AND deleted_at IS NULL ORDER BY name ASC LIMIT ?",
      )
      .bind(ownerId, parentFolderId, boundedLimit(limit))
      .all<FilesFolderRecord>();
    return result.results;
  }

  async insert(folder: FilesFolderRecord): Promise<void> {
    await this.db
      .prepare(
        "INSERT INTO files_folders " +
          "(id, owner_id, parent_folder_id, name, created_at, updated_at, deleted_at) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        folder.id,
        folder.ownerId,
        folder.parentFolderId,
        folder.name,
        folder.createdAt,
        folder.updatedAt,
        folder.deletedAt,
      )
      .run();
  }

  async updateMetadata(
    id: string,
    ownerId: string,
    parentFolderId: string | null,
    name: string,
    updatedAt: string,
  ): Promise<boolean> {
    const result = await this.db
      .prepare(
        "UPDATE files_folders SET parent_folder_id = ?, name = ?, updated_at = ? " +
          "WHERE id = ? AND owner_id = ? AND deleted_at IS NULL",
      )
      .bind(parentFolderId, name, updatedAt, id, ownerId)
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
        "UPDATE files_folders SET deleted_at = ? " +
          "WHERE id = ? AND owner_id = ? AND deleted_at IS NULL",
      )
      .bind(deletedAt, id, ownerId)
      .run();
    return result.meta.changes > 0;
  }
}
