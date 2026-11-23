export interface ShareRecord {
  id: string;
  ownerId: string;
  itemId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
}
export interface SharingRepository {
  create(record: ShareRecord): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<ShareRecord | null>;
  listByOwner(ownerId: string, limit: number): Promise<ShareRecord[]>;
  revoke(id: string, ownerId: string, revokedAt: string): Promise<boolean>;
  countRecent(ownerId: string, since: string): Promise<number>;
}