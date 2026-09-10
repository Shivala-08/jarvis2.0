# @jarvis/hud — J.A.R.V.I.S. Holographic Interface

Three.js HUD for OpenJarvis agent state, session context, and system telemetry.

## Run

Two servers are involved:

| Port | What | Start with |
|------|------|-----------|
| 8000 | OpenJarvis REST API (state source) | `jarvis serve --port 8000` (repo root) |
| 8080 | Static HUD files | `pnpm --filter @jarvis/hud dev` (or `./start-server.sh`) |

Then open **http://127.0.0.1:8080/index.html**.

> ES modules do not load over `file://` — the static server is required.

## Architecture

- `src/state/types.ts` — **single source of truth** for the `HudState` shape.
  `pnpm build` compiles it to `public/state/types.js` (a build artifact — never
  hand-edit it). `tests/state-contract.spec.ts` fails if the artifact drifts.
- `public/adapter/openjarvis-adapter.js` — polls the REST API
  (`/health`, `/v1/info`, `/v1/traces`, `/v1/budget`, `/v1/telemetry/stats`,
  `/v1/managed-agents`, `/v1/memory/stats`) every 3s and maps responses into
  `HudState`. Requests abort after 5s so a hung endpoint can't stall polling.
- `public/orb.js` — Three.js orb + panel wiring, driven by the adapter.
- `public/handTracker.js` — MediaPipe gesture control (camera stays off until
  you toggle "Gestures on").

The primary HUD is `public/index.html`. Historical variants
(`jarvis.html`, `jarvis-standalone.html`, `test.html`) and the vendored
`three.min.js` are retired duplicates kept out of the runtime path.
