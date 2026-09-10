# JARVIS 2.0 → OpenJarvis Migration Report

## Summary

Migrated from DSH (DeepSeek Agent Framework) to OpenJarvis. The DSH plugin architecture (7 plugins) has been replaced by OpenJarvis primitives + 3 custom skills. **Status: complete** — OpenJarvis config is operational and all legacy DSH artifacts have been removed.

## What Changed

### Before (DSH Architecture)
| Component | Location | Status |
|-----------|----------|--------|
| `dsh-jarvis-models` | `plugins/dsh-jarvis-models/` | Replaced by OpenJarvis Engine primitive — **removed** |
| `dsh-jarvis-memory` | `plugins/dsh-jarvis-memory/` | Replaced by OpenJarvis Tools & Memory — **removed** |
| `dsh-jarvis-graph` | `plugins/dsh-jarvis-graph/` | Replaced by OpenJarvis agent graph — **removed** |
| `jarvis-hud` | `plugins/jarvis-hud/` | Migrated to port 8000 (see below) |
| `jarvis-tracing` | `plugins/jarvis-tracing/` | Replaced by OpenJarvis traces — **removed** |
| `jarvis-sync` | `plugins/jarvis-sync/` | Replaced by OpenJarvis sync — **removed** |
| `jarvis-project-memory` | `plugins/jarvis-project-memory/` | Replaced by OpenJarvis memory — **removed** |
| `cordis.yml` | root | Replaced by `config.toml` — **removed** |

### After (OpenJarvis Architecture)
| Primitive | OpenJarvis Equivalent | Custom Skill |
|-----------|----------------------|-------------|
| Engine (5 cloud providers) | Native `Engine` | — |
| Tools & Memory | Native `Tools & Memory` | `identity-context` |
| Agent Orchestration | `agents/` internals + `loop_guard` | — |
| Learning Loop | `jarvis optimize skills` | — |
| HUD (port 8000) | `jarvis serve` | `hud-state-bridge` |
| ADHD Scheduling | — | `adhd-zero-guilt-scheduling` |
| Identity Injection | — | `identity-context` |

## Custom Skills (3)

1. **adhd-zero-guilt-scheduling** — Calm-reframing task management
2. **identity-context** — Injects `identity.md` into agent runs
3. **hud-state-bridge** — Pushes agent state to holographic HUD

## HUD Migration

- **Before**: `ws://127.0.0.1:3080` (DSH WebSocket)
- **After**: `http://127.0.0.1:8000` (OpenJarvis REST polling). `jarvis.html`/`orb.js` poll REST endpoints (`/health`, `/v1/info`, `/v1/traces`, `/v1/budget`, `/v1/telemetry/stats`, `/v1/managed-agents`, `/v1/memory/stats`) via `adapter/openjarvis-adapter.js`.
- Adapter: `public/adapter/openjarvis-adapter.js` (old `dsh-adapter.js` **removed**)
- Legacy `dsh-adapter.js` files, DSH WebSocket code, and the dead `/api/events` echo POST **removed** from all HUD files.

## Learning Loop Setup

```bash
# Measure skill effectiveness
jarvis bench skills --max-samples 5 --seeds 42

# Auto-tune skill prompts from traces
jarvis optimize skills --policy dspy
```

## Verification

- `jarvis doctor` — confirms engines and health
- `jarvis skill list` — confirms 3 custom skills
- `jarvis serve` — starts the API server on port 8000
- HUD `index.html` — connects to port 8000

## Files Created/Modified

- `~/.openjarvis/config.toml` — OpenJarvis config with skill sources
- `~/Desktop/Jarvis2.0/identity.md` — Project identity
- `~/Desktop/Jarvis2.0/config.toml` — Project-level OpenJarvis config
- `~/Desktop/Jarvis2.0/plugins/jarvis-hud/public/jarvis.html` — HUD wired to port 8000
- `~/.openjarvis/skills/adhd-zero-guilt-scheduling/` — Custom skill
- `~/.openjarvis/skills/identity-context/` — Custom skill
- `~/.openjarvis/skills/hud-state-bridge/` — Custom skill

## Cleanup Completed

All legacy DSH artifacts removed:

1. DSH plugin directories: `plugins/dsh-jarvis-models/`, `plugins/dsh-jarvis-memory/`, `plugins/dsh-jarvis-graph/`, `plugins/jarvis-tracing/`, `plugins/jarvis-sync/`, `plugins/jarvis-project-memory/`
2. `cordis.yml` from root
3. `DSH_VERSION_PINNED.txt`
4. HUD adapter: `plugins/jarvis-hud/public/adapter/dsh-adapter.js` and `plugins/jarvis-hud/src/adapter/dsh-adapter.js`
5. DSH overrides from `package.json` (`pnpm.overrides` for `dsh-session`, `dsh-tools`, `dsh-user-approval`)
6. DSH dependency references from `pnpm-lock.yaml` (regenerated)
7. DSH references from `.gitignore` (`.dsh/`, `dsh-source/`) plus the stale `.dsh/` and `dsh-source/` dirs
8. `docs/coding-agent-boundary.md` updated — DSH-native references replaced with OpenJarvis primitives
9. `jarvis-rebuild-manual-v2.md` updated — superseded DSH-era manual rewritten for OpenJarvis
10. Stale DSH contract docs removed: `docs/memory-contract.md`, `docs/graph-contract.md`, `docs/memory-storage-boundaries.md`
11. `identity.md` — DSH-native primitives reference replaced with OpenJarvis
12. HUD source — `DshAdapter` renamed `OpenJarvisAdapter`; dead `src/orb.js` duplicate removed; DSH comments updated in `index.ts`, `interface.ts`, `orb.js`, `jarvis.html`, `jarvis-standalone.html`
13. Preserved plugin packages renamed from `@deepseek-ai/*` scope to `@jarvis/*`

## Next Steps

1. `jarvis serve` to start the API server
2. `jarvis bench skills --max-samples 5 --seeds 42` to measure effectiveness
3. `jarvis optimize skills --policy dspy` to auto-tune
4. Open `plugins/jarvis-hud/public/index.html` via the static server (`pnpm --filter @jarvis/hud dev`, port 8080) for HUD
5. Run `jarvis ask "..."` to test the agent