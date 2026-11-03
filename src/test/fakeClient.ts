import type { AiClient, CompletionRequest, JsonRequest } from '../features/ai/types.ts'

type Script = {
  plan: unknown | Error
  /** One entry per streamText call: chunks to yield, optionally ending in an error. */
  streams: (string[] | { chunks: string[]; error: Error })[]
  models?: { id: string; label: string }[]
}

/** A scripted AiClient for tests. Records the prompts it receives. */
export function fakeClient(script: Script) {
  const calls: { json: JsonRequest<unknown>[]; stream: CompletionRequest[] } = {
    json: [],
    stream: [],
  }
  let streamIndex = 0
  const client: AiClient = {
    async listModels() {
      return script.models ?? []
    },
    async generateJson<T>(req: JsonRequest<T>) {
      calls.json.push(req as JsonRequest<unknown>)
      if (script.plan instanceof Error) throw script.plan
      return req.schema.parse(script.plan)
    },
    async *streamText(req: CompletionRequest) {
      calls.stream.push(req)
      const entry = script.streams[streamIndex++] ?? []
      const { chunks, error } = Array.isArray(entry) ? { chunks: entry, error: undefined } : entry
      for (const c of chunks) {
        await Promise.resolve()
        yield c
      }
      if (error) throw error
    },
  }
  return { client, calls }
}

export const mc = (concept: number, prompt: string, answer: string, wrong: string[], extra = {}) =>
  JSON.stringify({
    concept,
    type: 'multiple_choice',
    prompt,
    options: [answer, ...wrong],
    correctIndex: 0,
    explanation: `Because ${answer}.`,
    ...extra,
  })

export const tf = (concept: number, prompt: string, answer: boolean) =>
  JSON.stringify({ concept, type: 'true_false', prompt, answer, explanation: 'Explained.' })
