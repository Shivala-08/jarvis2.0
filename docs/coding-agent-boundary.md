# Coding Agent Boundary

This document defines which capabilities JARVIS owns and which remain
delegated to OpenJarvis primitives. The JARVIS layer must NOT duplicate
OpenJarvis functionality.

## JARVIS-Owned (Build These)

| Capability | Description |
|------------|-------------|
| Project memory | `.jarvis/decisions.md` — non-trivial engineering decisions |
| Debug subagent | Reproduce failure, find smallest fix, return to verification |
| Verification subagent | Run tests, build, type-check, report PASS/FAIL with evidence |
| Ship subagent | Prepare diff, verify no secrets, await user confirmation |
| Hard step cap | 15-step maximum with human escalation |
| Escalation | Structured escalation state with reason and context |
| Span tracing | Append-only JSONL trace of every action |
| Verification gate | Structural gate: ship blocked unless verification.status === "ready" |
| Workflow orchestration | State machine governing PLAN → IMPLEMENT → VERIFY → REVIEW → SHIP |
| Role separation | Architect/Builder/Tester/Debugger/Reviewer/Ship distinct roles |

## OpenJarvis-Native (Do NOT Rebuild)

| Primitive | Description |
|-----------|-------------|
| Engine | Cloud model routing and provider management |
| Tools & Memory | File I/O, shell, search, memory persistence |
| Agent Orchestration | Subagent infrastructure, loop guards |
| Learning Loop | Skill benchmarking and auto-tuning |
| Tracing | Built-in trace collection |
| Skills | Skill discovery, loading, and execution |

## Rules

1. **JARVIS must not reimplement any OpenJarvis-native primitive.**
2. **JARVIS subagents are built ON TOP of OpenJarvis agent orchestration, not alongside it.**
3. **The verification gate is structural (code-enforced), not prompt-based.**
4. **The step cap applies to the entire workflow, including subagents.**
5. **Tracing is append-only and separate from OpenJarvis session logs.**
