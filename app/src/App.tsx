import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import Simulator from './Simulator'
import './App.css'

function Entry() {
  const [playerId, setPlayerId] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [version, setVersion] = useState<string | null>(null)
  const [received, setReceived] = useState(false)
  useEffect(() => {
    if (!version || received) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    const check = async () => {
      let delay = 3000
      try {
        const response = await fetch(`/api/status?version=${encodeURIComponent(version)}`, { signal: AbortSignal.timeout(10000) })
        if (response.status === 429) { delay = 60000; throw new Error() }
        if (!response.ok) throw new Error()
        const data = await response.json()
        if (stopped) return
        if (data.status === 'received') { setMessage('Received by terminal.'); setReceived(true); return }
        if (data.status === 'completed') { setMessage('Session finished. Send your ID to view again.'); return }
        if (data.status === 'expired' || data.status === 'replaced') {
          setMessage(data.status === 'expired' ? 'Selection expired. Send your ID again.' : 'Another player has selected a team.'); return
        }
        setMessage('Sent. Waiting for terminal...')
      } catch { if (!stopped) setMessage('Sent. Reconnecting to check delivery...') }
      if (!stopped) timer = setTimeout(check, delay)
    }
    void check()
    return () => { stopped = true; clearTimeout(timer) }
  }, [version, received])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setVersion(null); setReceived(false); setMessage('Finding team...')
    try {
      const response = await fetch('/api/selection', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: playerId.trim() }), signal: AbortSignal.timeout(15000),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Could not send this ID.')
      setVersion(data.version); setMessage('Sent. Waiting for terminal...')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Connection failed. Try again.') }
    finally { setBusy(false) }
  }
  return (
    <main className="terminal">
      <header className="masthead"><span className="ministry">Ministry of Artificial</span><span className="unit">Classified information</span></header>
      <section className="console" aria-labelledby="title">
        <div className="console-bar"><span>THINK TO INK</span><span>ANALYSIS DIVISION</span></div>
        <div className="console-body">
          <h1 id="title">Analysis terminal</h1>
          <form className="player-entry" onSubmit={submit}>
            <label htmlFor="player-id">Player ID</label>
            <input id="player-id" name="playerId" type="text" inputMode="numeric" pattern="[1-9][0-9]{0,9}" required placeholder="Enter your player ID" autoComplete="off" spellCheck={false} maxLength={10} value={playerId} onChange={event => setPlayerId(event.target.value)} />
            <button type="submit" disabled={busy}>{busy ? 'Sending...' : 'View on terminal'}</button>
            <p className="delivery" role="status">{message}</p>
          </form>
        </div>
        <footer className="console-footer"><span>WEB ACCESS / READY</span><span className="warning">{received ? 'DELIVERY / RECEIVED' : 'CLASSIFIED / TEAM RECORDS'}</span></footer>
      </section>
      <footer className="credits"><span>Hardware by TikitaTech</span><span>Think to Ink by Leon Brown</span></footer>
    </main>
  )
}
export default function App() {
  const local = ['localhost', '127.0.0.1'].includes(window.location.hostname)
  return local && window.location.pathname === '/simulator' ? <Simulator /> : <Entry />
}
