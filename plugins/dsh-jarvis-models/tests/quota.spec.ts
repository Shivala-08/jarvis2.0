import { describe, test, expect, vi, beforeEach } from 'vitest'
import { QuotaTracker } from '../src/quota-tracker.ts'
import type { JarvisProvider, ProviderQuotaState, ProviderHealth } from '../src/provider-types.ts'

describe('QuotaTracker', () => {
  let mockProvider: JarvisProvider
  let quotaState: ProviderQuotaState
  let healthState: ProviderHealth

  beforeEach(() => {
    quotaState = { exhausted: false }
    healthState = { status: 'healthy', lastCheckedMs: Date.now() }

    mockProvider = {
      metadata: {
        id: 'mock-provider',
        displayName: 'Mock Provider',
        enabled: true,
        tiers: ['everyday'],
        models: ['mock-model'],
        apiEnvName: 'MOCK_KEY'
      },
      getQuota: () => quotaState,
      getHealth: () => healthState,
      updateQuotaFromHeaders: vi.fn((headers) => {
        if (headers['exhaust']) {
          quotaState.exhausted = true
          quotaState.requests = {
            limit: 10,
            remaining: 0,
            resetTimeMs: Date.now() + 1000
          }
        }
      }),
      updateHealth: vi.fn((status) => {
        healthState.status = status
      }),
      stream: vi.fn()
    }
  })

  test('registers provider and tracks requests within quota limits', () => {
    const tracker = new QuotaTracker()
    tracker.registerProvider(mockProvider)

    expect(tracker.isWithinQuota('mock-provider')).toBe(true)

    tracker.registerRequestStart('mock-provider')
    tracker.registerRequestSuccess('mock-provider', {})

    expect(tracker.isWithinQuota('mock-provider')).toBe(true)
    expect(tracker.getRetryDelay('mock-provider')).toBe(0)
  })

  test('exhaustion blocks requests and resets allow them to resume after delay', () => {
    const tracker = new QuotaTracker()
    tracker.registerProvider(mockProvider)

    tracker.registerRequestStart('mock-provider')
    tracker.registerRequestSuccess('mock-provider', { 'exhaust': 'true' })

    expect(tracker.isWithinQuota('mock-provider')).toBe(false)
    expect(tracker.getRetryDelay('mock-provider')).toBeGreaterThan(0)

    const timeSpy = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 2000)

    expect(tracker.isWithinQuota('mock-provider')).toBe(true)
    expect(tracker.getRetryDelay('mock-provider')).toBe(0)

    timeSpy.mockRestore()
  })

  test('rate-limiting blocks requests and respects retryAfterMs', () => {
    const tracker = new QuotaTracker()
    tracker.registerProvider(mockProvider)

    mockProvider.updateHealth('rate-limited', undefined)
    healthState.retryAfterMs = 5000
    healthState.lastCheckedMs = Date.now()

    expect(tracker.isWithinQuota('mock-provider')).toBe(false)
    expect(tracker.getRetryDelay('mock-provider')).toBeCloseTo(5000, -2)

    const timeSpy = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 6000)

    expect(tracker.isWithinQuota('mock-provider')).toBe(true)
    expect(tracker.getRetryDelay('mock-provider')).toBe(0)

    timeSpy.mockRestore()
  })
})
