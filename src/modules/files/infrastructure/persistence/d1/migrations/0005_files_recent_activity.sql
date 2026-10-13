-- Per-owner last activity for active file catalog entries. Owned by files; no cross-module FK.
CREATE TABLE IF NOT EXISTS files_recent_activity (
  owner_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('open', 'download')),
  occurred_at TEXT NOT NULL,
  PRIMARY KEY (owner_id, item_id)
);

CREATE INDEX IF NOT EXISTS files_recent_owner_activity_idx
  ON files_recent_activity (owner_id, occurred_at DESC, item_id DESC);
