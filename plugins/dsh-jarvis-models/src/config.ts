import type { Context } from '@deepseek-ai/cordis'

export interface ProviderConfigState {
  providerId: string
  enabled: boolean
  hasCredentials: boolean
  apiKey?: string
}

export function resolveProviderConfig(ctx: Context, providerId: string, apiEnvName: string, defaultEnabled: boolean): ProviderConfigState {
  let apiKey: string | undefined = undefined

  // 1. Resolve from process.env
  if (process.env[apiEnvName] && process.env[apiEnvName]!.trim().length > 0) {
    apiKey = process.env[apiEnvName]!.trim()
  }

  // 2. Resolve from DSH launchEnvironment if available
  if (!apiKey && ctx) {
    try {
      // Using require for dynamic environment resolution inside Cordis context
      const { launchEnvironmentOf } = require('@deepseek-ai/dsh-launch-environment')
      const env = launchEnvironmentOf(ctx)
      const ambient = env.get(apiEnvName)
      if (ambient && ambient.value && ambient.value.trim().length > 0) {
        apiKey = ambient.value.trim()
      }
    } catch (err) {
      // Fallback if launchEnvironment is unavailable
    }
  }

  const hasCredentials = apiKey !== undefined && apiKey.length > 0
  // Provider is active only if both the catalog default enabled is true AND it has credentials
  const enabled = defaultEnabled && hasCredentials

  return {
    providerId,
    enabled,
    hasCredentials,
    apiKey
  }
}
