# Companion app

React + Vite frontend, Cloudflare Worker API and D1 session storage. [Open the companion](https://analysis-terminal.daeda-technologies.workers.dev/).

## Local setup

From this repository's root, with Bun installed:

```sh
cd app
bun install
cp .dev.vars.example .dev.vars
bunx wrangler d1 migrations apply analysis-terminal --local
bun run dev
```

Set `DEVICE_KEY` in `.dev.vars` to your own random secret. Keep it out of Git.

## Deploy your own

1. Run `bunx wrangler login`, then `bunx wrangler d1 create analysis-terminal` in your Cloudflare account.
2. In [wrangler.jsonc](wrangler.jsonc), set your Worker name and the returned database ID. Keep the binding `DB`.
3. Set `LEAGUE_ID` to the league you want to display. The supplied value `1` is the game's test league.
4. Apply the database migration and store the same device key used by your ESP32:

```sh
bunx wrangler d1 migrations apply analysis-terminal --remote
bunx wrangler secret put DEVICE_KEY
bun run deploy
```

Set the firmware's `API_URL` to your deployed Worker URL. Use the companion URL for the NFC sticker.

[Cloudflare database setup](https://developers.cloudflare.com/d1/get-started/) · [Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/)

## Computer-only simulator

Set `origin` in [scripts/simulator.ts](scripts/simulator.ts) to your deployed Worker URL. Use its matching device key in `.dev.vars`.

```sh
bun run build
bun --env-file=.dev.vars scripts/simulator.ts
```

Open [localhost:4174/simulator](http://127.0.0.1:4174/simulator). Stop the simulator before connecting the physical terminal: it uses the same device slot.

## API

| Endpoint | Purpose |
| --- | --- |
| `POST /api/selection` | Submit `{ "playerId": "1" }` |
| `GET /api/status?version=...` | Phone delivery status |
| `GET /api/device` | Device selection and display data |
| `POST /api/device/ack` | Confirm the displayed `version` |
| `POST /api/device/reset` | Finish the current `version` |

Device routes require `Authorization: Bearer <DEVICE_KEY>`. The phone never receives this key. Game data is read-only.

## Sessions

- One active team at a time, with a 15-minute expiry.
- Device polling runs every three seconds; game data refreshes at most once a minute.
- Missing data stays N/A. Idle demo values are fictional.
- If a refresh fails, the last snapshot remains with a connection warning.

## Checks

```sh
bun run build
bun run lint
bun test tests
```
