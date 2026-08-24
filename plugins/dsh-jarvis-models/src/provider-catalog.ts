import type { JarvisProviderMetadata, RoutingTier } from './provider-types.ts'

export interface ProviderCatalogEntry extends JarvisProviderMetadata {
  defaultModel: string
  quotaDimensions: string[]
}

export const PROVIDER_CATALOG: Record<string, ProviderCatalogEntry> = {
  groq: {
    id: 'groq',
    displayName: 'Groq',
    enabled: true,
    tiers: ['routing', 'everyday'],
    models: [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'mixtral-8x7b-32768'
    ],
    defaultModel: 'llama-3.3-70b-versatile',
    apiEnvName: 'GROQ_API_KEY',
    baseURL: 'https://api.groq.com/openai/v1',
    quotaDimensions: ['rpm', 'rpd', 'tpm', 'tpd']
  },
  gemini: {
    id: 'gemini',
    displayName: 'Gemini',
    enabled: true,
    tiers: ['everyday', 'coding'],
    models: [
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-2.0-flash-exp'
    ],
    defaultModel: 'gemini-1.5-flash',
    apiEnvName: 'GEMINI_API_KEY',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
    quotaDimensions: ['rpm', 'tpm', 'rpd']
  },
  cerebras: {
    id: 'cerebras',
    displayName: 'Cerebras',
    enabled: false, // CONDITIONAL - disabled by default, enabled if CEREBRAS_API_KEY is configured
    tiers: ['routing'],
    models: [
      'llama3.1-8b',
      'llama3.3-70b'
    ],
    defaultModel: 'llama3.3-70b',
    apiEnvName: 'CEREBRAS_API_KEY',
    baseURL: 'https://api.cerebras.ai/v1',
    quotaDimensions: ['rpm', 'dailyTokens']
  },
  openrouter: {
    id: 'openrouter',
    displayName: 'OpenRouter',
    enabled: false, // CONDITIONAL - disabled by default
    tiers: ['routing'],
    models: [
      'openrouter/free'
    ],
    defaultModel: 'openrouter/free',
    apiEnvName: 'OPENROUTER_API_KEY',
    baseURL: 'https://openrouter.ai/api/v1',
    quotaDimensions: ['rpm', 'rpd']
  }
}
