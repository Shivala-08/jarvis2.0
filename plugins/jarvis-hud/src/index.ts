/**
 * jarvis-hud — JARVIS command interface.
 *
 * Futuristic iris/reticle HUD with glass panels, boot sequence,
 * and typed state adapter for OpenJarvis integration.
 *
 * Phase 10 of the Jarvis rebuild.
 *
 * @module
 */

export type {
  HudState,
  BootPhase,
  ConnectionState,
  SessionState,
  AgentState,
  ModelState,
  ToolState,
  VerificationState,
  MemoryState,
  VoiceState,
  StepState,
} from './state/types.js'
export { createInitialHudState } from './state/types.js'

export type { HudAdapter, HudStateListener } from './adapter/interface.js'
export { DevFixtureAdapter, OpenJarvisAdapter } from './adapter/interface.js'

export const name = 'jarvis-hud'
export const version = '0.1.0'
