import type { ZodType } from 'zod'

export type ProviderId = 'anthropic' | 'openai' | 'google'

export type ModelOption = { id: string; label: string }

export type ProviderInfo = {
  id: ProviderId
  name: string
  company: string
  keyUrl: string
  /** Where API credit is added (API billing is separate from chat subscriptions). */
  billingUrl: string
  keyPlaceholder: string
  /** Preferred fast, low-cost model, used when it is available for the key. */
  defaultModel: string
  /** Shown before the key has been tested and the real model list is known. */
  fallbackModels: ModelOption[]
}

export type CompletionRequest = {
  system: string
  prompt: string
  maxTokens: number
  signal?: AbortSignal
}

export type JsonRequest<T> = CompletionRequest & { schema: ZodType<T> }

/** The small surface the app needs from any AI provider. */
export interface AiClient {
  listModels(signal?: AbortSignal): Promise<ModelOption[]>
  /** One response, parsed and validated as JSON against `schema`. */
  generateJson<T>(request: JsonRequest<T>): Promise<T>
  /** Streams the text of one response, chunk by chunk. */
  streamText(request: CompletionRequest): AsyncIterable<string>
}

export type AiClientFactory = (apiKey: string, model: string) => AiClient
