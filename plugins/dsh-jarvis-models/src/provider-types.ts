import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'

export type RoutingTier = 'routing' | 'everyday' | 'coding'

export interface QuotaLimit {
  limit: number
  remaining: number
  resetTimeMs: number
}

export interface ProviderQuotaState {
  requests?: QuotaLimit
  tokens?: QuotaLimit
  dailyRequests?: QuotaLimit
  dailyTokens?: QuotaLimit
  exhausted: boolean
}

export type ProviderHealthStatus = 'healthy' | 'rate-limited' | 'exhausted' | 'unhealthy'

export interface ProviderHealth {
  status: ProviderHealthStatus
  lastCheckedMs: number
  retryAfterMs?: number
  lastError?: string
}

export interface JarvisProviderMetadata {
  id: string
  displayName: string
  enabled: boolean
  tiers: RoutingTier[]
  models: string[]
  apiEnvName: string
  baseURL?: string
}

export interface JarvisProvider {
  metadata: JarvisProviderMetadata
  getHealth(): ProviderHealth
  getQuota(): ProviderQuotaState
  updateQuotaFromHeaders(headers: Record<string, string>): void
  updateHealth(status: ProviderHealthStatus, error?: Error, retryAfterMs?: number): void
  stream(options: GenerateOptions): AsyncIterable<StreamChunk>
}
