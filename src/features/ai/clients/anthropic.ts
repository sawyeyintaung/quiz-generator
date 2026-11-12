import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { AiError, toAiError } from '../errors.ts'
import { FETCH_FAILED, fetchPagePrompt } from '../fetchPrompt.ts'
import type { AiClient, AiClientFactory, CompletionRequest, JsonRequest } from '../types.ts'

// The dynamic-filtering web fetch tool needs these models; others use the basic version.
const supportsDynamicFetch = (model: string) =>
  /^claude-(opus-(5|4-[678])|sonnet-(5|4-6)|fable-5)/.test(model)

// Claude 5-family models accept output_config.effort; older ones may reject it.
const supportsEffort = (model: string) => /^claude-(haiku|sonnet|opus|fable)-5/.test(model)

function checkStop(message: Anthropic.Message) {
  if (message.stop_reason === 'refusal') {
    throw new AiError('refusal', message.stop_details?.explanation ?? undefined)
  }
  if (message.stop_reason === 'max_tokens') throw new AiError('truncated')
}

export const createAnthropicClient: AiClientFactory = (apiKey, model): AiClient => {
  // The user's own key, sent only from their browser straight to Anthropic.
  // dangerouslyAllowBrowser adds the header Anthropic requires for browser (CORS) access.
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1 })
  // Quiz writing is straightforward; low effort keeps it fast and cheap for the user.
  const output = supportsEffort(model) ? { effort: 'low' as const } : {}

  return {
    async listModels(signal) {
      try {
        const models = []
        for await (const m of client.models.list({ limit: 100 }, { signal })) {
          models.push({ id: m.id, label: m.display_name || m.id })
        }
        return models
      } catch (error) {
        throw toAiError(error)
      }
    },

    async generateJson<T>({ system, prompt, maxTokens, schema, signal }: JsonRequest<T>) {
      let response
      try {
        response = await client.messages.parse(
          {
            model,
            max_tokens: maxTokens,
            system,
            messages: [{ role: 'user', content: prompt }],
            output_config: { ...output, format: zodOutputFormat(schema) },
          },
          { signal },
        )
      } catch (error) {
        throw toAiError(error)
      }
      checkStop(response)
      // Validate again with the full schema: the API's JSON schema may drop some constraints.
      const result = schema.safeParse(response.parsed_output)
      if (!result.success) throw new AiError('invalid_output', result.error.message)
      return result.data
    },

    async fetchUrlText(url, signal) {
      const host = new URL(url).hostname
      // Server-side fetch tool, limited to the page's own site.
      const tool: Anthropic.ToolUnion = supportsDynamicFetch(model)
        ? { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 3, allowed_domains: [host] }
        : { type: 'web_fetch_20250910', name: 'web_fetch', max_uses: 3, allowed_domains: [host] }
      const messages: Anthropic.MessageParam[] = [{ role: 'user', content: fetchPagePrompt(url) }]
      try {
        for (let i = 0; i < 3; i++) {
          const response = await client.messages.create(
            {
              model,
              max_tokens: 16_000,
              messages,
              tools: [tool],
              ...(supportsEffort(model) ? { output_config: output } : {}),
            },
            { signal },
          )
          if (response.stop_reason === 'pause_turn') {
            // The server paused its tool loop; send the turn back to let it continue.
            messages.push({ role: 'assistant', content: response.content })
            continue
          }
          checkStop(response)
          const text = response.content
            .map((b) => (b.type === 'text' ? b.text : ''))
            .join('')
            .trim()
          if (!text || text.includes(FETCH_FAILED)) throw new AiError('url_failed')
          return text
        }
        throw new AiError('url_failed')
      } catch (error) {
        throw toAiError(error)
      }
    },

    async *streamText({ system, prompt, maxTokens, signal }: CompletionRequest) {
      try {
        const stream = client.messages.stream(
          {
            model,
            max_tokens: maxTokens,
            system,
            messages: [{ role: 'user', content: prompt }],
            ...(supportsEffort(model) ? { output_config: output } : {}),
          },
          { signal },
        )
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            yield event.delta.text
          }
        }
        checkStop(await stream.finalMessage())
      } catch (error) {
        throw toAiError(error)
      }
    },
  }
}
