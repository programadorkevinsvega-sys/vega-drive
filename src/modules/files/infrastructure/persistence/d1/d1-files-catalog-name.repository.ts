import type {
  FilesCatalogNameClaim,
  FilesCatalogNameRepository,
} from "../../../application/ports/files-repositories.js";

function parentKey(parentFolderId: string | null): string {
  return parentFolderId ?? "";
}

function nameKey(name: string): string {
  return name.normalize("NFC").toLowerCase();
}

export class D1FilesCatalogNameRepository
  implements FilesCatalogNameRepository
{
  constructor(private readonly db: D1Database) {}

  async claim(input: FilesCatalogNameClaim): Promise<boolean> {
    const result = await this.db
      .prepare(
        "INSERT INTO files_catalog_names " +
          "(owner_id, parent_key, name_key, node_type, node_id) " +
          "VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING",
      )
      .bind(
        input.ownerId,
        parentKey(input.parentFolderId),
        nameKey(input.name),
        input.nodeType,
        input.nodeId,
      )
      .run();
    return result.meta.changes > 0;
  }

  async set(input: FilesCatalogNameClaim): Promise<boolean> {
    const updated = await this.db
      .prepare(
        "UPDATE files_catalog_names SET parent_key = ?, name_key = ? " +
          "WHERE owner_id = ? AND node_type = ? AND node_id = ?",
      )
      .bind(
        parentKey(input.parentFolderId),
        nameKey(input.name),
        input.ownerId,
        input.nodeType,
        input.nodeId,
      )
      .run();
    if (updated.meta.changes > 0) return true;
    return this.claim(input);
  }

  async release(
    ownerId: string,
    nodeType: FilesCatalogNameClaim["nodeType"],
    nodeId: string,
  ): Promise<void> {
    await this.db
      .prepare(
        "DELETE FROM files_catalog_names " +
          "WHERE owner_id = ? AND node_type = ? AND node_id = ?",
      )
      .bind(ownerId, nodeType, nodeId)
      .run();
  }
}
