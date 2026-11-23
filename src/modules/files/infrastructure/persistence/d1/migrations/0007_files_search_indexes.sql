-- Owner-scoped indexes for active catalog name searches.
CREATE INDEX IF NOT EXISTS files_folders_owner_name_search_idx
  ON files_folders (owner_id, lower(name), id)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS files_items_owner_name_search_idx
  ON files_items (owner_id, lower(name), id)
  WHERE deleted_at IS NULL;
