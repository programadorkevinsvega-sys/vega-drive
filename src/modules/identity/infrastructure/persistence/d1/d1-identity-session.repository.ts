import type {
  IdentitySessionRecord,
  IdentitySessionRepository,
} from "../../../application/ports/identity-repositories.js";

const SESSION_COLUMNS =
  "id, user_id AS userId, token_hash AS tokenHash, created_at AS createdAt, " +
  "last_seen_at AS lastSeenAt, expires_at AS expiresAt, revoked_at AS revokedAt";

export class D1IdentitySessionRepository implements IdentitySessionRepository {
  constructor(private readonly db: D1Database) {}

  findByTokenHash(tokenHash: string): Promise<IdentitySessionRecord | null> {
    return this.db
      .prepare(
        "SELECT " +
          SESSION_COLUMNS +
          " FROM identity_sessions WHERE token_hash = ? LIMIT 1",
      )
      .bind(tokenHash)
      .first<IdentitySessionRecord>();
  }

  async insert(session: IdentitySessionRecord): Promise<void> {
    await this.db
      .prepare(
        "INSERT INTO identity_sessions " +
          "(id, user_id, token_hash, created_at, last_seen_at, expires_at, revoked_at) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        session.id,
        session.userId,
        session.tokenHash,
        session.createdAt,
        session.lastSeenAt,
        session.expiresAt,
        session.revokedAt,
      )
      .run();
  }

  async revokeForUser(
    sessionId: string,
    userId: string,
    revokedAt: string,
  ): Promise<boolean> {
    const result = await this.db
      .prepare(
        "UPDATE identity_sessions SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL",
      )
      .bind(revokedAt, sessionId, userId)
      .run();
    return result.meta.changes > 0;
  }

  async revokeOtherSessions(
    userId: string,
    exceptSessionId: string,
    revokedAt: string,
  ): Promise<void> {
    await this.db
      .prepare(
        "UPDATE identity_sessions SET revoked_at = ? WHERE user_id = ? AND id <> ? AND revoked_at IS NULL",
      )
      .bind(revokedAt, userId, exceptSessionId)
      .run();
  }

  async touch(sessionId: string, lastSeenAt: string): Promise<void> {
    await this.db
      .prepare(
        "UPDATE identity_sessions SET last_seen_at = ? WHERE id = ? AND revoked_at IS NULL",
      )
      .bind(lastSeenAt, sessionId)
      .run();
  }
}
