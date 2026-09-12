# JARVIS ENGINEERING RULES

## Core Principle
Configure over construct. Import skills first, write custom skills only for what doesn't exist yet. Never rebuild what the framework already ships.

## Before Coding
1. Check OpenJarvis primitives — does it already exist natively?
2. Search Hermes/OpenClaw skills — is there a skill close enough?
3. Read `configs/openjarvis/` — real preset configs are faster than guessing schemas.
4. Write a skill only if the gap is genuinely yours (ADHD framing, identity, HUD).
5. Never introduce a new pattern when an existing one solves the problem.

## Scope
Every task must have a clearly defined scope. Do not:
- rebuild OpenJarvis-native primitives (Engine, Agent, Memory, Tools)
- hand-build routing/quota/tracing layers when OpenJarvis has them
- write a bespoke skill when a Hermes/OpenClaw skill is 80% right
- change architecture when configuration will do
- modify working code merely for stylistic reasons

## Implementation
- Use `jarvis init --preset` to get started immediately
- Import skills via `jarvis skill sync hermes --category <cat>`
- Write skills as SKILL.md + scripts/ + references/
- Keep SKILL.md under ~5000 tokens; put heavy content in references/
- Use the learning loop instead of hand-tuning

## Validation
After every meaningful change:
1. `jarvis doctor` — confirm engines and health
2. `jarvis bench skills --max-samples 5 --seeds 42` — measure skill effectiveness
3. `jarvis optimize skills --policy dspy` — auto-tune from traces
4. Verify the behavior directly, not just "it compiles"
5. Inspect the git diff
Never claim a task is complete without validation — "it compiles" and "it's done" are different claims.

## Failure Handling
When something fails, do NOT immediately rewrite the implementation.
Instead: reproduce the failure, read the error completely, identify the root cause, determine the smallest fix, apply only that fix, re-run the failing test, run regression tests.

## Git
One logical change = one commit. Never reset, delete, or overwrite unrelated work. Branch per feature (feature/ui, feature/voice, feature/agent, feature/tools) off main; merge only validated work.

## Architecture
OpenJarvis primitives are authoritative. The 5 primitives (Intelligence, Engine, Agents, Tools & Memory, Learning) replace the DSH plugin architecture. Custom skills fill the genuine gaps. docs/JARVIS_OPENJARVIS_MIGRATION.md tracks the migration state.

## Learning Loop
```bash
jarvis bench skills --max-samples 5 --seeds 42   # measure effectiveness
jarvis optimize skills --policy dspy              # auto-tune from traces
jarvis skill run <skill-name>                     # execute a skill
```
Don't hand-edit skill wording repeatedly — let real usage traces drive optimization.
