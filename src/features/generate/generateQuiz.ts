import { z } from 'zod'
import { AiError, toAiError } from '../ai/errors.ts'
import { LineBuffer, stripCodeFence } from '../ai/json.ts'
import type { AiClient } from '../ai/types.ts'
import type { Question } from '../quiz/schema.ts'
import { isDuplicate, uniqueConcepts } from './dedupe.ts'
import { toQuestion } from './modelQuestion.ts'
import { MAX_AVOID_PROMPTS, planPrompt, SYSTEM_PROMPT, writePrompt } from './prompts.ts'
import type { GenerationRequest } from './types.ts'

// Room for the model's reasoning as well as its answer; unused tokens are not billed.
const PLAN_MAX_TOKENS = 8_000
const WRITE_MAX_TOKENS = 32_000

export const planSchema = z.object({
  title: z.string(),
  /** Estimated distinct ideas in the whole source (for "questions left"). */
  totalIdeas: z.number().int().nonnegative().optional(),
  concepts: z.array(z.string()),
})

export type GenerationEvent =
  | { type: 'planned'; title: string; plannedCount: number; totalIdeas?: number }
  /** `concept` is the planned idea this question covers. */
  | { type: 'question'; question: Question; concept: string }
  | { type: 'done'; note?: string }

type Options = { signal?: AbortSignal; random?: () => number }

/**
 * Plans distinct concepts, then streams one question per concept (JSON Lines),
 * validating and de-duplicating each as it arrives. Missing questions get one
 * top-up attempt; if the source supports fewer questions, we return fewer.
 */
export async function* generateQuiz(
  client: AiClient,
  req: GenerationRequest,
  { signal, random = Math.random }: Options = {},
): AsyncGenerator<GenerationEvent> {
  // 0. Web pages: the provider fetches the page; we then quiz on its text.
  if (req.source.kind === 'url') {
    if (!client.fetchUrlText) throw new AiError('url_unsupported')
    let text: string
    try {
      text = await client.fetchUrlText(req.source.url, signal)
    } catch (error) {
      throw toAiError(error)
    }
    req = { ...req, source: { kind: 'text', text, label: req.source.url } }
  }

  // 1. Plan
  let plan: z.infer<typeof planSchema>
  try {
    plan = await client.generateJson({
      system: SYSTEM_PROMPT,
      prompt: planPrompt(req),
      schema: planSchema,
      maxTokens: PLAN_MAX_TOKENS,
      signal,
    })
  } catch (error) {
    throw toAiError(error)
  }
  const concepts = uniqueConcepts(plan.concepts)
    .slice(0, req.count)
    .map((text, i) => ({ number: i + 1, text }))
  const continuing = Boolean(req.avoid?.concepts.length)
  if (concepts.length === 0) throw new AiError(continuing ? 'source_exhausted' : 'empty_source')

  const title = cleanTitle(plan.title, req)
  yield {
    type: 'planned',
    title,
    plannedCount: concepts.length,
    totalIdeas: plan.totalIdeas || undefined,
  }

  // 2. Write (plus one top-up round for concepts that came back missing or duplicated)
  const accepted: Question[] = []
  const covered = new Set<number>()
  let stopNote: string | undefined

  for (let round = 0; round < 2; round++) {
    const pending = concepts.filter((c) => !covered.has(c.number))
    if (pending.length === 0) break
    try {
      // Earlier batches' questions plus this batch's: none may be repeated.
      const avoid = [
        ...(req.avoid?.prompts.slice(-MAX_AVOID_PROMPTS) ?? []),
        ...accepted.map((q) => q.prompt),
      ]
      const stream = client.streamText({
        system: SYSTEM_PROMPT,
        prompt: writePrompt(req, pending, avoid),
        maxTokens: WRITE_MAX_TOKENS,
        signal,
      })
      for await (const raw of parseLines(stream)) {
        const question = toQuestion(raw, `q${accepted.length + 1}`, req, random)
        if (!question || isDuplicate(question, accepted)) continue
        const concept = typeof raw.concept === 'number' ? raw.concept : undefined
        const owner =
          concept && !covered.has(concept)
            ? concept
            : pending.find((c) => !covered.has(c.number))?.number
        if (owner === undefined) continue // more questions than planned concepts
        covered.add(owner)
        accepted.push(question)
        yield { type: 'question', question, concept: concepts[owner - 1].text }
      }
    } catch (error) {
      const aiError = toAiError(error)
      // Keep what we have unless the user cancelled or nothing was written yet.
      if (aiError.kind === 'aborted' || accepted.length === 0) throw aiError
      stopNote = `Generation stopped early: ${aiError.message}`
      break
    }
  }

  if (accepted.length === 0) throw new AiError('invalid_output', 'No valid questions were returned')

  yield { type: 'done', note: stopNote ?? fewerNote(accepted.length, req) }
}

function fewerNote(made: number, req: GenerationRequest): string | undefined {
  if (made >= req.count) return undefined
  if (req.avoid?.concepts.length) {
    return `Only ${made} new idea${made === 1 ? ' was' : 's were'} left in this source, so we made ${made} question${made === 1 ? '' : 's'}.`
  }
  const what = req.focus?.trim() ? 'this focus' : 'your source'
  return `${capitalize(what)} supports ${made} unique question${made === 1 ? '' : 's'}, so we made ${made} instead of ${req.count} rather than repeat ourselves.`
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function cleanTitle(title: string, req: GenerationRequest): string {
  const t = title.replace(/\s+/g, ' ').trim()
  if (t) return t.length > 60 ? `${t.slice(0, 59)}…` : t
  return req.source.kind === 'topic' ? req.source.text.slice(0, 60) : 'My quiz'
}

/** Parses JSON Lines from a text stream; skips fences, brackets and malformed lines. */
async function* parseLines(stream: AsyncIterable<string>): AsyncGenerator<Record<string, unknown>> {
  const buffer = new LineBuffer()
  const parse = (line: string) => {
    const cleaned = stripCodeFence(line).replace(/^[[,\s]+|[\],\s]+$/g, '')
    if (!cleaned.startsWith('{')) return undefined
    try {
      const value: unknown = JSON.parse(cleaned)
      return typeof value === 'object' && value !== null
        ? (value as Record<string, unknown>)
        : undefined
    } catch {
      return undefined
    }
  }
  for await (const chunk of stream) {
    for (const line of buffer.push(chunk)) {
      const value = parse(line)
      if (value) yield value
    }
  }
  for (const line of buffer.flush()) {
    const value = parse(line)
    if (value) yield value
  }
}
