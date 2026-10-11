-- Unique active sibling names in each node table; catalog claims also cover both types.
CREATE TABLE IF NOT EXISTS files_catalog_names (
  owner_id TEXT NOT NULL,
  parent_key TEXT NOT NULL,
  name_key TEXT NOT NULL,
  node_type TEXT NOT NULL CHECK (node_type IN ('folder', 'file')),
  node_id TEXT NOT NULL,
  PRIMARY KEY (owner_id, node_type, node_id),
  UNIQUE (owner_id, parent_key, name_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS files_folders_owner_parent_name_active_idx
  ON files_folders (owner_id, COALESCE(parent_folder_id, ''), lower(name))
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS files_items_owner_folder_name_active_idx
  ON files_items (owner_id, COALESCE(folder_id, ''), lower(name))
  WHERE deleted_at IS NULL;
