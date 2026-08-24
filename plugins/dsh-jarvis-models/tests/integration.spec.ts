import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { CloudRouter } from '../src/cloud-router.ts'
import { GroqAdapter } from '../src/groq-adapter.ts'
import { GeminiAdapter } from '../src/gemini-adapter.ts'
import type { GenerateOptions } from '@deepseek-ai/dsh-llm'

describe('Integration Tier Routing', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test('everyday tier successfully routes to Groq adapter', async () => {
    const sseData = [
      'data: {"choices": [{"delta": {"content": "Hello everyday"}}]}\n\n',
      'data: [DONE]\n\n'
    ]

    const mockReadableStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder()
        for (const chunk of sseData) {
          controller.enqueue(encoder.encode(chunk))
          await new Promise(r => setTimeout(r, 2))
        }
        controller.close()
      }
    })

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      body: mockReadableStream,
      headers: new Headers({
        'x-ratelimit-limit-requests': '30',
        'x-ratelimit-remaining-requests': '29',
        'x-ratelimit-reset-requests': '10ms'
      })
    })
    globalThis.fetch = fetchSpy

    const router = new CloudRouter()
    const groqAdapter = new GroqAdapter('test-groq-key')
    const geminiAdapter = new GeminiAdapter('test-gemini-key')

    router.registerProvider(groqAdapter)
    router.registerProvider(geminiAdapter)

    const chosenProvider = router.getBestProvider('everyday')
    expect(chosenProvider?.metadata.id).toBe('groq')

    const options: GenerateOptions = {
      provider: 'everyday',
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }]
    }

    const chunks = []
    const providerOptions: GenerateOptions = {
      ...options,
      provider: chosenProvider!.metadata.id,
      model: chosenProvider!.metadata.defaultModel
    }

    for await (const chunk of chosenProvider!.stream(providerOptions)) {
      chunks.push(chunk)
    }

    expect(chunks).toHaveLength(4)
    expect(chunks[0]).toEqual({ type: 'block-start', index: 0, blockType: 'text' })
    expect(chunks[1]).toEqual({ type: 'text-delta', index: 0, text: 'Hello everyday' })

    expect(fetchSpy).toHaveBeenCalled()
    const callUrl = fetchSpy.mock.calls[0][0] as string
    expect(callUrl).toContain('api.groq.com')
  })

  test('coding tier successfully routes to Gemini adapter', async () => {
    const sseData = [
      'data: {"choices": [{"delta": {"content": "Hello coding"}}]}\n\n',
      'data: [DONE]\n\n'
    ]

    const mockReadableStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder()
        for (const chunk of sseData) {
          controller.enqueue(encoder.encode(chunk))
          await new Promise(r => setTimeout(r, 2))
        }
        controller.close()
      }
    })

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      body: mockReadableStream,
      headers: new Headers()
    })
    globalThis.fetch = fetchSpy

    const router = new CloudRouter()
    const groqAdapter = new GroqAdapter('test-groq-key')
    const geminiAdapter = new GeminiAdapter('test-gemini-key')

    router.registerProvider(groqAdapter)
    router.registerProvider(geminiAdapter)

    const chosenProvider = router.getBestProvider('coding')
    expect(chosenProvider?.metadata.id).toBe('gemini')

    const options: GenerateOptions = {
      provider: 'coding',
      model: 'gemini-1.5-pro',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }]
    }

    const chunks = []
    const providerOptions: GenerateOptions = {
      ...options,
      provider: chosenProvider!.metadata.id,
      model: chosenProvider!.metadata.defaultModel
    }

    for await (const chunk of chosenProvider!.stream(providerOptions)) {
      chunks.push(chunk)
    }

    expect(chunks).toHaveLength(4)
    expect(chunks[0]).toEqual({ type: 'block-start', index: 0, blockType: 'text' })
    expect(chunks[1]).toEqual({ type: 'text-delta', index: 0, text: 'Hello coding' })

    expect(fetchSpy).toHaveBeenCalled()
    const callUrl = fetchSpy.mock.calls[0][0] as string
    expect(callUrl).toContain('googleapis.com')
  })
})
