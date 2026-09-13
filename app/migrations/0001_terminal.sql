CREATE TABLE IF NOT EXISTS terminal_selection (
  terminal_id TEXT PRIMARY KEY CHECK (terminal_id = 'main'),
  version TEXT NOT NULL,
  player_id TEXT NOT NULL,
  selected_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  acknowledged_at INTEGER,
  snapshot TEXT,
  refreshed_at INTEGER NOT NULL DEFAULT 0
);
