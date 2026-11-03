import type { AiClient, CompletionRequest, JsonRequest } from '../features/ai/types.ts'

type Script = {
  plan: unknown | Error
  /** One entry per streamText call: chunks to yield, optionally ending in an error. */
  streams: (string[] | { chunks: string[]; error: Error })[]
  models?: { id: string; label: string }[]
  /** If set, the client can read web pages and returns this text (or throws it). */
  page?: string | Error
  /** Replies for extra generateJson calls (e.g. focus suggestions), used in order. */
  jsonReplies?: unknown[]
}

/** A scripted AiClient for tests. Records the prompts it receives. */
export function fakeClient(script: Script) {
  const calls: { json: JsonRequest<unknown>[]; stream: CompletionRequest[]; urls: string[] } = {
    json: [],
    stream: [],
    urls: [],
  }
  let streamIndex = 0
  const client: AiClient = {
    ...(script.page !== undefined && {
      async fetchUrlText(url: string) {
        calls.urls.push(url)
        if (script.page instanceof Error) throw script.page
        return script.page as string
      },
    }),
    async listModels() {
      return script.models ?? []
    },
    async generateJson<T>(req: JsonRequest<T>) {
      calls.json.push(req as JsonRequest<unknown>)
      const reply = script.jsonReplies?.length ? script.jsonReplies.shift() : script.plan
      if (reply instanceof Error) throw reply
      return req.schema.parse(reply)
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
