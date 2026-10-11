import type {
  FilesCatalogCursor,
  FilesFolderRecord,
  FilesFolderRepository,
  FilesTrashCursor,
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

  async findActiveByName(
    ownerId: string,
    parentFolderId: string | null,
    name: string,
    exceptId?: string,
  ): Promise<boolean> {
    const exclusion = exceptId ? " AND id <> ?" : "";
    const statement = this.db.prepare(
      "SELECT id FROM files_folders WHERE owner_id = ? " +
        "AND parent_folder_id IS ? AND lower(name) = lower(?) " +
        "AND deleted_at IS NULL" +
        exclusion +
        " LIMIT 1",
    );
    const query = exceptId
      ? statement.bind(ownerId, parentFolderId, name, exceptId)
      : statement.bind(ownerId, parentFolderId, name);
    return Boolean(await query.first<{ id: string }>());
  }

  async listChildren(
    ownerId: string,
    parentFolderId: string | null,
    limit: number,
    cursor?: FilesCatalogCursor | null,
  ): Promise<FilesFolderRecord[]> {
    const after = cursor
      ? " AND (lower(name) > lower(?) OR " +
        "(lower(name) = lower(?) AND ? = 'folder' AND id > ?))"
      : "";
    const statement = this.db.prepare(
      "SELECT " +
        FOLDER_COLUMNS +
        " FROM files_folders WHERE owner_id = ? AND parent_folder_id IS ? " +
        "AND deleted_at IS NULL" +
        after +
        " ORDER BY lower(name) ASC, id ASC LIMIT ?",
    );
    const query = cursor
      ? statement.bind(
          ownerId,
          parentFolderId,
          cursor.name,
          cursor.name,
          cursor.type,
          cursor.id,
          boundedLimit(limit),
        )
      : statement.bind(ownerId, parentFolderId, boundedLimit(limit));
    const result = await query.all<FilesFolderRecord>();
    return result.results;
  }

  async listTrashByOwner(
    ownerId: string,
    limit: number,
    cursor?: FilesTrashCursor | null,
  ): Promise<FilesFolderRecord[]> {
    const after = cursor
      ? " AND (deleted_at < ? OR " +
        "(deleted_at = ? AND ? = 'folder' AND id > ?))"
      : "";
    const statement = this.db.prepare(
      "SELECT " +
        FOLDER_COLUMNS +
        " FROM files_folders WHERE owner_id = ? AND deleted_at IS NOT NULL" +
        after +
        " ORDER BY deleted_at DESC, id ASC LIMIT ?",
    );
    const query = cursor
      ? statement.bind(
          ownerId,
          cursor.deletedAt,
          cursor.deletedAt,
          cursor.type,
          cursor.id,
          boundedLimit(limit),
        )
      : statement.bind(ownerId, boundedLimit(limit));
    const result = await query.all<FilesFolderRecord>();
    return result.results;
  }

  async listExpiredTrash(
    cutoff: string,
    limit: number,
  ): Promise<FilesFolderRecord[]> {
    const result = await this.db
      .prepare(
        "SELECT " +
          FOLDER_COLUMNS +
          " FROM files_folders WHERE deleted_at IS NOT NULL AND deleted_at <= ? " +
          "ORDER BY deleted_at ASC, id ASC LIMIT ?",
      )
      .bind(cutoff, boundedLimit(limit))
      .all<FilesFolderRecord>();
    return result.results;
  }

  async listDescendants(
    ownerId: string,
    parentFolderId: string,
  ): Promise<FilesFolderRecord[]> {
    const descendants: Array<{ folder: FilesFolderRecord; depth: number }> = [];
    const visited = new Set<string>([parentFolderId]);
    let parentIds = [parentFolderId];
    let depth = 1;

    while (parentIds.length > 0) {
      const nextParents: string[] = [];
      for (let offset = 0; offset < parentIds.length; offset += 80) {
        const parentChunk = parentIds.slice(offset, offset + 80);
        const placeholders = parentChunk.map(() => "?").join(", ");
        const result = await this.db
          .prepare(
            "SELECT " +
              FOLDER_COLUMNS +
              " FROM files_folders WHERE owner_id = ? " +
              "AND parent_folder_id IN (" +
              placeholders +
              ")",
          )
          .bind(ownerId, ...parentChunk)
          .all<FilesFolderRecord>();

        for (const folder of result.results) {
          if (visited.has(folder.id)) continue;
          visited.add(folder.id);
          descendants.push({ folder, depth });
          nextParents.push(folder.id);
        }
      }
      parentIds = nextParents;
      depth += 1;
    }

    return descendants
      .sort((a, b) => b.depth - a.depth || a.folder.id.localeCompare(b.folder.id))
      .map(({ folder }) => folder);
  }

  async deletePermanently(id: string, ownerId: string): Promise<boolean> {
    const result = await this.db
      .prepare("DELETE FROM files_folders WHERE id = ? AND owner_id = ?")
      .bind(id, ownerId)
      .run();
    return result.meta.changes > 0;
  }

  async insert(folder: FilesFolderRecord): Promise<void> {
    await this.db
      .prepare(
        "INSERT INTO files_folders " +
          "(id, owner_id, parent_folder_id, name, created_at, updated_at, " +
          "deleted_at) " +
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
        "UPDATE files_folders SET parent_folder_id = ?, name = ?, " +
          "updated_at = ? " +
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
        "UPDATE files_folders SET deleted_at = ?, updated_at = ? " +
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
        "UPDATE files_folders SET deleted_at = NULL, updated_at = ? " +
          "WHERE id = ? AND owner_id = ? AND deleted_at = ?",
      )
      .bind(updatedAt, id, ownerId, expectedDeletedAt)
      .run();
    return result.meta.changes > 0;
  }
}
