/**
 * Drift guard for the HUD state contract (audit finding H1).
 *
 * public/state/types.js must be a build artifact of src/state/types.ts.
 * If this test fails, the generated file is stale: run `pnpm build` in
 * plugins/jarvis-hud. Never hand-edit the generated file.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const ROOT = new URL('..', import.meta.url).pathname

describe('HUD state contract (H1 drift guard)', () => {
  it('generated public/state/types.js is fresh — run `pnpm build` in plugins/jarvis-hud', () => {
    const generated = readFileSync(`${ROOT}public/state/types.js`, 'utf-8')

    // Signature fields the runtime adapter writes; if the source of truth
    // stops emitting them (or the artifact is stale), this fails.
    for (const marker of [
      'telemetry:',
      'traces: []',
      'agents: []',
      'connected: false',
      'createInitialHudState',
    ]) {
      expect(generated, `missing marker "${marker}"`).toContain(marker)
    }
  })
})
