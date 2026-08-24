import type { JarvisProvider } from './provider-types.ts'

export class QuotaTracker {
  private providers = new Map<string, JarvisProvider>()
  private inFlightRequests = new Map<string, number>()

  registerProvider(provider: JarvisProvider): void {
    this.providers.set(provider.metadata.id, provider)
    this.inFlightRequests.set(provider.metadata.id, 0)
  }

  registerRequestStart(providerId: string): void {
    const current = this.inFlightRequests.get(providerId) ?? 0
    this.inFlightRequests.set(providerId, current + 1)
  }

  registerRequestSuccess(providerId: string, headers: Record<string, string>): void {
    const current = this.inFlightRequests.get(providerId) ?? 0
    if (current > 0) {
      this.inFlightRequests.set(providerId, current - 1)
    }

    const provider = this.providers.get(providerId)
    if (provider) {
      provider.updateQuotaFromHeaders(headers)
    }
  }

  registerRequestFailure(providerId: string, headers?: Record<string, string>): void {
    const current = this.inFlightRequests.get(providerId) ?? 0
    if (current > 0) {
      this.inFlightRequests.set(providerId, current - 1)
    }

    if (headers) {
      const provider = this.providers.get(providerId)
      if (provider) {
        provider.updateQuotaFromHeaders(headers)
      }
    }
  }

  isWithinQuota(providerId: string): boolean {
    const provider = this.providers.get(providerId)
    if (!provider) return false

    const quota = provider.getQuota()
    const health = provider.getHealth()

    if (health.status === 'unhealthy') return false
    
    const now = Date.now()
    if (health.status === 'rate-limited') {
      if (health.retryAfterMs && health.lastCheckedMs + health.retryAfterMs > now) {
        return false
      }
    }

    if (quota.exhausted) {
      const requestResetTime = quota.requests?.resetTimeMs ?? 0
      const tokenResetTime = quota.tokens?.resetTimeMs ?? 0
      const dailyRequestReset = quota.dailyRequests?.resetTimeMs ?? 0
      
      const maxResetTime = Math.max(requestResetTime, tokenResetTime, dailyRequestReset)
      if (maxResetTime > now) {
        return false
      }
    }

    if (quota.requests && quota.requests.remaining <= 0 && quota.requests.resetTimeMs > now) {
      return false
    }

    if (quota.tokens && quota.tokens.remaining <= 0 && quota.tokens.resetTimeMs > now) {
      return false
    }

    if (quota.dailyRequests && quota.dailyRequests.remaining <= 0 && quota.dailyRequests.resetTimeMs > now) {
      return false
    }

    return true
  }

  getRetryDelay(providerId: string): number {
    const provider = this.providers.get(providerId)
    if (!provider) return 0

    const health = provider.getHealth()
    const quota = provider.getQuota()
    const now = Date.now()

    let delay = 0

    if (health.status === 'rate-limited' && health.retryAfterMs) {
      const remainingLimit = (health.lastCheckedMs + health.retryAfterMs) - now
      if (remainingLimit > delay) delay = remainingLimit
    }

    if (quota.requests && quota.requests.remaining <= 0) {
      const requestDelay = quota.requests.resetTimeMs - now
      if (requestDelay > delay) delay = requestDelay
    }

    if (quota.tokens && quota.tokens.remaining <= 0) {
      const tokenDelay = quota.tokens.resetTimeMs - now
      if (tokenDelay > delay) delay = tokenDelay
    }

    if (quota.dailyRequests && quota.dailyRequests.remaining <= 0) {
      const dailyDelay = quota.dailyRequests.resetTimeMs - now
      if (dailyDelay > delay) delay = dailyDelay
    }

    return delay > 0 ? delay : 0
  }
}
