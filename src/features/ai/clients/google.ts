import { FinishReason, GoogleGenAI } from '@google/genai'
import { AiError, toAiError } from '../errors.ts'
import { parseJsonAs } from '../json.ts'
import { FETCH_FAILED, fetchPagePrompt } from '../fetchPrompt.ts'
import type { AiClient, AiClientFactory, CompletionRequest, JsonRequest } from '../types.ts'

function checkFinish(reason: FinishReason | undefined) {
  if (reason === FinishReason.MAX_TOKENS) throw new AiError('truncated')
  if (reason === FinishReason.SAFETY || reason === FinishReason.PROHIBITED_CONTENT) {
    throw new AiError('refusal')
  }
}

export const createGoogleClient: AiClientFactory = (apiKey, model): AiClient => {
  // The user's own key, sent only from their browser straight to Google.
  const ai = new GoogleGenAI({ apiKey })

  return {
    async listModels(signal) {
      try {
        const models = []
        const pager = await ai.models.list({ config: { pageSize: 100, abortSignal: signal } })
        for await (const m of pager) {
          const id = (m.name ?? '').replace(/^models\//, '')
          if (id.startsWith('gemini') && m.supportedActions?.includes('generateContent')) {
            models.push({ id, label: m.displayName ? `${m.displayName} (${id})` : id })
          }
        }
        return models
      } catch (error) {
        throw toAiError(error)
      }
    },

    async generateJson<T>({ system, prompt, maxTokens, schema, signal }: JsonRequest<T>) {
      let response
      try {
        response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction: system,
            maxOutputTokens: maxTokens,
            responseMimeType: 'application/json',
            abortSignal: signal,
          },
        })
      } catch (error) {
        throw toAiError(error)
      }
      checkFinish(response.candidates?.[0]?.finishReason)
      return parseJsonAs(response.text ?? '', schema)
    },

    async fetchUrlText(url, signal) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: fetchPagePrompt(url),
          config: { tools: [{ urlContext: {} }], maxOutputTokens: 16_000, abortSignal: signal },
        })
        checkFinish(response.candidates?.[0]?.finishReason)
        const text = (response.text ?? '').trim()
        if (!text || text.includes(FETCH_FAILED)) throw new AiError('url_failed')
        return text
      } catch (error) {
        throw toAiError(error)
      }
    },

    async *streamText({ system, prompt, maxTokens, signal }: CompletionRequest) {
      try {
        const stream = await ai.models.generateContentStream({
          model,
          contents: prompt,
          config: { systemInstruction: system, maxOutputTokens: maxTokens, abortSignal: signal },
        })
        for await (const chunk of stream) {
          if (chunk.text) yield chunk.text
          checkFinish(chunk.candidates?.[0]?.finishReason)
        }
      } catch (error) {
        throw toAiError(error)
      }
    },
  }
}
