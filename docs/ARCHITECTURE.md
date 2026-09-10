# JARVIS ARCHITECTURE

```
OpenJarvis (5 Primitives)
│
├── Intelligence    (5 cloud engines + auto-routing)
├── Engine          (Inference runtime: Ollama, Nim, Cloud)
├── Agents          (orchestrator, code-assistant, loop_guard)
├── Tools & Memory  (SQLite storage, MCP, skill system)
└── Learning        (bench, optimize, traces)

Custom Skills:
├── adhd-zero-guilt-scheduling  (calm reframing)
├── identity-context            (user identity injection)
└── hud-state-bridge            (holographic HUD state)

HUD: http://127.0.0.1:8000 (OpenJarvis serve)
Migration: docs/JARVIS_OPENJARVIS_MIGRATION.md
```
