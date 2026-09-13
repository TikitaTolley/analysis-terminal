import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import TerminalPage from '../src/TerminalPage'
import { normalize, normalizeLeaderboard } from '../src/adapter'
import team from '../src/demo-team.json'
import leaderboard from '../src/demo-leaderboard.json'
const data = { ...normalize(team, team.team.id), leaderboard: normalizeLeaderboard(leaderboard) }
test('win rate uses verified counts and handles empty records', () => {
  const page = { title: 'Statistics', lines: [], kind: 'statistics' as const }
  expect(renderToStaticMarkup(<TerminalPage page={page} data={data} />)).toContain('67%')
  const empty = renderToStaticMarkup(<TerminalPage page={page} data={{ ...data, gamesPlayed: 0, gamesWon: 0 }} />)
  expect(empty).toContain('No games played yet')
  expect(empty).not.toContain('NaN')
})
test('leaderboard bars use a common maximum and retain zero scores', () => {
  const page = { title: 'Standings', lines: [], kind: 'leaderboard' as const, rows: data.leaderboard.slice(0, 3) }
  const html = renderToStaticMarkup(<TerminalPage page={page} data={data} />)
  expect(html).toContain('tft-row selected')
  expect(html).toContain('width:100%')
  const rows = data.leaderboard.map(row => ({ ...row, score: 0 }))
  const zero = renderToStaticMarkup(<TerminalPage page={{ ...page, rows: rows.slice(0, 3) }} data={{ ...data, leaderboard: rows }} />)
  expect(zero).not.toContain('NaN')
  expect(zero).toContain('width:0%')
})
