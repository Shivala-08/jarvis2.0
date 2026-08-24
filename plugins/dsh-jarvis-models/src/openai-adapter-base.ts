import { LlmAdapter, LlmError } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, StreamChunk, LlmProviderInfo, LlmResolvedModelInfo } from '@deepseek-ai/dsh-llm'
import type { JarvisProvider, ProviderHealth, ProviderQuotaState, ProviderHealthStatus } from './provider-types.ts'

export abstract class OpenAiAdapterBase extends LlmAdapter implements JarvisProvider {
  protected apiKey: string | undefined
  protected health: ProviderHealth = { status: 'healthy', lastCheckedMs: Date.now() }
  protected quota: ProviderQuotaState = { exhausted: false }

  constructor(
    public readonly metadata: any,
    apiKey?: string
  ) {
    super()
    this.apiKey = apiKey
  }

  getHealth(): ProviderHealth {
    return this.health
  }

  getQuota(): ProviderQuotaState {
    return this.quota
  }

  updateQuotaFromHeaders(headers: Record<string, string>): void {
    // To be implemented by subclasses
  }

  updateHealth(status: ProviderHealthStatus, error?: Error, retryAfterMs?: number): void {
    this.health = {
      status,
      lastCheckedMs: Date.now(),
      retryAfterMs,
      lastError: error?.message
    }
    if (status === 'exhausted') {
      this.quota.exhausted = true
    }
  }

  override providerInfo(provider: string): LlmProviderInfo {
    return { id: provider, name: this.metadata.displayName }
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
    if (!this.apiKey) {
      throw new LlmError(
        `${this.metadata.displayName}: API key is not configured.`,
        'MISSING_CREDENTIAL'
      )
    }

    const payload = {
      model: options.model,
      messages: options.messages.map(m => ({
        role: m.role,
        content: m.content.map(c => {
          if (c.type === 'text') return c.text
          return ''
        }).join('')
      })),
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      stream: true
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream'
    }

    let response: Response
    try {
      response = await fetch(`${this.metadata.baseURL}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: options.signal
      })
    } catch (err: any) {
      this.updateHealth('unhealthy', err)
      throw new LlmError(
        `${this.metadata.displayName} API connection failed: ${err.message}`,
        'TRANSPORT',
        { cause: err }
      )
    }

    // Capture response headers for quota tracking
    const headerMap: Record<string, string> = {}
    response.headers.forEach((val, key) => {
      headerMap[key.toLowerCase()] = val
    })
    this.updateQuotaFromHeaders(headerMap)

    if (!response.ok) {
      let errorMsg = `HTTP Error ${response.status}`
      let code = 'TRANSPORT'
      try {
        const body = await response.json()
        if (body.error && body.error.message) {
          errorMsg = body.error.message
        }
      } catch (e) {}

      if (response.status === 429) {
        code = 'RATE_LIMIT'
        this.updateHealth('rate-limited', new Error(errorMsg))
      } else if (response.status === 401 || response.status === 403) {
        code = 'AUTH'
        this.updateHealth('unhealthy', new Error(errorMsg))
      } else {
        this.updateHealth('unhealthy', new Error(errorMsg))
      }

      throw new LlmError(errorMsg, code, { status: response.status })
    }

    if (!response.body) {
      throw new LlmError(`${this.metadata.displayName} returned no response body`, 'EMPTY_RESPONSE')
    }

    yield* this.translateStream(response.body)
  }

  private async * translateStream(body: ReadableStream<Uint8Array>): AsyncGenerator<StreamChunk> {
    const reader = body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let textBlockOpened = false
    let reasoningBlockOpened = false
    let textAccumulated = ''
    let reasoningAccumulated = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          
          const data = trimmed.slice(5).trim()
          if (data === '[DONE]') {
            if (reasoningBlockOpened) {
              yield {
                type: 'block-end',
                index: 1,
                block: { type: 'reasoning', text: reasoningAccumulated }
              }
            }
            if (textBlockOpened) {
              yield {
                type: 'block-end',
                index: 0,
                block: { type: 'text', text: textAccumulated }
              }
            }
            yield {
              type: 'finish',
              reason: { kind: 'stop' }
            }
            return
          }

          try {
            const parsed = JSON.parse(data)
            const choice = parsed.choices?.[0]
            const content = choice?.delta?.content
            const reasoning = choice?.delta?.reasoning_content || choice?.delta?.reasoning
            
            if (reasoning && reasoning.length > 0) {
              if (!reasoningBlockOpened) {
                yield { type: 'block-start', index: 1, blockType: 'reasoning' }
                reasoningBlockOpened = true
              }
              reasoningAccumulated += reasoning
              yield { type: 'reasoning-delta', index: 1, text: reasoning }
            }

            if (content && content.length > 0) {
              if (!textBlockOpened) {
                yield { type: 'block-start', index: 0, blockType: 'text' }
                textBlockOpened = true
              }
              textAccumulated += content
              yield { type: 'text-delta', index: 0, text: content }
            }

            if (parsed.usage) {
              yield {
                type: 'usage',
                usage: {
                  inputTokens: parsed.usage.prompt_tokens,
                  outputTokens: parsed.usage.completion_tokens
                }
              }
            }
          } catch (e) {
            // Ignore parse errors on individual lines
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }
}
