import { OpenAiAdapterBase } from './openai-adapter-base.ts'
import { PROVIDER_CATALOG } from './provider-catalog.ts'

export class GroqAdapter extends OpenAiAdapterBase {
  constructor(apiKey?: string) {
    super(PROVIDER_CATALOG.groq, apiKey)
  }

  override updateQuotaFromHeaders(headers: Record<string, string>): void {
    const limitRequests = headers['x-ratelimit-limit-requests']
    const remainingRequests = headers['x-ratelimit-remaining-requests']
    const resetRequests = headers['x-ratelimit-reset-requests']

    const limitTokens = headers['x-ratelimit-limit-tokens']
    const remainingTokens = headers['x-ratelimit-remaining-tokens']
    const resetTokens = headers['x-ratelimit-reset-tokens']

    const limitDayRequests = headers['x-ratelimit-limit-day-requests'] || headers['x-ratelimit-limit-requests-day']
    const remainingDayRequests = headers['x-ratelimit-remaining-day-requests'] || headers['x-ratelimit-remaining-requests-day']
    const resetDayRequests = headers['x-ratelimit-reset-day-requests'] || headers['x-ratelimit-reset-requests-day']

    const now = Date.now()

    if (limitRequests && remainingRequests) {
      this.quota.requests = {
        limit: parseInt(limitRequests, 10),
        remaining: parseInt(remainingRequests, 10),
        resetTimeMs: now + this.parseDurationToMs(resetRequests)
      }
    }

    if (limitTokens && remainingTokens) {
      this.quota.tokens = {
        limit: parseInt(limitTokens, 10),
        remaining: parseInt(remainingTokens, 10),
        resetTimeMs: now + this.parseDurationToMs(resetTokens)
      }
    }

    if (limitDayRequests && remainingDayRequests) {
      this.quota.dailyRequests = {
        limit: parseInt(limitDayRequests, 10),
        remaining: parseInt(remainingDayRequests, 10),
        resetTimeMs: now + this.parseDurationToMs(resetDayRequests)
      }
    }

    // Determine if exhausted
    const hasRemainingRequests = this.quota.requests ? this.quota.requests.remaining > 0 : true
    const hasRemainingTokens = this.quota.tokens ? this.quota.tokens.remaining > 0 : true
    const hasRemainingDailyRequests = this.quota.dailyRequests ? this.quota.dailyRequests.remaining > 0 : true

    if (!hasRemainingRequests || !hasRemainingTokens || !hasRemainingDailyRequests) {
      this.quota.exhausted = true
      this.updateHealth('exhausted', new Error('Groq rate limits exhausted'))
    } else {
      this.quota.exhausted = false
      if (this.health.status === 'exhausted') {
        this.updateHealth('healthy')
      }
    }
  }

  private parseDurationToMs(duration: string | null | undefined): number {
    if (!duration) return 0
    // e.g. "80ms" or "1.5s" or "2m30s"
    let totalMs = 0
    const matches = duration.matchAll(/(\d+(?:\.\d+)?)(ms|s|m|h)/g)
    for (const match of matches) {
      const val = parseFloat(match[1])
      const unit = match[2]
      switch (unit) {
        case 'ms': totalMs += val; break
        case 's': totalMs += val * 1000; break
        case 'm': totalMs += val * 60 * 1000; break
        case 'h': totalMs += val * 60 * 60 * 1000; break
      }
    }
    return totalMs > 0 ? totalMs : 0
  }
}
