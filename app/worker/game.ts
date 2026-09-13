import { normalize, normalizeLeaderboard, object } from '../src/adapter.js'
export { normalize, object } from '../src/adapter.js'
import type { Snapshot } from '../src/protocol.js'

type RecordValue = Record<string, unknown>
const text = (v: unknown, fallback = 'Unavailable'): string => typeof v === 'string' ? v.slice(0, 240) : fallback
export function validId(value: unknown): value is string {
  return typeof value === 'string' && /^[1-9][0-9]{0,9}$/.test(value) && Number.isSafeInteger(Number(value))
}
export async function readGame(path: string): Promise<RecordValue> {
  const response = await fetch(`https://thinkapp.net/ink/${path}`, { signal: AbortSignal.timeout(8000), headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const body = await response.text()
  if (body.length > 500000) throw new Error('Response too large')
  let value: unknown
  try { value = JSON.parse(body) } catch { throw new Error('Invalid JSON from game API') }
  const data = object(value)
  if (data.error || data.status === 'error') throw new Error(text(data.error, 'Game API error'))
  return data
}
export async function snapshotFor(playerId: string, leagueId: string, showcase?: RecordValue): Promise<Snapshot> {
  const primary = showcase ?? await readGame(`api/v1/showcase?team_ref=${playerId}`)
  const snapshot = normalize(primary, playerId)
  snapshot.sources.push({ name: 'Showcase', ok: true, note: 'Team and completed result' })
  const routes = [
    ['Leaderboard', `api.php?action=leaderboard&league_id=${leagueId}`],
    ['Activity', `api.php?action=match_list&league_id=${leagueId}`],
  ]
  const reads = await Promise.allSettled(routes.map(([, path]) => readGame(path)))
  reads.forEach((read, index) => {
    const name = routes[index][0]
    if (read.status === 'rejected') {
      snapshot.sources.push({ name, ok: false, note: read.reason instanceof Error ? read.reason.message : 'Unavailable' })
      return
    }
    const data = read.value
    snapshot.sources.push({ name, ok: true, note: 'Read successfully' })
    if (index === 0 && Array.isArray(data.leaderboard)) {
      snapshot.leaderboard = normalizeLeaderboard(data)
    }
    if (index === 1 && Array.isArray(data.games_feed)) {
      const row = object(data.games_feed.find(value => String(object(value).id) === playerId))
      snapshot.activity = typeof row.last_match_at === 'string' ? row.last_match_at : null
    }
  })
  return snapshot
}
