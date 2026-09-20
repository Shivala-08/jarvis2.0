/**
 * OpenJarvis Adapter — polls the OpenJarvis API server and maintains HudState.
 *
 * The DSH WebSocket (/api/events) no longer exists. OpenJarvis exposes a REST
 * API on port 8000; this adapter polls the real state endpoints and maps them
 * into the typed HudState shape each HUD panel consumes.
 *
 * Real endpoints used:
 *   /health              — connection status
 *   /v1/info             — active model, agent, engine
 *   /v1/traces           — task lifecycle (query, agent, steps, tokens)
 *   /v1/budget           — token/request usage
 *   /v1/telemetry/stats  — token/cost telemetry
 *   /v1/memory/stats     — memory backend health
 *
 * @module
 */

import { createInitialHudState } from '../state/types.js'

/**
 * Create an OpenJarvis adapter that maintains HudState by polling the API.
 */
export function createOpenJarvisAdapter(config = { baseUrl: 'http://127.0.0.1:8000', pollIntervalMs: 3000 }) {
  const state = createInitialHudState()
  const listeners = new Set()
  const baseUrl = (config.baseUrl || 'http://127.0.0.1:8000').replace(/\/$/, '')
  const pollIntervalMs = config.pollIntervalMs || 3000
  let pollTimer = null
  let running = false

  function notify() {
    for (const fn of listeners) {
      fn({ ...state })
    }
  }

  const agentNodeNames = new Set([
    'orchestrator-node',
    'braindump-node',
    'scheduler-node',
    'body-double-node',
    'coding-node',
    'loop-guard-node',
  ])

  // H2 fix: dedup key for telemetry accumulation. tool_count and
  // active_tools must only advance when the newest trace actually shows
  // NEW work (different trace id, or more steps in the same trace),
  // otherwise every 3s poll re-counts the same steps forever.
  const lastCounted = { id: null, steps: 0 }

  async function fetchJson(path) {
    // H4 fix: abort hung requests so `running` never sticks true and
    // polling silently dies. 5s budget per endpoint.
    const res = await fetch(`${baseUrl}${path}`, {
      signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout
        ? AbortSignal.timeout(5000)
        : undefined,
    })
    if (!res.ok) return null
    return res.json()
  }

  function applyTelemetry() {
    // Pull recent task lifecycle from traces when available.
    if (state.traces && state.traces.length) {
      const t = state.traces[0]
      const stepTypes = (t.steps || []).map((s) => s.step_type)
      state.session.session_id = t.id || state.session.session_id
      state.session.status = t.outcome === 'error' ? 'error' : t.outcome === 'completed' ? 'ready' : 'running'
      if (t.created_at) state.session.started_at = t.created_at
      state.session.duration_ms = t.duration_ms || 0

      // Keep a specific managed-agent node (braindump-node, etc.); generic
      // trace agents map to orchestrator-node only when nothing else is set.
      // Resolve a trace agent that is a raw id (e.g. "e5fd6c81a465").
      const traceAgent = state.agents.find((a) => a.id === t.agent || a.name === t.agent)
        ? `${(state.agents.find((a) => a.id === t.agent || a.name === t.agent)).name}-node`
        : `${t.agent || 'orchestrator'}-node`
      if (state.agent.current_node && !agentNodeNames.has(state.agent.current_node)) {
        state.agent.current_node = traceAgent
      } else if (!state.agent.current_node) {
        state.agent.current_node = traceAgent
      }
      if (t.outcome === 'error') state.agent.workflow_state = 'ERROR'
      else if (t.outcome === 'completed') state.agent.workflow_state = 'SHIPPED'
      else state.agent.workflow_state = 'IMPLEMENTING'

      if (t.model) state.model.model = t.model
      if (t.engine) state.model.provider = state.model.provider || t.engine
      state.model.status = t.outcome === 'error' ? 'error' : 'idle'

      const tools = stepTypes.filter((s) => s === 'tool' || s === 'shell')
      const traceId = t.id || null
      const isNewWork = traceId !== lastCounted.id || stepTypes.length > lastCounted.steps
      if (tools.length && isNewWork) {
        state.tools.last_tool = tools[tools.length - 1]
        state.tools.last_tool_at = new Date().toISOString()
        state.tools.tool_count += tools.length
        // A new trace means a new task: replace the tool set, don't grow it.
        if (traceId !== lastCounted.id) {
          state.tools.active_tools = [...new Set(tools)]
        } else {
          state.tools.active_tools = [...new Set([...state.tools.active_tools, ...tools])]
        }
      }
      lastCounted.id = traceId
      lastCounted.steps = stepTypes.length

      state.steps.current = stepTypes.length
      state.steps.max = 15

      if (t.total_tokens) state.telemetry.total_tokens = t.total_tokens
      if (t.duration_ms) state.telemetry.total_latency = t.duration_ms

      state.boot = 'dashboard'
    } else if (state.connection.connected) {
      state.boot = 'ready'
    }
  }

  async function poll() {
    if (running) return
    running = true

    try {
      // Health / connection
      const health = await fetchJson('/health')
      const connected = !!(health && health.status === 'ok')
      state.connection.status = connected ? 'connected' : 'disconnected'
      state.connection.connected = connected
      if (connected && !state.connection.last_connected_at) {
        state.connection.last_connected_at = new Date().toISOString()
        state.boot = state.boot === 'initializing' ? 'connecting' : state.boot
      }
      if (!connected) {
        state.session.status = 'idle'
        state.boot = 'initializing'
      }

      if (connected) {
        // Active model / agent
        const info = await fetchJson('/v1/info')
        if (info) {
          if (info.model) state.model.model = info.model
          if (info.engine) state.model.provider = info.engine
          if (info.agent) {
            // info.agent is an agent id like "e5fd6c81a465"; map to a node name
            state.agent.current_node = `${info.agent}-node`
          }
        }

        // Task lifecycle
        const traces = await fetchJson('/v1/traces')
        state.traces = (traces && traces.traces) || []

        // Managed agents (braindump, scheduler, body-double, coding)
        const agents = await fetchJson('/v1/managed-agents')
        if (agents && agents.agents) {
          state.agents = agents.agents
          const running = agents.agents.find((a) => a.status === 'running' || a.status === 'processing')
          if (running) {
            state.agent.current_node = `${running.name}-node`
            state.agent.workflow_state = 'IMPLEMENTING'
            state.model.status = 'streaming'
          } else if (agents.agents.length) {
            state.session.status = 'ready'
          }
          // Normalize a raw agent id (e.g. from /v1/info) to a friendly node name
          if (state.agent.current_node && !agentNodeNames.has(state.agent.current_node)) {
            const match = agents.agents.find((a) => a.id === state.agent.current_node.replace(/-node$/, ''))
            if (match) state.agent.current_node = `${match.name}-node`
          }
        }

        // Budget usage
        const budget = await fetchJson('/v1/budget')
        if (budget && budget.usage) {
          state.telemetry.tokens_today = budget.usage.tokens_today || 0
          state.telemetry.requests_this_hour = budget.usage.requests_this_hour || 0
          if (budget.limits && budget.limits.max_tokens_per_day) {
            state.steps.max = budget.limits.max_tokens_per_day
          }
        }

        // Telemetry
        const telemetry = await fetchJson('/v1/telemetry/stats')
        if (telemetry) {
          if (telemetry.total_tokens) state.telemetry.total_tokens = telemetry.total_tokens
          if (telemetry.total_cost) state.telemetry.total_cost = telemetry.total_cost
          if (telemetry.total_requests) state.telemetry.total_requests = telemetry.total_requests
          if (telemetry.avg_throughput_tok_per_sec) {
            state.telemetry.avg_throughput_tok_per_sec = telemetry.avg_throughput_tok_per_sec
          }
        }

        // Memory (may be unavailable if the Rust extension is not built)
        const memory = await fetchJson('/v1/memory/stats')
        if (memory && (memory.backend || memory.status === 'ok')) {
          state.memory.connected = true
          state.memory.memory_count = memory.entries != null ? memory.entries : 0
          if (memory.last_remembered_at) state.memory.last_remember_at = memory.last_remembered_at
          if (memory.last_recalled_at) state.memory.last_recall_at = memory.last_recalled_at
        } else {
          state.memory.connected = false
          state.memory.memory_count = 0
        }

        applyTelemetry()
      }

      notify()
    } catch {
      // Network failure — stay in initializing and retry on next poll.
      state.connection.status = 'disconnected'
      state.connection.connected = false
      state.boot = 'initializing'
      notify()
    } finally {
      running = false
    }
  }

  function connect() {
    if (pollTimer) return
    state.boot = 'connecting'
    state.connection.status = 'connecting'
    notify()
    poll()
    pollTimer = setInterval(poll, pollIntervalMs)
  }

  function disconnect() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    state.connection.status = 'disconnected'
    state.connection.connected = false
    state.boot = 'initializing'
    notify()
  }

  function getState() {
    return { ...state }
  }

  function subscribe(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  }

  function setBootPhase(phase) {
    state.boot = phase
    notify()
  }

  return { connect, disconnect, getState, subscribe, setBootPhase }
}