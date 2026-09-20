// src/state/types.ts
function createInitialHudState() {
  return {
    boot: "initializing",
    connection: {
      status: "disconnected",
      connected: false,
      latency_ms: null,
      last_connected_at: null
    },
    session: {
      session_id: null,
      status: "idle",
      duration_ms: 0,
      started_at: null
    },
    agent: {
      current_node: null,
      workflow_state: "REQUESTED",
      nodes_visited: []
    },
    model: {
      provider: null,
      model: null,
      status: "idle",
      tier: null
    },
    tools: {
      active_tools: [],
      last_tool: null,
      last_tool_at: null,
      tool_count: 0
    },
    verification: {
      status: "pending",
      tests_passed: null,
      last_verified_at: null
    },
    memory: {
      connected: false,
      last_remember_at: null,
      last_recall_at: null,
      memory_count: 0
    },
    voice: {
      connected: false,
      speaking: false,
      listening: false,
      last_active_at: null
    },
    steps: {
      current: 0,
      max: 15,
      escalated: false,
      escalation_reason: null
    },
    telemetry: {
      total_tokens: 0,
      total_cost: 0,
      total_requests: 0,
      tokens_today: 0,
      requests_this_hour: 0,
      avg_throughput_tok_per_sec: 0,
      total_latency: 0
    },
    traces: [],
    agents: []
  };
}
export {
  createInitialHudState
};
