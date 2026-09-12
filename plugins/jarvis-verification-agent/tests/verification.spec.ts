/**
 * Tests for jarvis-verification-agent.
 *
 * Covers the hard gate: status transitions, build/typecheck/tests,
 * and the canShip structural check.
 */

import { describe, it, expect } from 'vitest'
import { verify, canShip, runCommand } from '../src/index.js'

describe('canShip gate', () => {
  it('returns true only when status is ready', () => {
    expect(canShip({ status: 'ready', evidence: [], tests_passed: true, build_passed: true, typecheck_passed: true })).toBe(true)
    expect(canShip({ status: 'failed', evidence: [], tests_passed: false, build_passed: true, typecheck_passed: true })).toBe(false)
    expect(canShip({ status: 'pending', evidence: [], tests_passed: false, build_passed: false, typecheck_passed: false })).toBe(false)
  })
})

describe('verify', () => {
  it('returns ready on dry run', () => {
    const result = verify({ cwd: process.cwd(), dryRun: true })
    expect(result.status).toBe('ready')
    expect(result.evidence.length).toBeGreaterThan(0)
  })

  it('returns ready when a real command passes', () => {
    const result = verify({ cwd: process.cwd(), testCommand: 'node -e "true"', buildCommand: 'node -e "true"', typecheckCommand: 'node -e "true"' })
    expect(result.status).toBe('ready')
    expect(result.tests_passed).toBe(true)
    expect(result.build_passed).toBe(true)
    expect(result.typecheck_passed).toBe(true)
  })

  it('returns failed when a command fails', () => {
    const result = verify({ cwd: process.cwd(), testCommand: 'node -e "process.exit(1)"', buildCommand: 'node -e "true"' })
    expect(result.status).toBe('failed')
    expect(result.tests_passed).toBe(false)
    expect(result.build_passed).toBe(true)
  })
})

describe('runCommand', () => {
  it('captures passing exit code', () => {
    const res = runCommand('node -e "true"', process.cwd())
    expect(res.passed).toBe(true)
    expect(res.exitCode).toBe(0)
  })

  it('captures failing exit code', () => {
    const res = runCommand('node -e "process.exit(3)"', process.cwd())
    expect(res.passed).toBe(false)
    expect(res.exitCode).toBe(3)
  })
})
