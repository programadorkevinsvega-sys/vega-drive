export interface IdentityUserRecord {
  id: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
  updatedAt: string;
  disabledAt: string | null;
}

export interface IdentityUserRepository {
  findById(id: string): Promise<IdentityUserRecord | null>;
  findByNormalizedEmail(email: string): Promise<IdentityUserRecord | null>;
  insert(user: IdentityUserRecord): Promise<void>;
  insertWithinLimit(user: IdentityUserRecord, maxUsers: number): Promise<boolean>;
}

/** Session ownership comes from trusted server-side identity resolution. */
export interface IdentitySessionRecord {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  revokedAt: string | null;
}

export interface IdentitySessionRepository {
  findByTokenHash(tokenHash: string): Promise<IdentitySessionRecord | null>;
  insert(session: IdentitySessionRecord): Promise<void>;
  revokeForUser(
    sessionId: string,
    userId: string,
    revokedAt: string,
  ): Promise<boolean>;
}

export interface IdentityInviteRecord {
  id: string;
  tokenHash: string;
  createdByUserId: string | null;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
}

export interface IdentityInviteRepository {
  findByTokenHash(tokenHash: string): Promise<IdentityInviteRecord | null>;
  insert(invite: IdentityInviteRecord): Promise<void>;
  consume(tokenHash: string, now: string): Promise<boolean>;
}

export interface IdentityOutboxRecord {
  id: string;
  eventType: string;
  payloadJson: string;
  createdAt: string;
  publishedAt: string | null;
}

export interface IdentityOutboxRepository {
  append(event: IdentityOutboxRecord): Promise<void>;
  listUnpublished(limit: number): Promise<IdentityOutboxRecord[]>;
  markPublished(id: string, publishedAt: string): Promise<boolean>;
}
