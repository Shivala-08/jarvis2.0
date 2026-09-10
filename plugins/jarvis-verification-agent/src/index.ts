/**
 * jarvis-verification-agent — Runs the suite and reports PASS/FAIL with evidence.
 *
 * A hard gate in the coding workflow: ship cannot proceed unless
 * status is 'ready'. This agent runs the expected-behavior contract
 * BEFORE the reviewer/shipper are invoked.
 *
 * Phase 7 of the Jarvis rebuild.
 *
 * @module
 */

import { spawnSync } from 'node:child_process'

/** A verification result, mirroring the workflow contract. */
export interface VerificationResult {
  status: 'pending' | 'failed' | 'ready'
  evidence: string[]
  tests_passed: boolean
  build_passed: boolean
  typecheck_passed: boolean
}

/** Verification runner configuration. */
export interface VerificationConfig {
  /** Working directory for the commands. */
  cwd: string
  /** Command to run tests (default). */
  testCommand?: string
  /** Command to run the build. */
  buildCommand?: string
  /** Command to run the typecheck. */
  typecheckCommand?: string
  /** Skip execution and return a synthetic result (for dry runs / tests). */
  dryRun?: boolean
}

/** A single command execution snapshot. */
export interface CommandResult {
  command: string
  exitCode: number
  passed: boolean
  output: string
}

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

/**
 * Run a shell command and capture its result.
 */
export function runCommand(command: string, cwd: string): CommandResult {
  const tokens = command.split(/\s+/).map(stripQuotes)
  const [bin, ...args] = tokens
  const res = spawnSync(bin, args, {
    cwd,
    encoding: 'utf-8',
    shell: false,
    timeout: 120_000,
  })

  const output = (res.stdout ?? '') + (res.stderr ?? '')
  return {
    command,
    exitCode: res.status ?? -1,
    passed: res.status === 0,
    output: output.trim(),
  }
}

/**
 * Run the full verification suite and return a VerificationResult.
 *
 * If any gate fails the status is 'failed'. Only when every configured
 * command passes is the status 'ready'.
 */
export function verify(config: VerificationConfig): VerificationResult {
  const cwd = config.cwd
  const testCommand = config.testCommand ?? 'npm test'
  const buildCommand = config.buildCommand ?? 'npm run build'
  const typecheckCommand = config.typecheckCommand

  if (config.dryRun) {
    return {
      status: 'ready',
      evidence: ['[dry-run] verification executed'],
      tests_passed: true,
      build_passed: true,
      typecheck_passed: true,
    }
  }

  const commands: string[] = [testCommand]
  if (buildCommand) commands.push(buildCommand)
  if (typecheckCommand) commands.push(typecheckCommand)

  const evidence: string[] = []
  const results = commands.map((cmd) => runCommand(cmd, cwd))

  for (const r of results) {
    evidence.push(
      r.passed
        ? `✓ ${r.command} (exit ${r.exitCode})`
        : `✗ ${r.command} (exit ${r.exitCode})\n${r.output.slice(0, 2000)}`,
    )
  }

  const tests = results[0]
  const build = buildCommand ? results[1] : undefined
  const typecheck = typecheckCommand ? (buildCommand ? results[2] : results[1]) : undefined

  const tests_passed = tests?.passed ?? false
  const build_passed = build ? build.passed : true
  const typecheck_passed = typecheck ? typecheck.passed : true

  const allPassed = tests_passed && build_passed && typecheck_passed

  return {
    status: allPassed ? 'ready' : 'failed',
    evidence,
    tests_passed,
    build_passed,
    typecheck_passed,
  }
}

/**
 * Check whether a VerificationResult satisfies the structural ship gate.
 */
export function canShip(result: VerificationResult): boolean {
  return result.status === 'ready'
}

export const name = 'jarvis-verification-agent'
export const version = '0.1.0'
