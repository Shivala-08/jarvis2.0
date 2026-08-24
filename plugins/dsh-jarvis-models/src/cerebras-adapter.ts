import { OpenAiAdapterBase } from './openai-adapter-base.ts'
import { PROVIDER_CATALOG } from './provider-catalog.ts'

export class CerebrasAdapter extends OpenAiAdapterBase {
  constructor(apiKey?: string) {
    super(PROVIDER_CATALOG.cerebras, apiKey)
  }

  // Cerebras is OpenAI compatible.
  // It returns standard HTTP status codes (like 429 for rate limiting) which is handled by OpenAiAdapterBase.
}
