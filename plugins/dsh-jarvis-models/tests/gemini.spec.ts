import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { GeminiAdapter } from '../src/gemini-adapter.ts'
import type { GenerateOptions } from '@deepseek-ai/dsh-llm'

describe('GeminiAdapter', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test('streams chat completions successfully from Gemini compatibility endpoint', async () => {
    const sseData = [
      'data: {"choices": [{"delta": {"content": "Google"}}]}\n\n',
      'data: {"choices": [{"delta": {"content": " Gemini"}}]}\n\n',
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
      headers: new Headers()
    })

    const adapter = new GeminiAdapter('test-gemini-key')
    const options: GenerateOptions = {
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }]
    }

    const chunks = []
    for await (const chunk of adapter.stream(options)) {
      chunks.push(chunk)
    }

    expect(chunks).toHaveLength(5)
    expect(chunks[0]).toEqual({ type: 'block-start', index: 0, blockType: 'text' })
    expect(chunks[1]).toEqual({ type: 'text-delta', index: 0, text: 'Google' })
    expect(chunks[2]).toEqual({ type: 'text-delta', index: 0, text: ' Gemini' })
    expect(chunks[3]).toEqual({ type: 'block-end', index: 0, block: { type: 'text', text: 'Google Gemini' } })
    expect(chunks[4]).toEqual({ type: 'finish', reason: { kind: 'stop' } })
  })

  test('converts Gemini rate limit response (429) to appropriate LlmError', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: () => Promise.resolve({ error: { message: 'Resource exhausted' } }),
      headers: new Headers()
    })

    const adapter = new GeminiAdapter('test-gemini-key')
    const options: GenerateOptions = {
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }]
    }

    await expect(async () => {
      for await (const _ of adapter.stream(options)) {}
    }).rejects.toThrow('Resource exhausted')

    expect(adapter.getHealth().status).toBe('rate-limited')
  })
})
