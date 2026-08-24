import type { JarvisProvider, RoutingTier } from './provider-types.ts'
import { QuotaTracker } from './quota-tracker.ts'

const TIER_PREFERENCE: Record<RoutingTier, string[]> = {
  routing: ['groq', 'cerebras', 'openrouter', 'gemini'],
  everyday: ['groq', 'gemini', 'cerebras', 'openrouter'],
  coding: ['gemini', 'groq']
}

export class CloudRouter {
  private providers = new Map<string, JarvisProvider>()
  private quotaTracker = new QuotaTracker()

  constructor(private logger?: any) {}

  registerProvider(provider: JarvisProvider): void {
    this.providers.set(provider.metadata.id, provider)
    this.quotaTracker.registerProvider(provider)
  }

  getQuotaTracker(): QuotaTracker {
    return this.quotaTracker
  }

  selectProviderForTier(tier: RoutingTier, excludeProviderIds: Set<string> = new Set()): JarvisProvider | undefined {
    const preferences = TIER_PREFERENCE[tier]
    if (!preferences) return undefined

    // 1. Try to find the best provider following the preference order
    for (const providerId of preferences) {
      if (excludeProviderIds.has(providerId)) continue
      const provider = this.providers.get(providerId)
      if (provider && provider.metadata.enabled && this.quotaTracker.isWithinQuota(providerId)) {
        this.logger?.info?.({ event: 'provider-selected', tier, providerId })
        return provider
      }
    }

    // 2. Fallback: find ANY enabled provider that supports this tier and is within quota
    for (const provider of this.providers.values()) {
      if (excludeProviderIds.has(provider.metadata.id)) continue
      if (provider.metadata.enabled && provider.metadata.tiers.includes(tier) && this.quotaTracker.isWithinQuota(provider.metadata.id)) {
        this.logger?.info?.({ event: 'provider-selected-fallback', tier, providerId: provider.metadata.id })
        return provider
      }
    }

    this.logger?.warn?.({ event: 'no-provider-available', tier, excluded: Array.from(excludeProviderIds) })
    return undefined
  }

  getBestProvider(tier: RoutingTier): JarvisProvider | undefined {
    return this.selectProviderForTier(tier)
  }

  handleFailureAndFailover(
    tier: RoutingTier,
    currentProviderId: string,
    error: any,
    excludeProviderIds: Set<string> = new Set()
  ): { nextProvider?: JarvisProvider; delay?: number } {
    const provider = this.providers.get(currentProviderId)
    
    const status = error?.status
    const headers = error?.headers
    
    this.quotaTracker.registerRequestFailure(currentProviderId, headers)

    if (provider) {
      if (status === 429) {
        const retryAfterMs = error?.providerRetryAfterMs || 60000
        provider.updateHealth('rate-limited', error, retryAfterMs)
        this.logger?.warn?.({ event: 'provider-rate-limited', providerId: currentProviderId, retryAfterMs, error: error?.message })
      } else {
        provider.updateHealth('unhealthy', error)
        this.logger?.error?.({ event: 'provider-failure', providerId: currentProviderId, error: error?.message })
      }
    }

    const nextExclude = new Set(excludeProviderIds)
    nextExclude.add(currentProviderId)

    const nextProvider = this.selectProviderForTier(tier, nextExclude)
    if (nextProvider) {
      this.logger?.info?.({ event: 'failover-routing', tier, failedProviderId: currentProviderId, nextProviderId: nextProvider.metadata.id })
      return { nextProvider }
    }

    // No alternative provider is available. Calculate minimum delay to wait for any provider to reset.
    let minDelay = Infinity
    for (const providerId of (TIER_PREFERENCE[tier] || [])) {
      const p = this.providers.get(providerId)
      if (p && p.metadata.enabled) {
        const delay = this.quotaTracker.getRetryDelay(providerId)
        if (delay > 0 && delay < minDelay) {
          minDelay = delay
        }
      }
    }

    const delay = minDelay === Infinity ? 0 : minDelay
    this.logger?.warn?.({ event: 'failover-no-backup', tier, failedProviderId: currentProviderId, retryDelayMs: delay })
    return { delay }
  }
}
