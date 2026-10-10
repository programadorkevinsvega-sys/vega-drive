import type {
  IdentityOutboxRecord,
  IdentityOutboxRepository,
} from "../../../application/ports/identity-repositories.js";

const OUTBOX_COLUMNS =
  "id, event_type AS eventType, payload_json AS payloadJson, " +
  "created_at AS createdAt, published_at AS publishedAt";

function boundedLimit(limit: number): number {
  if (!Number.isFinite(limit)) return 20;
  return Math.min(100, Math.max(1, Math.trunc(limit)));
}

export class D1IdentityOutboxRepository implements IdentityOutboxRepository {
  constructor(private readonly db: D1Database) {}

  async append(event: IdentityOutboxRecord): Promise<void> {
    await this.db
      .prepare(
        "INSERT INTO identity_outbox " +
          "(id, event_type, payload_json, created_at, published_at) " +
          "VALUES (?, ?, ?, ?, ?)",
      )
      .bind(
        event.id,
        event.eventType,
        event.payloadJson,
        event.createdAt,
        event.publishedAt,
      )
      .run();
  }

  async listUnpublished(limit: number): Promise<IdentityOutboxRecord[]> {
    const result = await this.db
      .prepare(
        "SELECT " + OUTBOX_COLUMNS +
          " FROM identity_outbox WHERE published_at IS NULL " +
          "ORDER BY created_at ASC LIMIT ?",
      )
      .bind(boundedLimit(limit))
      .all<IdentityOutboxRecord>();
    return result.results;
  }

  async markPublished(id: string, publishedAt: string): Promise<boolean> {
    const result = await this.db
      .prepare(
        "UPDATE identity_outbox SET published_at = ? " +
          "WHERE id = ? AND published_at IS NULL",
      )
      .bind(publishedAt, id)
      .run();
    return result.meta.changes > 0;
  }
}
