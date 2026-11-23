import type { ShareRecord, SharingRepository } from "../../../application/sharing-repository.js";
const COLUMNS = "id, owner_id AS ownerId, item_id AS itemId, token_hash AS tokenHash, password_salt AS passwordSalt, password_hash AS passwordHash, created_at AS createdAt, expires_at AS expiresAt, revoked_at AS revokedAt";
export class D1SharingRepository implements SharingRepository {
  constructor(private readonly db: D1Database) {}
  async create(record: ShareRecord, rateLimitSince: string): Promise<boolean> {
    const result = await this.db.prepare(
      "INSERT INTO sharing_links (id, owner_id, item_id, token_hash, password_salt, password_hash, created_at, expires_at, revoked_at) " +
      "SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM sharing_links WHERE owner_id = ? AND created_at >= ?) < 30"
    ).bind(record.id, record.ownerId, record.itemId, record.tokenHash, record.passwordSalt, record.passwordHash, record.createdAt, record.expiresAt, record.revokedAt, record.ownerId, rateLimitSince).run();
    return result.meta.changes > 0;
  }
  findByTokenHash(tokenHash: string): Promise<ShareRecord | null> {
    return this.db.prepare("SELECT " + COLUMNS + " FROM sharing_links WHERE token_hash = ? LIMIT 1").bind(tokenHash).first<ShareRecord>();
  }
  async listByOwner(ownerId: string, limit: number): Promise<ShareRecord[]> {
    const result = await this.db.prepare("SELECT " + COLUMNS + " FROM sharing_links WHERE owner_id = ? ORDER BY created_at DESC, id DESC LIMIT ?")
      .bind(ownerId, Math.min(100, Math.max(1, Math.trunc(limit)))).all<ShareRecord>();
    return result.results;
  }
  async revoke(id: string, ownerId: string, revokedAt: string): Promise<boolean> {
    const result = await this.db.prepare("UPDATE sharing_links SET revoked_at = ? WHERE id = ? AND owner_id = ? AND revoked_at IS NULL")
      .bind(revokedAt, id, ownerId).run();
    return result.meta.changes > 0;
  }
}