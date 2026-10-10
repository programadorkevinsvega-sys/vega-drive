import type {
  IdentityUserRecord,
  IdentityUserRepository,
} from "../../../application/ports/identity-repositories.js";

const USER_COLUMNS =
  "id, email, password_hash AS passwordHash, password_salt AS passwordSalt, " +
  "created_at AS createdAt, updated_at AS updatedAt, disabled_at AS disabledAt";

export class D1IdentityUserRepository implements IdentityUserRepository {
  constructor(private readonly db: D1Database) {}

  findById(id: string): Promise<IdentityUserRecord | null> {
    return this.db
      .prepare(
        "SELECT " +
          USER_COLUMNS +
          " FROM identity_users WHERE id = ? LIMIT 1",
      )
      .bind(id)
      .first<IdentityUserRecord>();
  }

  findByNormalizedEmail(email: string): Promise<IdentityUserRecord | null> {
    return this.db
      .prepare(
        "SELECT " +
          USER_COLUMNS +
          " FROM identity_users WHERE email = ? LIMIT 1",
      )
      .bind(email)
      .first<IdentityUserRecord>();
  }

  async insert(user: IdentityUserRecord): Promise<void> {
    await this.db
      .prepare(
        "INSERT INTO identity_users " +
          "(id, email, password_hash, password_salt, created_at, updated_at, disabled_at) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        user.id,
        user.email,
        user.passwordHash,
        user.passwordSalt,
        user.createdAt,
        user.updatedAt,
        user.disabledAt,
      )
      .run();
  }

  async insertWithinLimit(
    user: IdentityUserRecord,
    maxUsers: number,
  ): Promise<boolean> {
    if (!Number.isInteger(maxUsers) || maxUsers < 1 || maxUsers > 10) {
      return false;
    }
    const result = await this.db
      .prepare(
        "INSERT INTO identity_users " +
          "(id, email, password_hash, password_salt, created_at, updated_at, disabled_at) " +
          "SELECT ?, ?, ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM identity_users) < ?",
      )
      .bind(
        user.id,
        user.email,
        user.passwordHash,
        user.passwordSalt,
        user.createdAt,
        user.updatedAt,
        user.disabledAt,
        maxUsers,
      )
      .run();
    return result.meta.changes > 0;
  }

  async updatePassword(
    userId: string,
    passwordHash: string,
    passwordSalt: string,
    updatedAt: string,
  ): Promise<boolean> {
    const result = await this.db
      .prepare(
        "UPDATE identity_users SET password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ? AND disabled_at IS NULL",
      )
      .bind(passwordHash, passwordSalt, updatedAt, userId)
      .run();
    return result.meta.changes > 0;
  }
}
