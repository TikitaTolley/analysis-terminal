import { describe, expect, test } from 'bun:test'
import { normalize, validId } from '../worker/game'

describe('player IDs', () => {
  test('rejects zero, injection, decimals and unbounded values', () => {
    for (const id of ['0', '-1', '1.2', '1&league_id=9', 'abc', '12345678901', '']) expect(validId(id)).toBe(false)
    expect(validId('1')).toBe(true)
  })
})
describe('showcase adapter', () => {
  test('keeps absent fields unknown and genuine zeroes intact', () => {
    const result = normalize({ team: { id: '1', name: 'abc', score: 0 }, agents: [] }, '1')
    expect(result.score).toBe(0)
    expect(result.gamesPlayed).toBeNull()
    expect(result.rank).toBeNull()
    expect('agents' in result).toBe(false)
    expect('logic' in result).toBe(false)
  })
  test('does not accept another team or a malformed response', () => {
    expect(() => normalize({ team: { id: '2', name: 'abc' } }, '1')).toThrow()
    expect(() => normalize({}, '1')).toThrow()
  })
})
