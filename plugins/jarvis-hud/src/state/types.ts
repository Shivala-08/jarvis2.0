/**
 * HUD State — typed interface for all dynamic HUD data.
 *
 * Every component consumes HudState. No hardcoded values.
 * The adapter replaces this with real DSH state.
 *
 * @module
 */

/** Connection state. */
export interface ConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'error'
  latency_ms: number | null
  last_connected_at: string | null
}

/** Session state. */
export interface SessionState {
  session_id: string | null
  status: 'idle' | 'active' | 'paused'
  duration_ms: number
  started_at: string | null
}

/** Agent state (Phase 6 graph). */
export interface AgentState {
  current_node: string | null
  workflow_state: string
  nodes_visited: string[]
}

/** Model state (Phase 3 router). */
export interface ModelState {
  provider: string | null
  model: string | null
  status: 'idle' | 'streaming' | 'error'
  tier: string | null
}

/** Tool state. */
export interface ToolState {
  active_tools: string[]
  last_tool: string | null
  last_tool_at: string | null
  tool_count: number
}

/** Verification state (Phase 7). */
export interface VerificationState {
  status: 'pending' | 'failed' | 'ready'
  tests_passed: boolean | null
  last_verified_at: string | null
}

/** Memory state (Phase 5). */
export interface MemoryState {
  connected: boolean
  last_remember_at: string | null
  last_recall_at: string | null
  memory_count: number
}

/** Voice state (Phase 4). */
export interface VoiceState {
  connected: boolean
  speaking: boolean
  listening: boolean
  last_active_at: string | null
}

/** Step budget state (Phase 7). */
export interface StepState {
  current: number
  max: number
  escalated: boolean
  escalation_reason: string | null
}

/** Boot sequence state. */
export type BootPhase =
  | 'initializing'
  | 'connecting'
  | 'session_detected'
  | 'synchronizing'
  | 'ready'
  | 'dashboard'

/** Complete HUD state. */
export interface HudState {
  boot: BootPhase
  connection: ConnectionState
  session: SessionState
  agent: AgentState
  model: ModelState
  tools: ToolState
  verification: VerificationState
  memory: MemoryState
  voice: VoiceState
  steps: StepState
}

/** Create initial HUD state with defaults. */
export function createInitialHudState(): HudState {
  return {
    boot: 'initializing',
    connection: {
      status: 'disconnected',
      latency_ms: null,
      last_connected_at: null,
    },
    session: {
      session_id: null,
      status: 'idle',
      duration_ms: 0,
      started_at: null,
    },
    agent: {
      current_node: null,
      workflow_state: 'REQUESTED',
      nodes_visited: [],
    },
    model: {
      provider: null,
      model: null,
      status: 'idle',
      tier: null,
    },
    tools: {
      active_tools: [],
      last_tool: null,
      last_tool_at: null,
      tool_count: 0,
    },
    verification: {
      status: 'pending',
      tests_passed: null,
      last_verified_at: null,
    },
    memory: {
      connected: false,
      last_remember_at: null,
      last_recall_at: null,
      memory_count: 0,
    },
    voice: {
      connected: false,
      speaking: false,
      listening: false,
      last_active_at: null,
    },
    steps: {
      current: 0,
      max: 15,
      escalated: false,
      escalation_reason: null,
    },
  }
}
