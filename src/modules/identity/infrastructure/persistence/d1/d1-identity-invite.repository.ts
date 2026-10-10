import type {
  IdentityInviteRecord,
  IdentityInviteRepository,
} from "../../../application/ports/identity-repositories.js";

const INVITE_COLUMNS =
  "id, token_hash AS tokenHash, created_by_user_id AS createdByUserId, " +
  "created_at AS createdAt, expires_at AS expiresAt, used_at AS usedAt";

export class D1IdentityInviteRepository implements IdentityInviteRepository {
  constructor(private readonly db: D1Database) {}

  findByTokenHash(tokenHash: string): Promise<IdentityInviteRecord | null> {
    return this.db
      .prepare(
        "SELECT " + INVITE_COLUMNS +
          " FROM identity_invites WHERE token_hash = ? LIMIT 1",
      )
      .bind(tokenHash)
      .first<IdentityInviteRecord>();
  }

  async insert(invite: IdentityInviteRecord): Promise<void> {
    await this.db
      .prepare(
        "INSERT INTO identity_invites " +
          "(id, token_hash, created_by_user_id, created_at, expires_at, used_at) " +
          "VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(
        invite.id,
        invite.tokenHash,
        invite.createdByUserId,
        invite.createdAt,
        invite.expiresAt,
        invite.usedAt,
      )
      .run();
  }

  async consume(tokenHash: string, now: string): Promise<boolean> {
    const result = await this.db
      .prepare(
        "UPDATE identity_invites SET used_at = ? " +
          "WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?",
      )
      .bind(now, tokenHash, now)
      .run();
    return result.meta.changes > 0;
  }
}
