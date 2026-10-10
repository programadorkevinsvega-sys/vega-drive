import type {
  AuthAttemptState,
  IdentityAuthAttemptRepository,
} from "../../../application/ports/identity-repositories.js";

interface AuthAttemptRow {
  failedAttempts: number;
  windowStartedAt: number;
  lockedUntil: number | null;
}

export class D1IdentityAuthAttemptRepository
  implements IdentityAuthAttemptRepository
{
  constructor(private readonly db: D1Database) {}

  async find(
    keyHash: string,
    now: number,
    windowMs: number,
  ): Promise<AuthAttemptState | null> {
    const row = await this.db
      .prepare(
        "SELECT failed_attempts AS failedAttempts, window_started_at AS windowStartedAt, locked_until AS lockedUntil FROM identity_auth_attempts WHERE key_hash = ? LIMIT 1",
      )
      .bind(keyHash)
      .first<AuthAttemptRow>();
    if (!row || now - row.windowStartedAt >= windowMs) return null;
    return {
      failedAttempts: row.failedAttempts,
      windowStartedAt: row.windowStartedAt,
      lockedUntil: row.lockedUntil,
    };
  }

  async recordFailure(
    keyHash: string,
    now: number,
    windowMs: number,
  ): Promise<AuthAttemptState> {
    const cutoff = now - windowMs;
    await this.db
      .prepare(
        "INSERT INTO identity_auth_attempts (key_hash, failed_attempts, window_started_at, locked_until, updated_at) VALUES (?, 1, ?, NULL, ?) ON CONFLICT(key_hash) DO UPDATE SET failed_attempts = CASE WHEN identity_auth_attempts.window_started_at <= ? THEN 1 ELSE identity_auth_attempts.failed_attempts + 1 END, window_started_at = CASE WHEN identity_auth_attempts.window_started_at <= ? THEN excluded.window_started_at ELSE identity_auth_attempts.window_started_at END, locked_until = CASE WHEN identity_auth_attempts.window_started_at <= ? THEN NULL ELSE identity_auth_attempts.locked_until END, updated_at = excluded.updated_at",
      )
      .bind(keyHash, now, now, cutoff, cutoff, cutoff)
      .run();
    const result = await this.db
      .prepare(
        "UPDATE identity_auth_attempts SET locked_until = CASE WHEN failed_attempts >= 10 THEN ? + 1800000 WHEN failed_attempts >= 8 THEN ? + 900000 WHEN failed_attempts >= 6 THEN ? + 300000 WHEN failed_attempts >= 5 THEN ? + 60000 ELSE NULL END WHERE key_hash = ? RETURNING failed_attempts AS failedAttempts, window_started_at AS windowStartedAt, locked_until AS lockedUntil",
      )
      .bind(now, now, now, now, keyHash)
      .first<AuthAttemptRow>();
    if (!result) throw new Error("Unable to record authentication attempt");
    return {
      failedAttempts: result.failedAttempts,
      windowStartedAt: result.windowStartedAt,
      lockedUntil: result.lockedUntil,
    };
  }

  async clear(keyHash: string): Promise<void> {
    await this.db
      .prepare("DELETE FROM identity_auth_attempts WHERE key_hash = ?")
      .bind(keyHash)
      .run();
  }
}
