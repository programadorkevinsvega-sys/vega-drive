import type {
  FilesRecentActivityCursor,
  FilesRecentActivityKind,
  FilesRecentActivityRecord,
  FilesRecentActivityRepository,
} from "../../../application/ports/files-repositories.js";

function boundedLimit(limit: number): number {
  if (!Number.isFinite(limit)) return 50;
  return Math.min(101, Math.max(1, Math.trunc(limit)));
}

export class D1FilesRecentActivityRepository
  implements FilesRecentActivityRepository
{
  constructor(private readonly db: D1Database) {}

  async record(
    ownerId: string,
    itemId: string,
    activityType: FilesRecentActivityKind,
    occurredAt: string,
  ): Promise<void> {
    await this.db
      .prepare(
        "INSERT INTO files_recent_activity " +
          "(owner_id, item_id, activity_type, occurred_at) " +
          "VALUES (?, ?, ?, ?) ON CONFLICT(owner_id, item_id) " +
          "DO UPDATE SET activity_type = excluded.activity_type, " +
          "occurred_at = excluded.occurred_at " +
          "WHERE excluded.occurred_at >= files_recent_activity.occurred_at",
      )
      .bind(ownerId, itemId, activityType, occurredAt)
      .run();
  }

  async listByOwner(
    ownerId: string,
    limit: number,
    cursor?: FilesRecentActivityCursor | null,
  ): Promise<FilesRecentActivityRecord[]> {
    const after = cursor
      ? " AND (occurred_at < ? OR (occurred_at = ? AND item_id < ?))"
      : "";
    const statement = this.db.prepare(
      "SELECT item_id AS itemId, activity_type AS activityType, " +
        "occurred_at AS occurredAt FROM files_recent_activity " +
        "WHERE owner_id = ?" +
        after +
        " ORDER BY occurred_at DESC, item_id DESC LIMIT ?",
    );
    const query = cursor
      ? statement.bind(
          ownerId,
          cursor.occurredAt,
          cursor.occurredAt,
          cursor.itemId,
          boundedLimit(limit),
        )
      : statement.bind(ownerId, boundedLimit(limit));
    const result = await query.all<FilesRecentActivityRecord>();
    return result.results;
  }
}
