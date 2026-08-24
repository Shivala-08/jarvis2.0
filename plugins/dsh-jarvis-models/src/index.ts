import type { Context } from '@deepseek-ai/cordis'
import { LlmAdapter, LlmError } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, StreamChunk, LlmProviderInfo, LlmResolvedModelInfo } from '@deepseek-ai/dsh-llm'
import { resolveProviderConfig } from './config.ts'
import { PROVIDER_CATALOG } from './provider-catalog.ts'
import { GroqAdapter } from './groq-adapter.ts'
import { GeminiAdapter } from './gemini-adapter.ts'
import { CerebrasAdapter } from './cerebras-adapter.ts'
import { OpenRouterAdapter } from './openrouter-adapter.ts'
import { CloudRouter } from './cloud-router.ts'
import type { RoutingTier, JarvisProvider } from './provider-types.ts'

export const name = 'jarvis-models'
export const inject = ['llm']

export interface Config {}

export function apply(ctx: Context, config: Config): void {
  ctx.logger.info('dsh-jarvis-models plugin loading...')

  const router = new CloudRouter(ctx.logger)

  // 1. Resolve and initialize each provider
  const providersToRegister: { id: string; adapter: JarvisProvider }[] = []

  // Groq
  const groqConfig = resolveProviderConfig(ctx, 'groq', 'GROQ_API_KEY', true)
  if (groqConfig.hasCredentials) {
    const adapter = new GroqAdapter(groqConfig.apiKey)
    providersToRegister.push({ id: 'groq', adapter })
    ctx.logger.info('dsh-jarvis-models: Groq provider initialized successfully')
  } else {
    ctx.logger.warn('dsh-jarvis-models: Groq API key (GROQ_API_KEY) is missing')
  }

  // Gemini
  const geminiConfig = resolveProviderConfig(ctx, 'gemini', 'GEMINI_API_KEY', true)
  if (geminiConfig.hasCredentials) {
    const adapter = new GeminiAdapter(geminiConfig.apiKey)
    providersToRegister.push({ id: 'gemini', adapter })
    ctx.logger.info('dsh-jarvis-models: Gemini provider initialized successfully')
  } else {
    ctx.logger.warn('dsh-jarvis-models: Gemini API key (GEMINI_API_KEY) is missing')
  }

  // Cerebras
  const cerebrasConfig = resolveProviderConfig(ctx, 'cerebras', 'CEREBRAS_API_KEY', false)
  if (cerebrasConfig.hasCredentials) {
    const adapter = new CerebrasAdapter(cerebrasConfig.apiKey)
    providersToRegister.push({ id: 'cerebras', adapter })
    ctx.logger.info('dsh-jarvis-models: Cerebras provider initialized successfully')
  }

  // OpenRouter
  const openRouterConfig = resolveProviderConfig(ctx, 'openrouter', 'OPENROUTER_API_KEY', false)
  if (openRouterConfig.hasCredentials) {
    const adapter = new OpenRouterAdapter(openRouterConfig.apiKey)
    providersToRegister.push({ id: 'openrouter', adapter })
    ctx.logger.info('dsh-jarvis-models: OpenRouter provider initialized successfully')
  }

  // Register configured adapters with Cordis and CloudRouter
  for (const item of providersToRegister) {
    router.registerProvider(item.adapter)
    ctx.llm.registerAdapter([item.id], item.adapter as any)
  }

  // 2. Implement the Tier Routing Adapter
  class TierRoutingAdapter extends LlmAdapter {
    override providerInfo(provider: string): LlmProviderInfo {
      return { id: provider, name: `Jarvis ${provider} Tier` }
    }

    override resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
      return Promise.resolve({
        provider,
        id: model,
        name: model,
        inputModalities: ['text']
      })
    }

    override async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
      const tier = options.provider as RoutingTier
      const excludeProviders = new Set<string>()

      while (true) {
        const provider = router.selectProviderForTier(tier, excludeProviders)
        if (!provider) {
          throw new LlmError(`No healthy provider available for tier ${tier}`, 'NO_PROVIDER_AVAILABLE')
        }

        router.getQuotaTracker().registerRequestStart(provider.metadata.id)
        
        const defaultModel = (PROVIDER_CATALOG as any)[provider.metadata.id]?.defaultModel
        const providerOptions: GenerateOptions = {
          ...options,
          provider: provider.metadata.id,
          model: provider.metadata.models.includes(options.model) ? options.model : defaultModel
        }

        ctx.logger.info(`dsh-jarvis-models: Routing tier ${tier} to ${provider.metadata.id} (model: ${providerOptions.model})`)

        try {
          let success = false
          const stream = provider.stream(providerOptions)
          for await (const chunk of stream) {
            yield chunk
            if (chunk.type === 'finish' && chunk.reason.kind === 'stop') {
              success = true
            }
          }

          if (success) {
            router.getQuotaTracker().registerRequestSuccess(provider.metadata.id, {})
            return
          } else {
            throw new LlmError('Stream finished without stop condition', 'INCOMPLETE_STREAM')
          }
        } catch (err: any) {
          ctx.logger.warn(`dsh-jarvis-models: Provider ${provider.metadata.id} failed: ${err.message}`)
          const failover = router.handleFailureAndFailover(tier, provider.metadata.id, err, excludeProviders)
          if (failover.nextProvider) {
            excludeProviders.add(provider.metadata.id)
            ctx.logger.info(`dsh-jarvis-models: Failing over to ${failover.nextProvider.metadata.id}`)
            continue
          }
          throw err
        }
      }
    }
  }

  // Register tier routing adapters on Cordis
  const tiers: RoutingTier[] = ['routing', 'everyday', 'coding']
  ctx.llm.registerAdapter(tiers, new TierRoutingAdapter())

  ctx.logger.info('dsh-jarvis-models plugin successfully registered and activated!')
}
