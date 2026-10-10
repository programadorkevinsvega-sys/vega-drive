-- Initial D1 schema for Vega Drive.
-- Each module owns its prefixed tables. Cross-module identifiers are values, not foreign keys.
-- The production deploy applies this migration when Wrangler reports it as pending.
-- Reconcile any pre-existing remote schema before the first production application.

CREATE TABLE IF NOT EXISTS identity_users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  disabled_at TEXT
);

CREATE TABLE IF NOT EXISTS identity_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS identity_sessions_user_id_idx
  ON identity_sessions (user_id);
CREATE INDEX IF NOT EXISTS identity_sessions_expires_at_idx
  ON identity_sessions (expires_at);

CREATE TABLE IF NOT EXISTS identity_invites (
  id TEXT PRIMARY KEY NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_by_user_id TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE TABLE IF NOT EXISTS identity_outbox (
  id TEXT PRIMARY KEY NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  published_at TEXT
);

CREATE INDEX IF NOT EXISTS identity_outbox_unpublished_idx
  ON identity_outbox (created_at)
  WHERE published_at IS NULL;

CREATE TABLE IF NOT EXISTS files_folders (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL,
  parent_folder_id TEXT,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS files_folders_owner_parent_idx
  ON files_folders (owner_id, parent_folder_id);

CREATE TABLE IF NOT EXISTS files_items (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL,
  folder_id TEXT,
  storage_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS files_items_owner_folder_idx
  ON files_items (owner_id, folder_id);
CREATE INDEX IF NOT EXISTS files_items_owner_created_idx
  ON files_items (owner_id, created_at);

CREATE TABLE IF NOT EXISTS files_uploads (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL,
  item_id TEXT,
  storage_key TEXT NOT NULL UNIQUE,
  expected_size_bytes INTEGER NOT NULL CHECK (expected_size_bytes >= 0),
  content_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'expired')),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS files_uploads_status_expires_idx
  ON files_uploads (status, expires_at);
CREATE INDEX IF NOT EXISTS files_uploads_owner_id_idx
  ON files_uploads (owner_id);

CREATE TABLE IF NOT EXISTS files_outbox (
  id TEXT PRIMARY KEY NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  published_at TEXT
);

CREATE INDEX IF NOT EXISTS files_outbox_unpublished_idx
  ON files_outbox (created_at)
  WHERE published_at IS NULL;
