# Walkthrough — Phase 3: Cloud Model Layer

All tasks for Phase 3 have been completed and verified.

## Changes Made

1.  **Provider Research & Decisions**:
    *   Created [docs/model-providers.md](file:///Users/pallav/Desktop/Jarvis2.0/docs/model-providers.md) documenting verified endpoints, authentication, limits, and quotas for Groq, Gemini, OpenRouter, and Cerebras as of 2026-08-24.
    *   Classified Groq and Gemini as **ACTIVE**; Cerebras and OpenRouter as **CONDITIONAL**.
    *   Selected **Gemini** (`gemini-1.5-pro`) as the primary coding provider due to its massive 2 Million token context window.

2.  **Plugin Implementation (`plugins/dsh-jarvis-models`)**:
    *   Defined internal interfaces in [`provider-types.ts`](file:///Users/pallav/Desktop/Jarvis2.0/plugins/dsh-jarvis-models/src/provider-types.ts).
    *   Developed [`provider-catalog.ts`](file:///Users/pallav/Desktop/Jarvis2.0/plugins/dsh-jarvis-models/src/provider-catalog.ts) mapping provider properties.
    *   Added environment-safe key validation in [`config.ts`](file:///Users/pallav/Desktop/Jarvis2.0/plugins/dsh-jarvis-models/src/config.ts).
    *   Built a reusable, dependency-free [`openai-adapter-base.ts`](file:///Users/pallav/Desktop/Jarvis2.0/plugins/dsh-jarvis-models/src/openai-adapter-base.ts) handling HTTP fetch, SSE parsing, and OpenAI chunk-to-DSH-stream translations.
    *   Subclassed the base adapter to implement [`groq-adapter.ts`](file:///Users/pallav/Desktop/Jarvis2.0/plugins/dsh-jarvis-models/src/groq-adapter.ts) (including parsing Groq-specific headers), [`gemini-adapter.ts`](file:///Users/pallav/Desktop/Jarvis2.0/plugins/dsh-jarvis-models/src/gemini-adapter.ts) (targeting the `/v1beta/openai` compatible route), [`cerebras-adapter.ts`](file:///Users/pallav/Desktop/Jarvis2.0/plugins/dsh-jarvis-models/src/cerebras-adapter.ts), and [`openrouter-adapter.ts`](file:///Users/pallav/Desktop/Jarvis2.0/plugins/dsh-jarvis-models/src/openrouter-adapter.ts).
    *   Implemented [`quota-tracker.ts`](file:///Users/pallav/Desktop/Jarvis2.0/plugins/dsh-jarvis-models/src/quota-tracker.ts) to track in-flight requests, daily token allowances, rate limit resets, and clock drift.
    *   Developed [`cloud-router.ts`](file:///Users/pallav/Desktop/Jarvis2.0/plugins/dsh-jarvis-models/src/cloud-router.ts) providing preference-based ranking, health filtering, and failover/retry delay calculations. Added secure structured logs.
    *   Created entry point [`index.ts`](file:///Users/pallav/Desktop/Jarvis2.0/plugins/dsh-jarvis-models/src/index.ts) that integrates with `ctx.llm` and registers routing tier providers (`routing`, `everyday`, `coding`).

3.  **Workspace Integration & Configuration**:
    *   Registered the plugin in the root [`cordis.yml`](file:///Users/pallav/Desktop/Jarvis2.0/cordis.yml).
    *   Registered the plugin using its absolute path in the isolated DSH profile patch [`cordis.patch.yml`](file:///Users/pallav/Desktop/Jarvis2.0/.dsh/profiles/web/cordis.patch.yml).

## Verification Results

*   **Isolated DSH Startup**: Confirmed DSH web starts up successfully on port `3080` without crashes, successfully loading the `@deepseek-ai/dsh-jarvis-models` plugin.
*   **Unit & Integration Test Suite**: 17 tests implemented across 5 spec files in `plugins/dsh-jarvis-models/tests` passing successfully:
    1.  `groq.spec.ts`: Validates streaming completions, usage parsing, failure conversion, and rate limit header tracking.
    2.  `gemini.spec.ts`: Verifies streaming completions and error mappings on Gemini's compatibility endpoint.
    3.  `quota.spec.ts`: Tests quota in-flight request tracking, token exhaustion blocks, resets, and clock drift.
    4.  `router.spec.ts`: Asserts preference ranking, unhealthy skips, failover selection, and retry delay calculation.
    5.  `integration.spec.ts`: Verifies everyday and coding tier routing calls hit the correct provider endpoints.
    6.  `failover.spec.ts`: Validates initial connection network failure redirects to backup, and mid-stream network read drops trigger failovers mid-chunk.
