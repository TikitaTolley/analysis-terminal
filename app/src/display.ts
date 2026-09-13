import type { Snapshot } from './protocol'
export interface DisplayPage { title: string; lines: string[]; kind?: 'overview' | 'statistics' | 'leaderboard'; rows?: Snapshot['leaderboard'] }
const show = (value: number | null) => value === null ? 'N/A' : String(value)
export function wrap(text: string, width = 32): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/)) {
    if (!word) continue
    if (line && line.length + word.length + 1 > width) { lines.push(line); line = '' }
    let rest = word
    while (rest.length > width) { if (line) { lines.push(line); line = '' }; lines.push(rest.slice(0, width)); rest = rest.slice(width) }
    line += (line ? ' ' : '') + rest
  }
  if (line) lines.push(line)
  return lines
}
export function pagesFor(data: Snapshot, demo = false): DisplayPage[] {
  const pages: DisplayPage[] = []
  const add = (title: string, items: string[]) => {
    const lines = items.flatMap(item => wrap(item))
    for (let i = 0; i < Math.max(1, lines.length); i += 5) {
      pages.push({ title: title.slice(0, 25), lines: lines.slice(i, i + 5) })
    }
  }
  add(data.name, [demo ? 'FICTIONAL DEMO TEAM' : `PLAYER ID / ${data.teamId}`, `SCORE ${show(data.score)}`, `RANK  ${show(data.rank)}`, demo ? 'Submit an ID to begin' : 'Press Reset when finished'])
  pages[0].kind = 'overview'
  add('Team statistics', [`PLAYED  ${show(data.gamesPlayed)}`, `WON     ${show(data.gamesWon)}`, data.gamesPlayed ? `WIN RATE ${data.gamesWon === null ? 'N/A' : Math.round(data.gamesWon / data.gamesPlayed * 100) + '%'}` : 'No games played'])
  pages[pages.length - 1].kind = 'statistics'
  for (let i = 0; i < data.leaderboard.length; i += 3) {
    pages.push({ title: 'League standings', lines: [], kind: 'leaderboard', rows: data.leaderboard.slice(i, i + 3) })
  }
  return pages
}
