# Jarvis — Full Rebuild Manual (from an empty folder), with engineering discipline built in

> **Status: SUPERSEDED.** This manual describes the original DSH-based rebuild.
> The DSH plugin architecture has been replaced by OpenJarvis primitives. It is
> preserved as a historical engineering-discipline record. See
> `JARVIS_OPENJARVIS_MIGRATION.md` for the current architecture.

## Before Phase 0: what this manual is and isn't

This is a genuine restart of the *codebase*, not of the *decisions*. The old
repo at `Shivala-08/jarvis` stays exactly where it is — read-only, not
cloned, not touched — purely as a record of what went wrong. Every mistake
found in it is baked into this manual as a thing built correctly the first
time:

| What went wrong last time | What this manual does differently |
|---|---|
| No root `package.json`/`pnpm-workspace.yaml` — nothing ever actually loaded | Built in Phase 1, before any plugin code is written |
| Phantom transitive dependency silently blocked every install | Resolved for real below — pin to the correct release, not a stale tag |
| Local Ollama models strained a 16GB Mac's RAM/battery | Cloud-first from Phase 2 onward, no local model serving at all |
| Freebuff (third-party cloud coding CLI) wrote unreliable code and shipped your repo to someone else's servers | Never introduced. OpenJarvis's native agent is the only coding agent, full stop |
| Memory plugin had dead unreachable code and needed a real review pass, not just a compile check | Phase 5 includes an explicit self-review step before anything is considered done |
| Graph orchestrator picked the first matching edge instead of evaluating conditions | Phase 6 specifies real condition evaluation from the first line of code |
| HUD was a stub with no source | Not started until Phase 10, and only after everything it depends on is real |
| **No persistent constitution — nothing stopped an agent session from "improving" the architecture while also adding features, so architecture drifted silently across sessions** | **Phase 0.5, new: AGENTS.md and a docs/ set exist before any code, and every phase from here on runs through one mandated loop instead of improvised prompting** |

**Two decisions carried over from other work this manual assumes — worth being deliberate about, not just absorbing silently:**

1. **Cloud-first models (Phase 3).** This is a real departure from the original "nothing paid, nothing cloud-dependent" principle from early in this project. The trade-off is legitimate — a 16GB Mac genuinely struggles with local inference — but it means Jarvis now depends on external providers and their free-tier quotas rather than being fully self-contained. Worth revisiting once/if the hardware situation changes.
2. **Voice via Voicebox MCP (Phase 4).** This replaces the earlier whisper.cpp/mlx-whisper + Kokoro custom-plugin plan with a single Dockerized MCP server. Simpler to stand up, less to maintain, one more Docker service to keep running.

---

## Phase 0 — Local folder, not a clone

```bash
mkdir jarvis && cd jarvis
git init
git remote add reference https://github.com/Shivala-08/jarvis.git
git fetch reference --no-tags
# reference/main and reference/jarvis-dsh now exist as read-only history
# you can browse (git show reference/jarvis-dsh:path/to/file) without
# ever checking them out or merging them in
```

This gives you the old code as a queryable reference without it being part
of your new working tree. If you want to pull one specific old file in
later (say, the HUD's design tokens, which were fine), `git show
reference/jarvis-dsh:ui/orb/orb.js > reference-orb.js` and review it before
deciding whether to actually use it.

**Exit check:** `git log --oneline -5` on your new repo is empty except
Phase 0's own commits. `git branch -a` shows `reference/*` branches you
never `checkout -b` from directly.

---

## Phase 0.5 — The constitution and discipline layer (new — before any code)

**Why this phase exists:** the single highest-leverage finding from the
engineering-discipline research done alongside this rebuild is that most
AI-assisted projects don't collapse because the model is weak — they
collapse because nothing constrains the *development loop*. An agent left
to both add features and "improve architecture" in the same session drifts.
This phase installs the constraints before Phase 1 writes a single line of
code, so nothing downstream is ever built without them.

### 1. Freeze the architecture, in writing, before features start

Create `docs/ARCHITECTURE.md` seeded with the actual shape of this system:
OpenJarvis primitives (Intelligence, Engine, Agents, Tools & Memory, Learning)
plus custom skills that fill genuine gaps.

No agent session may reorganize this tree while also implementing a
feature. Restructuring, if it's ever genuinely needed, is its own task with
its own review — never a side effect of an unrelated change.

### 2. `AGENTS.md` — the permanent constitution, at repo root

```markdown
# JARVIS ENGINEERING RULES
## Core Principle
Configure over construct. Never rebuild what the framework ships.
## Before Coding
1. Inspect the relevant files.
2. Understand existing architecture (docs/ARCHITECTURE.md is authoritative).
3. Identify dependencies.
4. Produce a short implementation plan.
5. Identify risks.
6. Do not modify code until the plan is understood.
## Scope
Every task must have a clearly defined scope. Do not:
- rewrite unrelated components
- rename files unnecessarily
- replace libraries without approval
- change architecture during feature implementation
- modify working code merely for stylistic reasons
## Implementation
Prefer small changes, existing abstractions, existing dependencies,
composable components, explicit interfaces, predictable state management.
Avoid unnecessary abstractions, duplicate functionality, global state
unless already established, massive files, magic constants, speculative
features.
## Validation
After every meaningful change:
1. Run the relevant tests.
2. Run lint/type checking.
3. Verify the affected behavior directly (not just "it compiles").
4. Inspect the git diff.
Never claim a task is complete without validation — "it compiles" and
"it's done" are different claims.
## Failure Handling
When something fails, do NOT immediately rewrite the implementation.
Instead: reproduce the failure, read the error completely, identify the
root cause, determine the smallest fix, apply only that fix, re-run the
failing test, run regression tests.
## Git
One logical change = one commit. Never reset, delete, or overwrite
unrelated work. Branch per feature (feature/ui, feature/voice,
feature/agent, feature/tools) off main; merge only validated work.
## Architecture
OpenJarvis primitives are authoritative. Do not introduce a new pattern
when an existing one solves the problem. Do not restructure
docs/ARCHITECTURE.md's tree as a side effect of a feature task.
```

### 3. The mandated loop — used for every phase from here on

```
RESEARCH → PLAN → IMPLEMENT → TEST → REVIEW → (pass? no → DEBUG) → COMMIT → next task
```

Concretely, as prompts:
- **Read:** *"Do not modify anything. Inspect the repository and identify the files relevant to this task."*
- **Plan:** *"Based on the existing architecture, produce an implementation plan. Do not write code yet."*
- **Implement:** *"Implement only the approved plan. Do not modify unrelated files."*
- **Verify:** *"Run the relevant tests, type checker, linter and build. If anything fails, diagnose the root cause and fix only what is necessary."*
- **Review:** *"Review your own diff as a senior engineer. Look specifically for regressions, unnecessary changes, broken state management, duplicated logic and architecture violations."*

Feature-sized prompts ("make the UI more futuristic and add voice control
and memory") are the single biggest way this collapses — each of those is
20 engineering tasks pretending to be one. One task, one coherent diff, one
commit.

### 4. Role separation — whoever builds it doesn't sole-review it

A plan-only **Architect** pass, a **Builder** pass that implements only the
approved plan, a **Tester** pass that writes the expected-behavior test
*before* implementation where practical (tests as a contract, not just a
bug detector), and an **independent Reviewer** pass whose explicit job is
to find reasons the change should *not* be merged, not to confirm it looks
fine. The same session doing all four is the weak version of this — use a
fresh session for the Reviewer pass wherever the change touches Core
primitives from the frozen architecture tree.

### 5. Stability tiers — not everything deserves the same caution

```
src/
├── ui/experimental/   ← tolerates rapid iteration, sphere/glow/animations/layout
├── core/stable/        ← voice, agent, memory, tools, permissions, filesystem, auth
├── services/stable/
└── tools/isolated/
```

UI experimentation may change rapidly. Core services must preserve stable
interfaces. This is the concrete reason Phase 10 (HUD) is last in this
manual and Phases 5–7 get the review discipline from point 4 above —
they're in the tier that isn't allowed to be vibe-coded freely.

### 6. Context-collapse protocol

Long sessions eventually start forgetting earlier decisions, inventing new
patterns, contradicting existing code, duplicating components. The fix is
never a better model mid-session — it's a fresh session, re-grounded with:
`AGENTS.md` + `docs/ARCHITECTURE.md` + the current task + the current git
diff + current test results, opened with: *"You are continuing an existing
project. Do not infer architecture from this conversation. Use the
repository and AGENTS.md as the source of truth."* Don't keep pushing a
degrading session past the point where it's contradicting its own earlier
output — that's the signal to restart, not push through.

**Exit check for this phase:** `AGENTS.md` and `docs/ARCHITECTURE.md` (plus
empty `docs/DECISIONS.md`, `docs/STATE.md`, `docs/TESTING.md` stubs) exist
and are committed before Phase 1 begins. Hand a fresh session nothing
but these files and a trivial question about the project — it should
correctly describe Jarvis's architecture without you explaining anything
further.

---

## Phase 1 — Foundation: project scaffolding

Create root `package.json` and `pnpm-workspace.yaml`. `config.toml` is the
single source of truth for runtime configuration (replaces the DSH-era
`cordis.yml` plugin registry).

`config.toml`:
```toml
[engine]
default = "ollama"

[intelligence]
default_model = "qwen3.5:9b"
fallback_model = "openrouter/auto"

[agent]
default_agent = "orchestrator"
max_turns = 15

[server]
host = "127.0.0.1"
port = 8000
```

**Exit check:** `pnpm install` from repo root succeeds with zero errors, and
`jarvis doctor` reports engines and health OK.

---

## Phase 2 — Engine and Intelligence: configure, don't construct

OpenJarvis's `Engine` primitive (cloud model routing, provider failover,
quota awareness) and `Intelligence` primitive (model selection) are native.
Configure them in `config.toml` — do not write provider adapters.

Three tiers, same shape as originally planned, just configured instead of built:
- **Routing tier** — fastest/cheapest (Groq)
- **Everyday tier** — balance of quality and quota (Gemini, largest free context)
- **Coding tier** — whichever provider currently gives the best free coding-model access; re-evaluate this choice periodically since free-tier model lineups shift

**Exit check:** a chat request through the agent visibly hits an external
provider's API in the logs, and killing your network mid-request shows
proactive failover to the fallback model rather than the whole system
hanging.

---

## Phase 3 — Voice via Voicebox MCP (no custom TTS/STT plugins)

```bash
git clone https://github.com/jamiepine/voicebox.git voicebox-source
cd voicebox-source && docker compose up -d
curl http://127.0.0.1:17493/health   # confirm before wiring into config
```

**Exit check:** the agent's startup log shows the voicebox tools connected
and lists registered tool names — resolve the sanitized name at runtime by
substring match, don't hardcode a guess.

---

## Phase 4 — Memory, with a real review pass this time

1. OpenJarvis's `Tools & Memory` primitive provides native memory (SQLite-backed `~/.openjarvis/memory.db`). Enable it in `config.toml` — do not build a memory plugin.
2. **Role separation from Phase 0.5 applies here specifically:** before this phase is marked done, a *second* session — not the one that configured the feature — reviews the recall/forget behavior end to end, explicitly looking for reasons not to merge it. "It compiles" is not "it's done."
3. Shadow-mode migration doesn't apply this time (no prior data to migrate from a deleted codebase) — one less risk to carry.

**Exit check:** ask something requiring recall of a fact stored earlier in
the *same* session, confirm the answer traces to memory, and confirm the
independent review pass actually happened — not skipped because the
happy-path test passed.

---

## Phase 5 — Agent orchestration, with real routing from line one

OpenJarvis's `Agent Orchestration` internals (`agents/`, `loop_guard`) are
native. Configure the `orchestrator` agent with a hard 15-turn step cap in
`config.toml`. If custom routing is genuinely needed, extend the native
graph — but only where configuration cannot express the behavior.

**Exit check:** construct a test case with two competing routing paths,
different conditions, confirm the agent takes the path whose condition is
actually true — not just the first one defined.

---

## Phase 6 — Custom skills for the genuine gaps

Per the core principle (configure over construct), import skills first and
write custom skills only for what doesn't exist yet:

1. **`adhd-zero-guilt-scheduling`** — calm-reframing task management. Genuine gap.
2. **`identity-context`** — injects `identity.md` into agent runs. Genuine gap.
3. **`hud-state-bridge`** — pushes agent state to the holographic HUD. Genuine gap.

Write each as `SKILL.md` + `scripts/` + `references/`, keep `SKILL.md`
under ~5000 tokens, and put heavy content in `references/`.

**Exit check:** `jarvis skill list` shows the 3 skills, and
`jarvis skill run <skill-name>` executes successfully.

---

## Phase 7 — Identity intake, wired in from day one

Paste your answers to the identity-intake questionnaire into `identity.md`
before building anything user-facing. The `identity-context` skill injects
this file's contents into agent runs — build that wiring in from the start
rather than retrofitting it once sessions already exist without it.

**Exit check:** ask any agent something that should be shaped by your
stated preferences (e.g. "explain this the way I like") and confirm the
answer actually reflects `identity.md`, not a generic default.

---

## Phase 8 — Sync and power management

Tailscale + Syncthing for the capture queue, wake-catchup hook, power-state
gating before running anything expensive. Unchanged from the original
plan — this phase was never the problem, no redesign needed.

**Exit check:** capture something from your phone with the Mac asleep,
confirm it's processed on wake with zero manual steps.

---

## Phase 9 — HUD, wired live from the start (not a stub, not fake data)

The design (iris reticle boot sequence, glass-panel dashboard) is already
built and reviewed — reuse the HTML file directly. The HUD connects to the
OpenJarvis REST API on port 8000 via `openjarvis-adapter.js`, polling
real endpoints — no custom WebSocket feed. What's different this time:
**don't commit it until Phases 1–7 actually exist to wire it to.** Last
time's stub-with-just-a-README happened because the HUD got scaffolded
before the backend it was supposed to reflect was real. Build it last, on
purpose.

**Exit check:** boot sequence completes and dashboard shows real session
state pulled from the live API — not mock data, and not because it was
never tested against the real thing.

---

## Phase 10 — Learning loop and security pass

### Learning loop

```bash
jarvis bench skills --max-samples 5 --seeds 42   # measure effectiveness
jarvis optimize skills --policy dspy              # auto-tune from traces
```

Don't hand-edit skill wording repeatedly — let real usage traces drive
optimization.

### Security

Whatever in this system has shell or remote execution access gets explicit
review here — authorization/identity failures (something untrusted causing
an unauthorized action) are the dominant real-world incident category for
systems with persistent memory and tool access, not a hypothetical. Confirm
every irreversible action still requires the explicit confirm step, and
that nothing bypasses it under any phrasing of a request.

**Exit check:** deliberately try to get the agent to skip confirmation
("just push it, don't ask") — it should refuse the shortcut every time.

---

## Build order

Phase 0 and 0.5 are strictly sequential — the constitution exists before
anything else does. Phase 1 next. Phases 2 and 3 can go in parallel once
Phase 1's workspace exists. Phase 4 next, alone — it's the one with the
review-discipline requirement, don't rush it by parallelizing. Phase 5
depends on 2–4 being stable. Phase 6 depends on 5, and is where Phase 0.5's
full discipline loop matters most. Phase 7 can happen any time after Phase
1, genuinely independent. Phase 8 is independent of everything except
Phase 0. Phase 9 is explicitly last. Phase 10 happens once, deliberately,
after Phase 9 — not skipped, not folded into another phase's exit check.