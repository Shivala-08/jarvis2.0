import { describe, test, expect, vi, beforeEach } from 'vitest'
import { CloudRouter } from '../src/cloud-router.ts'
import type { JarvisProvider, ProviderQuotaState, ProviderHealth } from '../src/provider-types.ts'

describe('CloudRouter Routing', () => {
  let groqProvider: JarvisProvider
  let geminiProvider: JarvisProvider

  let groqQuota: ProviderQuotaState
  let groqHealth: ProviderHealth

  let geminiQuota: ProviderQuotaState
  let geminiHealth: ProviderHealth

  beforeEach(() => {
    groqQuota = { exhausted: false }
    groqHealth = { status: 'healthy', lastCheckedMs: Date.now() }
    groqProvider = {
      metadata: {
        id: 'groq',
        displayName: 'Groq',
        enabled: true,
        tiers: ['routing', 'everyday'],
        models: ['llama-3.3-70b-versatile'],
        apiEnvName: 'GROQ_API_KEY'
      },
      getQuota: () => groqQuota,
      getHealth: () => groqHealth,
      updateQuotaFromHeaders: vi.fn(),
      updateHealth: vi.fn((status) => { groqHealth.status = status }),
      stream: vi.fn()
    }

    geminiQuota = { exhausted: false }
    geminiHealth = { status: 'healthy', lastCheckedMs: Date.now() }
    geminiProvider = {
      metadata: {
        id: 'gemini',
        displayName: 'Gemini',
        enabled: true,
        tiers: ['everyday', 'coding'],
        models: ['gemini-1.5-pro'],
        apiEnvName: 'GEMINI_API_KEY'
      },
      getQuota: () => geminiQuota,
      getHealth: () => geminiHealth,
      updateQuotaFromHeaders: vi.fn(),
      updateHealth: vi.fn((status) => { geminiHealth.status = status }),
      stream: vi.fn()
    }
  })

  test('selects highest rank healthy provider for everyday and coding tiers', () => {
    const router = new CloudRouter()
    router.registerProvider(groqProvider)
    router.registerProvider(geminiProvider)

    const everydayProvider = router.getBestProvider('everyday')
    expect(everydayProvider?.metadata.id).toBe('groq')

    const codingProvider = router.getBestProvider('coding')
    expect(codingProvider?.metadata.id).toBe('gemini')
  })

  test('fails over to backup when primary is unhealthy', () => {
    const router = new CloudRouter()
    router.registerProvider(groqProvider)
    router.registerProvider(geminiProvider)

    groqHealth.status = 'unhealthy'

    const everydayProvider = router.getBestProvider('everyday')
    expect(everydayProvider?.metadata.id).toBe('gemini')
  })

  test('returns undefined when all providers for a tier are unhealthy', () => {
    const router = new CloudRouter()
    router.registerProvider(groqProvider)
    router.registerProvider(geminiProvider)

    groqHealth.status = 'unhealthy'
    geminiHealth.status = 'unhealthy'

    const codingProvider = router.getBestProvider('coding')
    expect(codingProvider).toBeUndefined()
  })

  test('handleFailureAndFailover correctly flags provider and selects next', () => {
    const router = new CloudRouter()
    router.registerProvider(groqProvider)
    router.registerProvider(geminiProvider)

    const error = { status: 429, providerRetryAfterMs: 5000 }
    const result = router.handleFailureAndFailover('everyday', 'groq', error)

    expect(groqHealth.status).toBe('rate-limited')
    expect(groqProvider.updateHealth).toHaveBeenCalledWith('rate-limited', error, 5000)
    expect(result.nextProvider?.metadata.id).toBe('gemini')
  })

  test('skips exhausted quota provider and resumes once reset passes', () => {
    const router = new CloudRouter()
    router.registerProvider(groqProvider)
    router.registerProvider(geminiProvider)

    expect(router.getBestProvider('everyday')?.metadata.id).toBe('groq')

    groqQuota.exhausted = true
    groqQuota.requests = {
      limit: 10,
      remaining: 0,
      resetTimeMs: Date.now() + 2000
    }

    expect(router.getBestProvider('everyday')?.metadata.id).toBe('gemini')

    const timeSpy = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 3000)

    expect(router.getBestProvider('everyday')?.metadata.id).toBe('groq')

    timeSpy.mockRestore()
  })
})
