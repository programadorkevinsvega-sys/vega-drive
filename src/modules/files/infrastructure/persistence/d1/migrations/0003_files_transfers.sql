-- Durable transfer throttling; the files module owns these events.
CREATE TABLE IF NOT EXISTS files_transfer_events (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('upload', 'download')),
  occurred_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS files_transfer_owner_kind_time_idx
  ON files_transfer_events (owner_id, event_type, occurred_at);
CREATE INDEX IF NOT EXISTS files_transfer_time_idx
  ON files_transfer_events (occurred_at);
