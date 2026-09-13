import type { Snapshot } from './protocol'
import type { DisplayPage } from './display'
const value = (number: number | null) => number === null ? 'N/A' : number.toLocaleString('en-GB')
function winPercent(data: Snapshot): number | null {
  return data.gamesPlayed !== null && data.gamesPlayed > 0 && data.gamesWon !== null && data.gamesWon >= 0 && data.gamesWon <= data.gamesPlayed ? Math.round(data.gamesWon / data.gamesPlayed * 100) : null
}
export default function TerminalPage({ page, data }: { page: DisplayPage; data: Snapshot }) {
  if (page.kind === 'overview') return <div className="tft-overview">
    <h1>{data.name}</h1><div className="tft-score"><span>SCORE</span><strong>{value(data.score)}</strong></div>
    <div className="tft-summary"><div><span>RANK</span><b>{data.rank === null ? 'N/A' : `#${data.rank}`}</b></div><div><span>PLAYED</span><b>{value(data.gamesPlayed)}</b></div><div><span>WON</span><b>{value(data.gamesWon)}</b></div></div>
  </div>
  if (page.kind === 'statistics') {
    const percent = winPercent(data)
    return <div className="tft-statistics"><h1>Team record</h1><div className="tft-win"><strong>{percent === null ? 'N/A' : `${percent}%`}</strong><span>WIN RATE</span></div>
      <div className="tft-meter" role="img" aria-label={percent === null ? 'Win rate unavailable' : `${percent}% win rate`}><div style={{ width: `${percent ?? 0}%` }} /></div>
      <div className="tft-stat-labels"><span>{value(data.gamesWon)} won</span><span>{value(data.gamesPlayed)} played</span></div>
      <div className="tft-note">{data.gamesPlayed === 0 ? 'No games played yet' : percent === null ? 'Win rate unavailable' : 'Wins / games played'}</div>
    </div>
  }
  if (page.kind === 'leaderboard') {
    const max = Math.max(0, ...data.leaderboard.map(row => row.score ?? 0))
    return <div className="tft-board"><h1>League standings</h1><div className="tft-table-head"><span>TEAM</span><span>SCORE</span></div>
      {page.rows?.map((row, index) => <div className={`tft-row ${row.id === data.teamId ? 'selected' : ''}`} key={`${row.id}-${index}`}>
        <div className="tft-row-label"><span>{row.id === data.teamId ? '> ' : ''}{row.name}</span><b>{value(row.score)}</b></div>
        <div className="tft-bar"><div style={{ width: `${max > 0 && row.score !== null ? Math.max(0, row.score) / max * 100 : 0}%` }} /></div>
      </div>)}
    </div>
  }
  return <><h1>{page.title}</h1>{page.lines.map((line, index) => <p key={index}>{line}</p>)}</>
}
