import { OpenAiAdapterBase } from './openai-adapter-base.ts'
import { PROVIDER_CATALOG } from './provider-catalog.ts'

export class GeminiAdapter extends OpenAiAdapterBase {
  constructor(apiKey?: string) {
    super(PROVIDER_CATALOG.gemini, apiKey)
  }

  // Gemini OpenAI-compatibility layer does not return standard rate limit headers today.
  // We rely on standard HTTP 429 status code handling in the base class.
}
