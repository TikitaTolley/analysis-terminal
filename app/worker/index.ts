import { selectSession, resetSession } from './session.js'
import { normalize, object, readGame, snapshotFor, validId } from './game.js'
import type { Snapshot } from '../src/protocol.js'

interface Limiter { limit: (options: { key: string }) => Promise<{ success: boolean }> }
interface Bindings {
  DB: D1Database
  DEVICE_KEY: string
  LEAGUE_ID: string
  SUBMIT_LIMIT: Limiter
  STATUS_LIMIT: Limiter
  DEVICE_POLL_LIMIT: Limiter
  DEVICE_COMMAND_LIMIT: Limiter
}
interface Selection {
  version: string
  player_id: string
  selected_at: number
  expires_at: number
  acknowledged_at: number | null
  snapshot: string | null
  refreshed_at: number
}
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
const limited = () => new Response(JSON.stringify({ error: 'Too many requests. Please wait a minute.' }), { status: 429, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Retry-After': '60' } })
async function body(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new Error('Expected JSON')
  const raw = await request.text()
  if (raw.length > 512) throw new Error('Request too large')
  return object(JSON.parse(raw))
}
export default {
  async fetch(request: Request, env: Bindings): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname
    if (!path.startsWith('/api/')) return json({ error: 'Not found' }, 404)
    if (path.startsWith('/api/device')) {
      if (!env.DEVICE_KEY || request.headers.get('authorization') !== `Bearer ${env.DEVICE_KEY}`) return json({ error: 'Unauthorized' }, 401)
    }
    try {
      if (path === '/api/selection' && request.method === 'POST') {
        if (request.headers.get('origin') !== url.origin) return json({ error: 'Invalid origin' }, 403)
        if (!(await env.SUBMIT_LIMIT.limit({ key: request.headers.get('CF-Connecting-IP') ?? 'unknown' })).success) return limited()
        const input = await body(request)
        const playerId = typeof input.playerId === 'string' ? input.playerId.trim() : ''
        if (!validId(playerId)) return json({ error: 'Enter a numeric player ID greater than zero.' }, 400)
        let snapshot: Snapshot
        try { snapshot = normalize(await readGame(`api/v1/showcase?team_ref=${playerId}`), playerId) }
        catch { return json({ error: 'Could not find this team. Check the ID or try again shortly.' }, 422) }
        const version = crypto.randomUUID()
        const now = Date.now()
        const saved = await env.DB.prepare(selectSession).bind(version, playerId, now, now + 900000, JSON.stringify(snapshot)).run()
        if (!saved.meta.changes) return json({ error: 'Terminal in use. Press Reset on the terminal, then send your ID.' }, 409)
        return json({ version, name: snapshot.name }, 201)
      }
      if (path === '/api/status' && request.method === 'GET') {
        if (!(await env.STATUS_LIMIT.limit({ key: request.headers.get('CF-Connecting-IP') ?? 'unknown' })).success) return limited()
        if (!/^[0-9a-f-]{36}$/.test(url.searchParams.get('version') ?? '')) return json({ status: 'replaced' })
        const row = await env.DB.prepare("SELECT version, expires_at, acknowledged_at FROM terminal_selection WHERE terminal_id = 'main'").first<Selection>()
        const version = url.searchParams.get('version')
        if (!version || !row || row.version !== version) return json({ status: 'replaced' })
        return json({ status: row.expires_at === 0 ? 'completed' : row.expires_at <= Date.now() ? 'expired' : row.acknowledged_at ? 'received' : 'waiting' })
      }
      if (path === '/api/device/reset' && request.method === 'POST') {
        if (!(await env.DEVICE_COMMAND_LIMIT.limit({ key: 'main' })).success) return limited()
        const input = await body(request)
        if (typeof input.version !== 'string' || input.version.length > 64) return json({ error: 'Invalid version' }, 400)
        const result = await env.DB.prepare(resetSession).bind(input.version).run()
        return json({ reset: result.meta.changes > 0 })
      }
      if (path === '/api/device/ack' && request.method === 'POST') {
        if (!(await env.DEVICE_COMMAND_LIMIT.limit({ key: 'main' })).success) return limited()
        const input = await body(request)
        if (typeof input.version !== 'string' || input.version.length > 64) return json({ error: 'Invalid version' }, 400)
        const result = await env.DB.prepare("UPDATE terminal_selection SET acknowledged_at = ? WHERE terminal_id = 'main' AND version = ? AND expires_at > ?").bind(Date.now(), input.version, Date.now()).run()
        return json({ acknowledged: result.meta.changes > 0 })
      }
      if (path === '/api/device' && request.method === 'GET') {
        if (!(await env.DEVICE_POLL_LIMIT.limit({ key: 'main' })).success) return limited()
        const row = await env.DB.prepare("SELECT * FROM terminal_selection WHERE terminal_id = 'main'").first<Selection>()
        if (!row || row.expires_at <= Date.now()) return json({ selection: null, snapshot: null })
        let snapshot = row.snapshot ? JSON.parse(row.snapshot) as Snapshot : null
        const now = Date.now()
        if (now - row.refreshed_at >= 60000) {
          // Claim one refresh across simultaneous device polls; keep the cached display available.
          const claim = await env.DB.prepare("UPDATE terminal_selection SET refreshed_at = ? WHERE terminal_id = 'main' AND version = ? AND refreshed_at = ?").bind(now, row.version, row.refreshed_at).run()
          if (claim.meta.changes) {
            try { snapshot = await snapshotFor(row.player_id, env.LEAGUE_ID) }
            catch { if (snapshot) snapshot = { ...snapshot, sources: [{ name: 'Showcase', ok: false, note: 'Refresh failed; showing last received data' }] } }
            await env.DB.prepare("UPDATE terminal_selection SET snapshot = ? WHERE terminal_id = 'main' AND version = ?").bind(JSON.stringify(snapshot), row.version).run()
          }
        }
        // Avoid handing an old selection to the display when another phone submits during refresh.
        const current = await env.DB.prepare("SELECT version FROM terminal_selection WHERE terminal_id = 'main'").first<{ version: string }>()
        if (current?.version !== row.version) return json({ retry: true }, 409)
        return json({ selection: { version: row.version, playerId: row.player_id, expiresAt: row.expires_at }, snapshot })
      }
      return json({ error: 'Not found' }, 404)
    } catch { return json({ error: 'Request could not be processed. Please try again.' }, 400) }
  },
}
