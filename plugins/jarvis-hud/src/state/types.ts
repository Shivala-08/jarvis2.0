/**
 * HUD State — typed interface for all dynamic HUD data.
 *
 * This file is the SINGLE SOURCE OF TRUTH for the HUD state shape.
 * `public/state/types.js` is generated from it by `pnpm build`
 * (esbuild) — never edit that file by hand.
 *
 * Every panel consumes HudState. The adapter replaces this with real
 * OpenJarvis state.
 *
 * @module
 */

/** Connection state. */
export interface ConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'error'
  /** Boolean mirror of status, used by runtime consumers (adapter JS). */
  connected: boolean
  latency_ms: number | null
  last_connected_at: string | null
}

/** Session state. */
export interface SessionState {
  session_id: string | null
  status: 'idle' | 'active' | 'paused' | 'running' | 'ready' | 'error'
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

/** Token/cost telemetry (mirrors /v1/telemetry/stats + /v1/budget). */
export interface TelemetryState {
  total_tokens: number
  total_cost: number
  total_requests: number
  tokens_today: number
  requests_this_hour: number
  avg_throughput_tok_per_sec: number
  total_latency: number
}

/** One step inside a trace from /v1/traces (loose — backend-owned shape). */
export interface TraceStep {
  step_type?: string | null
  [key: string]: unknown
}

/** One task-lifecycle record from /v1/traces. */
export interface TraceRecord {
  id?: string | null
  query?: string | null
  outcome?: string | null
  agent?: string | null
  engine?: string | null
  model?: string | null
  created_at?: string | null
  duration_ms?: number | null
  total_tokens?: number | null
  steps?: TraceStep[]
}

/** One managed-agent record from /v1/managed-agents. */
export interface ManagedAgentRecord {
  id?: string
  name?: string
  status?: string
  [key: string]: unknown
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
  telemetry: TelemetryState
  traces: TraceRecord[]
  agents: ManagedAgentRecord[]
}

/** Create initial HUD state with defaults. */
export function createInitialHudState(): HudState {
  return {
    boot: 'initializing',
    connection: {
      status: 'disconnected',
      connected: false,
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
    telemetry: {
      total_tokens: 0,
      total_cost: 0,
      total_requests: 0,
      tokens_today: 0,
      requests_this_hour: 0,
      avg_throughput_tok_per_sec: 0,
      total_latency: 0,
    },
    traces: [],
    agents: [],
  }
}
