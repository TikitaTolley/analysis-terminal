export interface Snapshot {
  teamId: string
  name: string
  score: number | null
  rank: number | null
  gamesPlayed: number | null
  gamesWon: number | null
  result: string
  leaderboard: { id: string; name: string; score: number | null; gamesPlayed: number | null }[]
  activity: string | null
  sources: { name: string; ok: boolean; note: string }[]
  fetchedAt: number
}
export interface DeviceState {
  selection: { version: string; playerId: string; expiresAt: number } | null
  snapshot: Snapshot | null
}
