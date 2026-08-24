import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { CloudRouter } from '../src/cloud-router.ts'
import { GroqAdapter } from '../src/groq-adapter.ts'
import { GeminiAdapter } from '../src/gemini-adapter.ts'
import type { GenerateOptions } from '@deepseek-ai/dsh-llm'

describe('Failover Tier Routing', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test('everyday tier falls back to Gemini when Groq throws fetch network error', async () => {
    const sseData = [
      'data: {"choices": [{"delta": {"content": "Hello fallback"}}]}\n\n',
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

    const fetchSpy = vi.fn().mockImplementation((url: string) => {
      if (url.includes('api.groq.com')) {
        throw new TypeError('fetch failed')
      }
      return Promise.resolve({
        ok: true,
        body: mockReadableStream,
        headers: new Headers()
      })
    })
    globalThis.fetch = fetchSpy

    const router = new CloudRouter()
    const groqAdapter = new GroqAdapter('test-groq-key')
    const geminiAdapter = new GeminiAdapter('test-gemini-key')

    router.registerProvider(groqAdapter)
    router.registerProvider(geminiAdapter)

    const tier = 'everyday'
    const excludeProviders = new Set<string>()
    const chunks = []

    let selectedProvider = router.selectProviderForTier(tier, excludeProviders)
    expect(selectedProvider?.metadata.id).toBe('groq')

    try {
      const providerOptions: GenerateOptions = {
        provider: selectedProvider!.metadata.id,
        model: selectedProvider!.metadata.defaultModel,
        messages: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }]
      }
      for await (const chunk of selectedProvider!.stream(providerOptions)) {
        chunks.push(chunk)
      }
    } catch (err: any) {
      const failover = router.handleFailureAndFailover(tier, selectedProvider!.metadata.id, err, excludeProviders)
      expect(failover.nextProvider?.metadata.id).toBe('gemini')
      
      excludeProviders.add(selectedProvider!.metadata.id)
      selectedProvider = failover.nextProvider!

      const providerOptions: GenerateOptions = {
        provider: selectedProvider.metadata.id,
        model: selectedProvider.metadata.defaultModel,
        messages: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }]
      }
      for await (const chunk of selectedProvider.stream(providerOptions)) {
        chunks.push(chunk)
      }
    }

    expect(groqAdapter.getHealth().status).toBe('unhealthy')
    expect(chunks).toHaveLength(4)
    expect(chunks[1]).toEqual({ type: 'text-delta', index: 0, text: 'Hello fallback' })
  })

  test('recovers mid-stream when primary throws error after yielding first chunk', async () => {
    const backupSseData = [
      'data: {"choices": [{"delta": {"content": "completed from backup"}}]}\n\n',
      'data: [DONE]\n\n'
    ]

    const mockBackupStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder()
        for (const chunk of backupSseData) {
          controller.enqueue(encoder.encode(chunk))
          await new Promise(r => setTimeout(r, 2))
        }
        controller.close()
      }
    })

    const mockPrimaryStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder()
        controller.enqueue(encoder.encode('data: {"choices": [{"delta": {"content": "partial"}}]}\n\n'))
        await new Promise(r => setTimeout(r, 10))
        controller.error(new TypeError('network interrupted'))
      }
    })

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('api.groq.com')) {
        return Promise.resolve({
          ok: true,
          body: mockPrimaryStream,
          headers: new Headers()
        })
      }
      return Promise.resolve({
        ok: true,
        body: mockBackupStream,
        headers: new Headers()
      })
    })

    const router = new CloudRouter()
    const groqAdapter = new GroqAdapter('test-groq-key')
    const geminiAdapter = new GeminiAdapter('test-gemini-key')

    router.registerProvider(groqAdapter)
    router.registerProvider(geminiAdapter)

    const tier = 'everyday'
    const excludeProviders = new Set<string>()
    const chunks = []

    let selectedProvider = router.selectProviderForTier(tier, excludeProviders)
    expect(selectedProvider?.metadata.id).toBe('groq')

    try {
      const providerOptions: GenerateOptions = {
        provider: selectedProvider!.metadata.id,
        model: selectedProvider!.metadata.defaultModel,
        messages: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }]
      }
      for await (const chunk of selectedProvider!.stream(providerOptions)) {
        chunks.push(chunk)
      }
    } catch (err: any) {
      const failover = router.handleFailureAndFailover(tier, selectedProvider!.metadata.id, err, excludeProviders)
      expect(failover.nextProvider?.metadata.id).toBe('gemini')
      
      excludeProviders.add(selectedProvider!.metadata.id)
      selectedProvider = failover.nextProvider!

      const providerOptions: GenerateOptions = {
        provider: selectedProvider.metadata.id,
        model: selectedProvider.metadata.defaultModel,
        messages: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }]
      }
      for await (const chunk of selectedProvider.stream(providerOptions)) {
        chunks.push(chunk)
      }
    }

    expect(groqAdapter.getHealth().status).toBe('unhealthy')
    expect(chunks.some(c => c.type === 'text-delta' && c.text === 'partial')).toBe(true)
    expect(chunks.some(c => c.type === 'text-delta' && c.text === 'completed from backup')).toBe(true)
  })
})
