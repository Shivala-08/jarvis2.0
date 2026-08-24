import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { GroqAdapter } from '../src/groq-adapter.ts'
import type { GenerateOptions } from '@deepseek-ai/dsh-llm'

describe('GroqAdapter', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test('streams chat completions successfully and parses usage/finish reasons', async () => {
    const sseData = [
      'data: {"choices": [{"delta": {"content": "Hello"}}]}\n\n',
      'data: {"choices": [{"delta": {"content": " world"}}]}\n\n',
      'data: {"usage": {"prompt_tokens": 10, "completion_tokens": 5}}\n\n',
      'data: [DONE]\n\n'
    ]

    const mockReadableStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder()
        for (const chunk of sseData) {
          controller.enqueue(encoder.encode(chunk))
          await new Promise(r => setTimeout(r, 5))
        }
        controller.close()
      }
    })

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: mockReadableStream,
      headers: new Headers({
        'x-ratelimit-limit-requests': '30',
        'x-ratelimit-remaining-requests': '29',
        'x-ratelimit-reset-requests': '80ms',
        'x-ratelimit-limit-tokens': '12000',
        'x-ratelimit-remaining-tokens': '11950',
        'x-ratelimit-reset-tokens': '1.2s'
      })
    })

    const adapter = new GroqAdapter('test-api-key')
    const options: GenerateOptions = {
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }]
    }

    const chunks = []
    for await (const chunk of adapter.stream(options)) {
      chunks.push(chunk)
    }

    expect(chunks).toHaveLength(6)
    expect(chunks[0]).toEqual({ type: 'block-start', index: 0, blockType: 'text' })
    expect(chunks[1]).toEqual({ type: 'text-delta', index: 0, text: 'Hello' })
    expect(chunks[2]).toEqual({ type: 'text-delta', index: 0, text: ' world' })
    expect(chunks[3]).toEqual({ type: 'usage', usage: { inputTokens: 10, outputTokens: 5 } })
    expect(chunks[4]).toEqual({ type: 'block-end', index: 0, block: { type: 'text', text: 'Hello world' } })
    expect(chunks[5]).toEqual({ type: 'finish', reason: { kind: 'stop' } })

    const quota = adapter.getQuota()
    expect(quota.requests?.limit).toBe(30)
    expect(quota.requests?.remaining).toBe(29)
    expect(quota.tokens?.limit).toBe(12000)
    expect(quota.tokens?.remaining).toBe(11950)
  })

  test('converts rate limit response (429) to appropriate LlmError and sets health', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: () => Promise.resolve({ error: { message: 'Rate limit exceeded' } }),
      headers: new Headers({
        'x-ratelimit-limit-requests': '30',
        'x-ratelimit-remaining-requests': '0',
        'x-ratelimit-reset-requests': '2s'
      })
    })

    const adapter = new GroqAdapter('test-api-key')
    const options: GenerateOptions = {
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }]
    }

    await expect(async () => {
      for await (const _ of adapter.stream(options)) {}
    }).rejects.toThrow('Rate limit exceeded')

    expect(adapter.getHealth().status).toBe('rate-limited')
    expect(adapter.getQuota().exhausted).toBe(true)
  })

  test('converts authorization response (401) to AUTH error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: { message: 'Invalid API Key' } }),
      headers: new Headers()
    })

    const adapter = new GroqAdapter('test-api-key')
    const options: GenerateOptions = {
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }]
    }

    await expect(async () => {
      for await (const _ of adapter.stream(options)) {}
    }).rejects.toThrow('Invalid API Key')

    expect(adapter.getHealth().status).toBe('unhealthy')
  })
})
