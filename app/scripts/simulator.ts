import { resolve, sep } from 'node:path'

const origin = 'https://analysis-terminal.daeda-technologies.workers.dev'
const key = process.env.DEVICE_KEY
if (!key) throw new Error('DEVICE_KEY is missing. Run bun --env-file=.dev.vars scripts/simulator.ts')
const root = resolve(import.meta.dir, '../dist/client')
const server = Bun.serve({
  hostname: '127.0.0.1', port: 4174,
  async fetch(request) {
    const url = new URL(request.url)
    if (url.host !== '127.0.0.1:4174' && url.host !== 'localhost:4174') return new Response('Invalid host', { status: 403 })
    if (url.pathname.startsWith('/api/')) {
      if (request.headers.get('origin') && request.headers.get('origin') !== url.origin) return new Response('Invalid origin', { status: 403 })
      const route = url.pathname === '/api/device' && request.method === 'GET' ? '/api/device' : ['/api/device/ack', '/api/device/reset'].includes(url.pathname) && request.method === 'POST' ? url.pathname : null
      if (!route) return new Response('Not found', { status: 404 })
      const response = await fetch(origin + route, {
        method: request.method,
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: request.method === 'POST' ? await request.text() : undefined,
        signal: AbortSignal.timeout(25000),
      })
      return new Response(await response.text(), { status: response.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...(response.headers.has('Retry-After') ? { 'Retry-After': response.headers.get('Retry-After')! } : {}) } })
    }
    const path = resolve(root, '.' + decodeURIComponent(url.pathname))
    if (path !== root && !path.startsWith(root + sep)) return new Response('Not found', { status: 404 })
    if (url.pathname.startsWith('/assets/')) return new Response(Bun.file(path))
    return new Response(Bun.file(resolve(root, 'index.html')), { headers: { 'Cache-Control': 'no-store' } })
  },
  error() { return Response.json({ error: 'Cloudflare connection failed' }, { status: 502 }) },
})
console.info(`Terminal simulator: http://${server.hostname}:${server.port}/simulator`)
