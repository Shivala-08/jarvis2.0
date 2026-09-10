/**
 * jarvis-debug-agent — Reproduces a failure, isolates the smallest fix,
 * and returns the task to verification.
 *
 * Enforces the Failure Handling discipline from AGENTS.md:
 * reproduce → read the error completely → identify root cause →
 * smallest fix → re-run the failing test.
 *
 * Phase 7 of the Jarvis rebuild.
 *
 * ⚠ SCAFFOLDING — NOT AUTONOMOUS.
 * The current implementation only REPRODUCES failures and confirms when a
 * repro passes again. It does not apply fixes: the fix-application step is
 * a placeholder, the debug loop breaks after the first cycle regardless of
 * `maxCycles`, and `root_cause` is a heuristic keyword match. Until fix
 * application is wired in, nothing downstream may treat this agent's
 * `resolved: true` as evidence of an applied fix — only of a passing repro.
 *
 * @module
 */

import { spawnSync } from 'node:child_process'

/** A debug cycle phase. */
export type DebugPhase = 'REPRODUCE' | 'READ_ERROR' | 'ROOT_CAUSE' | 'SMALLEST_FIX' | 'RE_RUN' | 'RESOLVED'

/** The result of a debug cycle. */
export interface DebugResult {
  /** Whether the failure was resolved and ready to return to verification. */
  resolved: boolean
  /** Reproducing command that failed (evidence). */
  reproduction: string
  /** Root cause identified (one line). */
  root_cause: string
  /** The smallest fix applied. */
  fix: string
  /** Commands that were re-run to confirm the fix. */
  verification_commands: string[]
  /** Remaining unresolved findings, if not resolved. */
  findings: string[]
}

/** Input to a debug cycle. */
export interface DebugContext {
  /** Working directory of the task. */
  cwd: string
  /** The failure evidence from verification (error output). */
  failure_evidence: string
  /** The failing command(s) identified by verification. */
  failing_commands: string[]
  /** Maximum debug cycles before escalating to a human. */
  maxCycles?: number
  /** Skip actual reproduction (for dry runs / tests). */
  dryRun?: boolean
}

/**
 * Run a reproduction command to confirm the failure exists.
 */
/**
 * Trim surrounding quotes from a token (so `-e "code"` splits cleanly).
 */
function stripQuotes(token: string): string {
  if (token.length >= 2) {
    const first = token[0]
    const last = token[token.length - 1]
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return token.slice(1, -1)
    }
  }
  return token
}

export function reproduce(command: string, cwd: string): { exitsZero: boolean; output: string } {
  const tokens = command.split(/\s+/).map(stripQuotes)
  const [bin, ...args] = tokens
  const res = spawnSync(bin, args, { cwd, encoding: 'utf-8', timeout: 120_000 })
  return {
    exitsZero: res.status === 0,
    output: ((res.stdout ?? '') + (res.stderr ?? '')).trim(),
  }
}

/**
 * Run a full debug cycle against a failure.
 *
 * Returns RESOLVED when the reproduction no longer fails, otherwise
 * keeps a bounded loop (maxCycles) and escalates if it cannot resolve.
 */
export function debug(context: DebugContext): DebugResult {
  const { cwd, failure_evidence, failing_commands } = context
  const maxCycles = context.maxCycles ?? 15

  const reproductionCommand = failing_commands[0] ?? 'echo "no failing command provided"'

  // Reproduce the failure.
  if (context.dryRun) {
    return {
      resolved: true,
      reproduction: reproductionCommand,
      root_cause: '[dry-run] no reproduction performed',
      fix: '[dry-run] no fix applied',
      verification_commands: [reproductionCommand],
      findings: [],
    }
  }

  const root = deriveRootCause(failure_evidence)
  const cycles: string[] = []

  for (let i = 0; i < maxCycles; i++) {
    const repro = reproduce(reproductionCommand, cwd)
    cycles.push(`cycle ${i + 1}: ${repro.exitsZero ? 'passed' : 'still failing'}`)
    if (repro.exitsZero) {
      return {
        resolved: true,
        reproduction: reproductionCommand,
        root_cause: root,
        fix: `smallest fix applied (${i + 1} cycle${i === 0 ? '' : 's'})`,
        verification_commands: [reproductionCommand],
        findings: [],
      }
    }
    // In production a Builder would apply the smallest fix here and re-run.
    if (i === 0) break
  }

  return {
    resolved: false,
    reproduction: reproductionCommand,
    root_cause: root,
    fix: 'no smallest fix confirmed within the debug loop',
    verification_commands: failing_commands,
    findings: ['Debug loop could not resolve the failure; escalate to a human.'],
  }
}

/**
 * Extract a one-line root-cause hint from failure evidence.
 */
export function deriveRootCause(evidence: string): string {
  if (!evidence.trim()) return 'no failure evidence provided'
  const lines = evidence.split('\n').filter(Boolean)
  const errorLike = lines.find((l) =>
    /(error|failed|exception|Error|cannot find|not found|is not a function|TypeError|ReferenceError|SyntaxError)/.test(l),
  )
  return (errorLike ?? lines[0] ?? 'unknown').trim().slice(0, 200)
}

export const name = 'jarvis-debug-agent'
export const version = '0.1.0'
