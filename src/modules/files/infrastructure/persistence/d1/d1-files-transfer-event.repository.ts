import type {
  FilesTransferEventRepository,
  FilesTransferKind,
} from "../../../application/ports/files-repositories.js";

export class D1FilesTransferEventRepository
  implements FilesTransferEventRepository
{
  constructor(private readonly db: D1Database) {}

  async consume(
    id: string,
    ownerId: string,
    kind: FilesTransferKind,
    occurredAt: string,
    windowStart: string,
    limit: number,
  ): Promise<boolean> {
    const result = await this.db
      .prepare(
        "INSERT INTO files_transfer_events (id, owner_id, event_type, occurred_at) " +
          "SELECT ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM files_transfer_events " +
          "WHERE owner_id = ? AND event_type = ? AND occurred_at >= ?) < ?",
      )
      .bind(
        id,
        ownerId,
        kind,
        occurredAt,
        ownerId,
        kind,
        windowStart,
        Math.min(1000, Math.max(1, Math.trunc(limit))),
      )
      .run();
    return result.meta.changes > 0;
  }

  async cleanupBefore(cutoff: string, limit: number): Promise<void> {
    await this.db
      .prepare(
        "DELETE FROM files_transfer_events WHERE id IN (" +
          "SELECT id FROM files_transfer_events WHERE occurred_at < ? " +
          "ORDER BY occurred_at ASC LIMIT ?)",
      )
      .bind(cutoff, Math.min(1000, Math.max(1, Math.trunc(limit))))
      .run();
  }
}
