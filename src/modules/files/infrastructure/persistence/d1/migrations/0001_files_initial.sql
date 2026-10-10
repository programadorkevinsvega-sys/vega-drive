-- Files-owned metadata schema. No foreign key to identity or other modules.
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
