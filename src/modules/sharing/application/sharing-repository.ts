export interface ShareRecord {
  id: string;
  ownerId: string;
  itemId: string;
  tokenHash: string;
  passwordSalt: string | null;
  passwordHash: string | null;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
}
export interface SharingRepository {
  create(record: ShareRecord, rateLimitSince: string): Promise<boolean>;
  findByTokenHash(tokenHash: string): Promise<ShareRecord | null>;
  listByOwner(ownerId: string, limit: number): Promise<ShareRecord[]>;
  revoke(id: string, ownerId: string, revokedAt: string): Promise<boolean>;
  consumePasswordAttempt(
    tokenHash: string,
    occurredAt: string,
    windowStart: string,
  ): Promise<boolean>;
}
