# JARVIS ENGINEERING RULES

## Core Principle
Never make broad changes when a local change will solve the problem.

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
Prefer small changes, existing abstractions, existing dependencies, composable components, explicit interfaces, predictable state management.
Avoid unnecessary abstractions, duplicate functionality, global state unless already established, massive files, magic constants, speculative features.

## Validation
After every meaningful change:
1. Run the relevant tests.
2. Run lint/type checking.
3. Build the plugin(s) affected.
4. Verify the affected behavior directly (not just "it compiles").
5. Inspect the git diff.
Never claim a task is complete without validation — "it compiles" and "it's done" are different claims. This exact gap is what let the old memory plugin's dead code through last time.

## Failure Handling
When something fails, do NOT immediately rewrite the implementation.
Instead: reproduce the failure, read the error completely, identify the root cause, determine the smallest fix, apply only that fix, re-run the failing test, run regression tests.

## Git
One logical change = one commit. Never reset, delete, or overwrite unrelated work. Branch per feature (feature/ui, feature/voice, feature/agent, feature/tools) off main; merge only validated work.

## Architecture
docs/ARCHITECTURE.md is authoritative. Do not introduce a new pattern when an existing one solves the problem. Do not restructure docs/ARCHITECTURE.md's tree as a side effect of a feature task.
