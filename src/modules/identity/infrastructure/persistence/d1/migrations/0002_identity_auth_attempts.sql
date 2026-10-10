-- Identity-owned auth throttling state.
CREATE TABLE IF NOT EXISTS identity_auth_attempts (
  key_hash TEXT PRIMARY KEY NOT NULL,
  failed_attempts INTEGER NOT NULL,
  window_started_at INTEGER NOT NULL,
  locked_until INTEGER,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS identity_auth_attempts_locked_until_idx
  ON identity_auth_attempts (locked_until);
