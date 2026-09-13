import type { Snapshot } from './protocol.js'

type RecordValue = Record<string, unknown>
export function object(value: unknown): RecordValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {}
}
const text = (v: unknown, fallback = 'Unavailable'): string => typeof v === 'string' ? v.slice(0, 240) : fallback
const number = (v: unknown): number | null => typeof v === 'number' && Number.isFinite(v) ? v : null
export function normalize(showcase: RecordValue, playerId: string): Snapshot {
  const team = object(showcase.team)
  if (String(team.id) !== playerId || typeof team.name !== 'string') throw new Error('Team not found')
  const result = object(showcase.result)
  return {
    teamId: playerId, name: text(team.name), score: number(team.score), rank: number(team.rank),
    gamesPlayed: number(team.gamesPlayed), gamesWon: number(team.gamesWon),
    result: text(result.summary, 'No result available'),
    leaderboard: [], activity: null, sources: [], fetchedAt: Date.now(),
  }
}

export function normalizeLeaderboard(data: RecordValue): Snapshot['leaderboard'] {
  return Array.isArray(data.leaderboard) ? data.leaderboard.slice(0, 100).map(value => {
    const row = object(value)
    return { id: String(row.id), name: text(row.name), score: number(row.score), gamesPlayed: number(row.games_played) }
  }) : []
}
