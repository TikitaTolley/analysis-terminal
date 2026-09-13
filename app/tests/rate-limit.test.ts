import { expect, test } from 'bun:test'
import worker from '../worker/index'
const allow = { limit: async () => ({ success: true }) }
const deny = { limit: async () => ({ success: false }) }
const env = {
  DEVICE_KEY: 'test-device-key', LEAGUE_ID: '1',
  DB: { prepare: () => { throw new Error('Database must not be accessed') } },
  SUBMIT_LIMIT: deny, STATUS_LIMIT: deny, DEVICE_POLL_LIMIT: deny, DEVICE_COMMAND_LIMIT: deny,
} as unknown as Parameters<typeof worker.fetch>[1]

test('rate limited public and device requests stop before database work', async () => {
  const origin = 'https://terminal.example'
  for (const [path, method] of [
    ['/api/selection', 'POST'], ['/api/status?version=00000000-0000-0000-0000-000000000000', 'GET'],
    ['/api/device', 'GET'], ['/api/device/ack', 'POST'], ['/api/device/reset', 'POST'],
  ]) {
    const response = await worker.fetch(new Request(origin + path, { method, headers: { Origin: origin, Authorization: 'Bearer test-device-key' } }), env)
    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('60')
  }
})
test('device authentication precedes its shared rate limit', async () => {
  const response = await worker.fetch(new Request('https://terminal.example/api/device'), env)
  expect(response.status).toBe(401)
})
test('malformed delivery IDs never read D1', async () => {
  const response = await worker.fetch(new Request('https://terminal.example/api/status?version=invalid'), { ...env, STATUS_LIMIT: allow })
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ status: 'replaced' })
})
