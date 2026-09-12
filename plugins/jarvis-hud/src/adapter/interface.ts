/**
 * HUD State Adapter interface.
 *
 * This is the boundary between real OpenJarvis state and HUD components.
 * The adapter must be replaceable — dev fixture in visual mode,
 * real OpenJarvis adapter in production.
 *
 * @module
 */

import type { HudState, BootPhase } from '../state/types.js'

/** Event emitted when HUD state changes. */
export type HudStateListener = (state: HudState) => void

/** Adapter interface — implement this for real OpenJarvis integration. */
export interface HudAdapter {
  /** Start listening to backend state changes. */
  connect(): void

  /** Stop listening and clean up. */
  disconnect(): void

  /** Get current state snapshot. */
  getState(): HudState

  /** Subscribe to state changes. */
  subscribe(listener: HudStateListener): () => void

  /** Request boot sequence transition. */
  setBootPhase(phase: BootPhase): void
}

/** Development fixture adapter — uses isolated mock data. */
export class DevFixtureAdapter implements HudAdapter {
  private state: HudState
  private listeners: HudStateListener[] = []

  constructor(initialState: HudState) {
    this.state = { ...initialState }
  }

  connect(): void {
    // Dev fixture: no real backend
    console.log('[HUD Adapter] Dev fixture connected (no real backend)')
  }

  disconnect(): void {
    this.listeners = []
  }

  getState(): HudState {
    return { ...this.state }
  }

  subscribe(listener: HudStateListener): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  setBootPhase(phase: BootPhase): void {
    this.state = { ...this.state, boot: phase }
    this.notify()
  }

  /** Update state (for dev fixture testing). */
  updateState(partial: Partial<HudState>): void {
    this.state = { ...this.state, ...partial }
    this.notify()
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.state)
    }
  }
}

/**
 * Real OpenJarvis Adapter — connects to the OpenJarvis backend.
 *
 * The production adapter lives at `public/adapter/openjarvis-adapter.js`
 * and polls the REST API on port 8000. This TS stub exists as a typed
 * placeholder for the adapter contract.
 */
export class OpenJarvisAdapter implements HudAdapter {
  private state: HudState
  private listeners: HudStateListener[] = []

  constructor(initialState: HudState) {
    this.state = { ...initialState }
  }

  connect(): void {
    // TODO: Connect to OpenJarvis REST API (see public/adapter/openjarvis-adapter.js)
    console.log('[HUD Adapter] OpenJarvis adapter — not yet implemented')
  }

  disconnect(): void {
    // TODO: Disconnect from OpenJarvis
    this.listeners = []
  }

  getState(): HudState {
    return { ...this.state }
  }

  subscribe(listener: HudStateListener): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  setBootPhase(phase: BootPhase): void {
    this.state = { ...this.state, boot: phase }
    this.notify()
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.state)
    }
  }
}
