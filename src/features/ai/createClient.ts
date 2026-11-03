import type { AiClient, ProviderId } from './types.ts'

/**
 * Loads only the SDK for the chosen provider (each is a separate chunk),
 * so users don't download all three.
 */
export async function createAiClient(
  provider: ProviderId,
  apiKey: string,
  model: string,
): Promise<AiClient> {
  switch (provider) {
    case 'anthropic':
      return (await import('./clients/anthropic.ts')).createAnthropicClient(apiKey, model)
    case 'openai':
      return (await import('./clients/openai.ts')).createOpenAIClient(apiKey, model)
    case 'google':
      return (await import('./clients/google.ts')).createGoogleClient(apiKey, model)
  }
}
