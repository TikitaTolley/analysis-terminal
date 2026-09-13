export const selectSession = `INSERT INTO terminal_selection (terminal_id, version, player_id, selected_at, expires_at, snapshot, refreshed_at)
  VALUES ('main', ?, ?, ?, ?, ?, 0)
  ON CONFLICT(terminal_id) DO UPDATE SET version=excluded.version, player_id=excluded.player_id,
  selected_at=excluded.selected_at, expires_at=excluded.expires_at, acknowledged_at=NULL,
  snapshot=excluded.snapshot, refreshed_at=0 WHERE terminal_selection.expires_at <= excluded.selected_at`

export const resetSession = "UPDATE terminal_selection SET expires_at = 0, snapshot = NULL WHERE terminal_id = 'main' AND version = ?"
