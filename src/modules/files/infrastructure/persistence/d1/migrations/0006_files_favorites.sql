-- Per-owner favorites for active file catalog entries. Owned by files; no cross-module FK.
CREATE TABLE IF NOT EXISTS files_favorites (
  owner_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  favorited_at TEXT NOT NULL,
  PRIMARY KEY (owner_id, item_id)
);

CREATE INDEX IF NOT EXISTS files_favorites_owner_time_idx
  ON files_favorites (owner_id, favorited_at DESC, item_id DESC);
