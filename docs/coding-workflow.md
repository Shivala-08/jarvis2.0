# Coding Workflow Contract

## Mandatory State Machine

```
REQUESTED
    ↓
PLANNING
    ↓
PLAN_READY
    ↓  (requires approval)
APPROVED
    ↓
IMPLEMENTING
    ↓
VERIFYING
    │
    ├── FAIL → DEBUGGING → VERIFYING
    │
    └── PASS → REVIEWING
                 │
                 ├── FAIL → DEBUGGING → VERIFYING → REVIEWING
                 │
                 └── PASS → READY_TO_SHIP
                              ↓
                         SHIPPING
                              ↓
                    AWAITING_CONFIRMATION
                              ↓
                          SHIPPED
```

## Legal Transitions

| From | To | Condition |
|------|----|-----------|
| REQUESTED | PLANNING | Task received |
| PLANNING | PLAN_READY | Plan complete |
| PLAN_READY | IMPLEMENTING | Plan approved |
| IMPLEMENTING | VERIFYING | Implementation complete |
| VERIFYING | DEBUGGING | Verification failed |
| VERIFYING | REVIEWING | Verification passed |
| DEBUGGING | VERIFYING | Fix applied |
| REVIEWING | DEBUGGING | Review rejected |
| REVIEWING | READY_TO_SHIP | Review passed |
| READY_TO_SHIP | SHIPPING | Ship initiated |
| SHIPPING | AWAITING_CONFIRMATION | Ship prepared |
| AWAITING_CONFIRMATION | SHIPPED | User confirmed |

## Illegal Transitions (Must Reject)

| From | To | Why |
|------|----|-----|
| REQUESTED | SHIP | No verification |
| IMPLEMENTING | SHIP | No verification |
| VERIFYING | SHIP | Not verified |
| REVIEWING | SHIP | Not reviewed |
| DEBUGGING | SHIP | Not verified |
| Any | SHIP | Unless verification.status === "ready" AND review passed |

## Hard Gates

1. **Verification gate**: `ship-agent` cannot execute unless `verification.status === "ready"`. Enforced in code, not prompts.
2. **Review gate**: Independent reviewer must pass before ship.
3. **Step cap**: 15-step maximum. Exceeding causes human escalation.
4. **User confirmation**: Required before any irreversible shipping action.

## Role Separation

| Role | Responsibilities | Must NOT |
|------|-----------------|----------|
| Architect | Read, analyze, plan | Write implementation code |
| Builder | Implement approved plan | Change the plan |
| Tester (Verification) | Verify contract, run tests | Broad fixes |
| Debugger | Reproduce, smallest fix, return | Rewrite architecture |
| Reviewer | Find reasons NOT to ship | Confirm it looks fine |
| Ship-agent | Ship after all gates | Override verification |

## Expected Behavior Contract

For every non-trivial coding task:

```
PLAN + EXPECTED_BEHAVIOR + TEST → IMPLEMENTATION
```

Verification receives expected behavior BEFORE implementation.
This prevents "I ran whatever tests happened to exist."

## Invariants

1. **No shortcut around the state machine.**
2. **Verification is structural, not advisory.**
3. **Every action is traced.**
4. **Step cap is absolute.**
5. **User confirms before shipping.**
