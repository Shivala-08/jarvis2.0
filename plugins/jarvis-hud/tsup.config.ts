import { defineConfig } from 'tsup'

export default defineConfig([
  {
    // Node-facing package entry (types + adapters for TS consumers).
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
  },
  {
    // Browser runtime copy of the state module. public/state/types.js is a
    // BUILD ARTIFACT generated from src/state/types.ts — never edit it by
    // hand. This is the drift guard for the H1 fix: one source of truth
    // for the HUD state shape.
    entry: ['src/state/types.ts'],
    outDir: 'public/state',
    format: ['esm'],
    dts: false,
    sourcemap: false,
    clean: false,
  },
])
