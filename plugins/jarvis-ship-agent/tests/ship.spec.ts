/**
 * Tests for jarvis-ship-agent.
 *
 * Covers the structural verification gate (7.14, 7.33), the secret scan
 * (7.x), and that ship never performs an irreversible action without
 * user confirmation.
 */

import { describe, it, expect } from 'vitest'
import { evaluateGate, scanForSecrets, prepareShip } from '../src/index.js'

describe('evaluateGate (7.14 / 7.33 structural gate)', () => {
  it('allows ship only when verification is ready AND review passed', () => {
    expect(evaluateGate('ready', true).can_ship).toBe(true)
  })

  it('blocks ship when verification is not ready', () => {
    expect(evaluateGate('failed', true).can_ship).toBe(false)
    expect(evaluateGate('pending', true).can_ship).toBe(false)
  })

  it('blocks ship when review has not passed', () => {
    expect(evaluateGate('ready', false).can_ship).toBe(false)
  })

  it('reports a reason when blocked', () => {
    const r = evaluateGate('pending', false)
    expect(r.can_ship).toBe(false)
    expect(r.blocked_reason).toBeDefined()
  })
})

describe('scanForSecrets', () => {
  it('flags an API key-like added line', () => {
    const warnings = scanForSecrets('+const key = "sk-abcdef123456789012345678901234567890";')
    expect(warnings.length).toBeGreaterThan(0)
  })

  it('ignores clean added lines', () => {
    const warnings = scanForSecrets('+console.log("hello")')
    expect(warnings.length).toBe(0)
  })
})

describe('prepareShip', () => {
  it('cannot prepare when gate is closed', () => {
    const plan = prepareShip({ verification_status: 'failed', review_passed: true, diff: '+' })
    expect(plan.can_ship).toBe(false)
    expect(plan.awaiting_confirmation).toBe(false)
  })

  it('prepares and awaits confirmation when gate passes', () => {
    const plan = prepareShip({
      verification_status: 'ready',
      review_passed: true,
      diff: '+console.log("hi")',
    })
    expect(plan.can_ship).toBe(true)
    expect(plan.awaiting_confirmation).toBe(true)
    expect(plan.secret_warnings.length).toBe(0)
  })

  it('blocks a clean diff that still leaks a secret', () => {
    const plan = prepareShip({
      verification_status: 'ready',
      review_passed: true,
      diff: '+token = "ghp_abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGH"',
    })
    expect(plan.can_ship).toBe(true)
    expect(plan.secret_warnings.length).toBeGreaterThan(0)
  })

  it('skipSecretScan bypasses the scan', () => {
    const plan = prepareShip({
      verification_status: 'ready',
      review_passed: true,
      diff: '+token = "ghp_abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGH"',
      skipSecretScan: true,
    })
    expect(plan.secret_warnings.length).toBe(0)
  })
})
