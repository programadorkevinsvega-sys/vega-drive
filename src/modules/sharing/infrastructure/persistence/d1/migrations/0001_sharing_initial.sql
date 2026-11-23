-- Sharing owns only sharing_* tables. No cross-module foreign keys or joins.
CREATE TABLE IF NOT EXISTS sharing_links (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS sharing_links_owner_created_idx
  ON sharing_links (owner_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS sharing_links_expiry_idx
  ON sharing_links (expires_at)
  WHERE revoked_at IS NULL;
