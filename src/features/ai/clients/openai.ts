import OpenAI from 'openai'
import { AiError, toAiError } from '../errors.ts'
import { parseJsonAs } from '../json.ts'
import type { AiClient, AiClientFactory, CompletionRequest, JsonRequest } from '../types.ts'

// Keep text-generation chat models; hide audio, image, embedding, moderation, etc.
const chatModel = /^(gpt-|o\d|chatgpt-)/
const nonChat = /(audio|realtime|tts|transcribe|image|embedding|moderation|search|instruct|codex)/

export const createOpenAIClient: AiClientFactory = (apiKey, model): AiClient => {
  // The user's own key, sent only from their browser straight to OpenAI.
  const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1 })

  return {
    async listModels(signal) {
      try {
        const models = []
        for await (const m of client.models.list({ signal })) {
          if (chatModel.test(m.id) && !nonChat.test(m.id)) models.push({ id: m.id, label: m.id })
        }
        return models.sort((a, b) => a.id.localeCompare(b.id))
      } catch (error) {
        throw toAiError(error)
      }
    },

    async generateJson<T>({ system, prompt, maxTokens, schema, signal }: JsonRequest<T>) {
      let response
      try {
        response = await client.chat.completions.create(
          {
            model,
            max_completion_tokens: maxTokens,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: prompt },
            ],
          },
          { signal },
        )
      } catch (error) {
        throw toAiError(error)
      }
      const choice = response.choices[0]
      if (choice?.message.refusal) throw new AiError('refusal', choice.message.refusal)
      if (choice?.finish_reason === 'length') throw new AiError('truncated')
      return parseJsonAs(choice?.message.content ?? '', schema)
    },

    async *streamText({ system, prompt, maxTokens, signal }: CompletionRequest) {
      try {
        const stream = await client.chat.completions.create(
          {
            model,
            max_completion_tokens: maxTokens,
            stream: true,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: prompt },
            ],
          },
          { signal },
        )
        for await (const chunk of stream) {
          const choice = chunk.choices[0]
          if (choice?.delta.refusal) throw new AiError('refusal', choice.delta.refusal)
          if (choice?.delta.content) yield choice.delta.content
          if (choice?.finish_reason === 'length') throw new AiError('truncated')
        }
      } catch (error) {
        throw toAiError(error)
      }
    },
  }
}
