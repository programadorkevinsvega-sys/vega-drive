-- Sharing owns only sharing_* tables. No cross-module foreign keys or joins.
CREATE TABLE IF NOT EXISTS sharing_links (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  password_salt TEXT,
  password_hash TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  CHECK ((password_salt IS NULL AND password_hash IS NULL) OR (password_salt IS NOT NULL AND password_hash IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS sharing_links_owner_created_idx
  ON sharing_links (owner_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS sharing_links_expiry_idx
  ON sharing_links (expires_at)
  WHERE revoked_at IS NULL;

-- Fixed-window attempts prevent password guessing without retaining IP addresses.
CREATE TABLE IF NOT EXISTS sharing_password_attempts (
  token_hash TEXT PRIMARY KEY NOT NULL,
  window_start TEXT NOT NULL,
  attempts INTEGER NOT NULL CHECK (attempts >= 1 AND attempts <= 10)
);
