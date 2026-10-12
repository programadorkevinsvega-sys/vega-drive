-- Durable state for large uploads; records are owned only by the files module.
CREATE TABLE IF NOT EXISTS files_multipart_uploads (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL,
  reservation_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  folder_id TEXT,
  name TEXT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  r2_upload_id TEXT NOT NULL,
  expected_size_bytes INTEGER NOT NULL CHECK (expected_size_bytes > 0),
  content_type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS files_multipart_owner_expiry_idx
  ON files_multipart_uploads (owner_id, expires_at);

CREATE TABLE IF NOT EXISTS files_multipart_parts (
  session_id TEXT NOT NULL,
  part_number INTEGER NOT NULL CHECK (part_number BETWEEN 1 AND 10000),
  etag TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
  PRIMARY KEY (session_id, part_number)
);
