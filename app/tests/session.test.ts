import { expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { selectSession, resetSession } from '../worker/session'
import { pagesFor } from '../src/display'
import rawDemo from '../src/demo-team.json'
import { normalize } from '../src/adapter'
const demo = normalize(rawDemo, rawDemo.team.id)

test('active session is protected; reset allows the same player with a new request', async () => {
  const db = new Database(':memory:')
  db.exec(await Bun.file('migrations/0001_terminal.sql').text())
  const select = db.query(selectSession)
  expect(select.run('request-a', '1', 100, 1000, '{}').changes).toBe(1)
  expect(select.run('request-b', '2', 101, 1001, '{}').changes).toBe(0)
  db.query(resetSession).run('request-a')
  expect(select.run('request-c', '1', 102, 1002, '{}').changes).toBe(1)
  expect(db.query(resetSession).run('request-a').changes).toBe(0)
  expect(db.query('SELECT version, player_id, expires_at FROM terminal_selection').get()).toEqual({ version: 'request-c', player_id: '1', expires_at: 1002 })
  expect(select.run('request-d', '2', 1003, 2000, '{}').changes).toBe(1)
  db.close()
})
test('all demo and long-content pages fit the TFT text budget without scrolling', () => {
  const pages = pagesFor({ ...demo, result: 'x'.repeat(220) + ' a long message '.repeat(20) }, true)
  for (const page of pages) {
    expect(page.title.length).toBeLessThanOrEqual(25)
    expect(page.lines.length).toBeLessThanOrEqual(5)
    for (const line of page.lines) expect(line.length).toBeLessThanOrEqual(32)
  }
  expect(pagesFor(demo, true).some(page => page.title === 'Team logic')).toBe(false)
  expect(rawDemo.agents).toEqual([])
  expect('teamId' in rawDemo).toBe(false)
  expect(rawDemo.team.id).toBe(demo.teamId)
})
