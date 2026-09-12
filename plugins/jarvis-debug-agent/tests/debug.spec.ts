/**
 * Tests for jarvis-debug-agent.
 *
 * Covers failure handling discipline: reproduce, root cause,
 * smallest-fix loop, and escalation when unresolved.
 */

import { describe, it, expect } from 'vitest'
import { debug, deriveRootCause, reproduce, DebugResult } from '../src/index.js'

describe('deriveRootCause', () => {
  it('extracts an error-like line', () => {
    const cause = deriveRootCause('some log\nTypeError: x is not a function\nat line 9')
    expect(cause).toContain('TypeError')
  })

  it('falls back for empty evidence', () => {
    expect(deriveRootCause('')).toBe('no failure evidence provided')
  })

  it('falls back for non-error lines', () => {
    const cause = deriveRootCause('just a normal log line')
    expect(cause).toContain('just a normal log line')
  })
})

describe('reproduce', () => {
  it('reports success on zero exit', () => {
    const res = reproduce('node -e "true"', process.cwd())
    expect(res.exitsZero).toBe(true)
  })

  it('reports failure on nonzero exit', () => {
    const res = reproduce('node -e "process.exit(1)"', process.cwd())
    expect(res.exitsZero).toBe(false)
  })
})

describe('debug', () => {
  it('returns resolved on dry run', () => {
    const result = debug({ cwd: process.cwd(), failure_evidence: 'boom', failing_commands: ['node -e "true"'], dryRun: true })
    expect(result.resolved).toBe(true)
    expect(result.reproduction).toBe('node -e "true"')
  })

  it('resolves when the reproduction passes', () => {
    const result = debug({
      cwd: process.cwd(),
      failure_evidence: 'TypeError: x',
      failing_commands: ['node -e "true"'],
    })
    expect(result.resolved).toBe(true)
    expect(result.root_cause).toContain('TypeError')
    expect(result.verification_commands).toContain('node -e "true"')
  })

  it('escalates when the failure does not resolve', () => {
    const result = debug({
      cwd: process.cwd(),
      failure_evidence: 'TypeError: x',
      failing_commands: ['node -e "process.exit(1)"'],
      maxCycles: 2,
    })
    expect(result.resolved).toBe(false)
    expect(result.findings.length).toBeGreaterThan(0)
  })
})
