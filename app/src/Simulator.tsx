import { useEffect, useRef, useState } from 'react'
import type { DeviceState } from './protocol'
import demoTeam from './demo-team.json'
import demoLeaderboard from './demo-leaderboard.json'
import TerminalPage from './TerminalPage'
import { pagesFor } from './display'
import { normalize, normalizeLeaderboard } from './adapter'
const demo = { ...normalize(demoTeam, demoTeam.team.id), leaderboard: normalizeLeaderboard(demoLeaderboard) }
const idle: DeviceState = { selection: null, snapshot: null }
export default function Simulator() {
  const [state, setState] = useState<DeviceState>(idle)
  const [page, setPage] = useState(0)
  const [connection, setConnection] = useState('Connecting...')
  const [resetting, setResetting] = useState(false)
  const version = useRef<string | null>(null)
  const acknowledged = useRef<string | null>(null)
  const generation = useRef(0)
  const resettingRef = useRef(false)
  useEffect(() => {
    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      const epoch = generation.current
      let delay = 3000
      try {
        if (resettingRef.current) return
        const response = await fetch('/api/device', { signal: AbortSignal.timeout(28000) })
        if (response.status === 429) {
          delay = 60000
          if (!stopped) setConnection('Request limit reached / retrying in a minute')
          return
        }
        if (response.status === 409) return
        if (!response.ok) throw new Error('Device connection failed')
        const data = await response.json() as DeviceState
        if (stopped || epoch !== generation.current) return
        if (version.current !== (data.selection?.version ?? null)) { setPage(0); version.current = data.selection?.version ?? null }
        setState(data); setConnection(data.selection ? 'Connected / Press Reset when finished' : 'Ready / Submit a player ID')
      } catch { if (!stopped && epoch === generation.current) setConnection('Connection lost / retrying') }
      finally { if (!stopped) timer = setTimeout(poll, delay) }
    }
    void poll()
    return () => { stopped = true; clearTimeout(timer) }
  }, [])
  useEffect(() => {
    if (!state.selection || !state.snapshot || acknowledged.current === state.selection.version) return
    const requestVersion = state.selection.version
    const controller = new AbortController()
    void fetch('/api/device/ack', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: state.selection.version }), signal: controller.signal,
    }).then(async response => {
      if (response.ok && (await response.json()).acknowledged) acknowledged.current = requestVersion
    }).catch(() => {})
    return () => controller.abort()
  }, [state])
  async function reset() {
    if (resettingRef.current) return
    if (!state.selection) { setPage(0); return }
    resettingRef.current = true; setResetting(true); generation.current += 1
    try {
      const response = await fetch('/api/device/reset', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: state.selection.version }), signal: AbortSignal.timeout(10000),
      })
      if (!response.ok) throw new Error('Reset failed')
      version.current = null; setState(idle); setPage(0); setConnection('Ready / Submit a player ID')
    } catch { setConnection('Connection lost / press Reset to retry') }
    finally { resettingRef.current = false; setResetting(false) }
  }
  const isDemo = !state.snapshot
  const pages = pagesFor(state.snapshot ?? demo, isDemo)
  const active = pages[page % pages.length]
  const offline = connection.startsWith('Connection lost')
  return <main className="terminal simulator">
    <header className="masthead"><span className="ministry">Ministry of Artificial</span><span className="unit">Analysis terminal</span></header>
    <div className="screen" aria-live="polite">
      <div className="screen-header"><span>CLASSIFIED INFORMATION</span><span>{isDemo ? 'DEMO' : 'TEAM'}</span></div>
      <div className="screen-content"><TerminalPage page={active} data={state.snapshot ?? demo} /></div>
      <div className="screen-footer"><span>{isDemo ? 'DEMO / FICTIONAL' : offline ? 'OFFLINE / CACHED' : 'GAME API'}</span><span>{page % pages.length + 1}/{pages.length}</span></div>
    </div>
    <div className="hardware-controls">
      <button className="previous" onClick={() => setPage(value => (value - 1 + pages.length) % pages.length)}>Previous</button>
      <button className="next" onClick={() => setPage(value => (value + 1) % pages.length)}>Next</button>
      <button className="reset" disabled={resetting} onClick={() => void reset()}>{resetting ? 'Resetting...' : 'Reset'}</button>
    </div>
    <p className="sim-status" role="status">{connection}</p>
  </main>
}
