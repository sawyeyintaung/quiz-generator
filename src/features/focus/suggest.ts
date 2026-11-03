import { z } from 'zod'
import type { AiClient } from '../ai/types.ts'
import { SYSTEM_PROMPT } from '../generate/prompts.ts'
import { wordCount } from '../generate/source.ts'
import type { ParsedFile, Section } from '../sources/types.ts'

export type FocusSuggestion = {
  id: string
  title: string
  description?: string
  /** PDF only, 1-based inclusive. */
  pageRange?: [number, number]
  estimatedQuestions: number
}

/** What we can suggest focus areas for. */
export type FocusInput =
  | { kind: 'topic'; topic: string }
  | { kind: 'text'; text: string }
  | { kind: 'file'; file: ParsedFile }

/** Below this, a source is too small to split into meaningful parts. */
export const MIN_WORDS_FOR_SUGGESTIONS = 300
const WORDS_PER_QUESTION = 70
const MAX_SUGGESTIONS = 8

const estimate = (words: number) => Math.max(1, Math.floor(words / WORDS_PER_QUESTION))

export function inputWords(input: FocusInput): number {
  if (input.kind === 'topic') return Infinity
  return wordCount(input.kind === 'text' ? input.text : input.file.text)
}

/** True when the input is worth suggesting focus areas for at all. */
export function canSuggest(input: FocusInput): boolean {
  return input.kind === 'topic'
    ? input.topic.trim().length >= 3
    : inputWords(input) >= MIN_WORDS_FOR_SUGGESTIONS
}

function finish(list: FocusSuggestion[]): FocusSuggestion[] {
  // Only worth showing if there is a real choice.
  return list.length >= 2 ? list.slice(0, MAX_SUGGESTIONS) : []
}

/** Splits text at "# Heading" lines and measures each part. */
function headingSections(text: string, headings: Section[]): FocusSuggestion[] {
  if (headings.length < 2) return []
  const lines = text.split('\n')
  const parts: { title: string; words: number }[] = []
  for (const line of lines) {
    const title = line.match(/^#{1,3}\s+(.+?)\s*#*\s*$/)?.[1]
    if (title) parts.push({ title, words: 0 })
    else if (parts.length) parts[parts.length - 1].words += wordCount(line)
  }
  return parts
    .filter((p) => p.words >= 60)
    .map((p, i) => ({ id: `h${i}`, title: p.title, estimatedQuestions: estimate(p.words) }))
}

/** PDF bookmarks → page ranges, each running until the next bookmark. */
function outlineSuggestions(file: ParsedFile): FocusSuggestion[] {
  const pages = file.pages ?? []
  const marks = file.sections
    .filter((s): s is Required<Section> => typeof s.page === 'number')
    .sort((a, b) => a.page - b.page)
    .filter((s, i, all) => i === 0 || s.page !== all[i - 1].page)
  return marks
    .map((s, i) => {
      const end = (marks[i + 1]?.page ?? pages.length + 1) - 1
      const range: [number, number] = [s.page, Math.max(s.page, end)]
      const words = wordCount(pages.slice(range[0] - 1, range[1]).join(' '))
      return { id: `p${i}`, title: s.title, pageRange: range, words }
    })
    .filter((s) => s.words >= 100)
    .map(({ words, ...s }) => ({ ...s, estimatedQuestions: estimate(words) }))
}

/** Suggestions from the document's own structure: free, instant, no AI call. */
export function structuralSuggestions(input: FocusInput): FocusSuggestion[] {
  if (!canSuggest(input) || input.kind === 'topic') return []
  if (input.kind === 'file') {
    const fromOutline = input.file.pages ? outlineSuggestions(input.file) : []
    if (fromOutline.length >= 2) return finish(fromOutline)
    return finish(headingSections(input.file.text, input.file.sections))
  }
  const headings = input.text
    .split('\n')
    .filter((l) => /^#{1,3}\s+\S/.test(l))
    .map((title) => ({ title }))
  return finish(headingSections(input.text, headings))
}

const CONDENSED_CHARS = 15_000

/** A short view of a long source: page openings for PDFs, evenly spaced samples otherwise. */
export function condensedView(input: FocusInput): string {
  if (input.kind === 'topic') return input.topic
  if (input.kind === 'file' && input.file.pages) {
    const pages = input.file.pages
    const per = Math.max(150, Math.floor(CONDENSED_CHARS / pages.length))
    const step = Math.max(1, Math.ceil((pages.length * 150) / CONDENSED_CHARS))
    const parts: string[] = []
    for (let i = 0; i < pages.length; i += step) {
      parts.push(`[Page ${i + 1}]\n${pages[i].slice(0, per).trim()}`)
    }
    return parts.join('\n\n')
  }
  const text = input.kind === 'text' ? input.text : input.file.text
  if (text.length <= CONDENSED_CHARS) return text
  const samples = 15
  const size = Math.floor(CONDENSED_CHARS / samples)
  const gap = Math.floor((text.length - size) / (samples - 1))
  return Array.from({ length: samples }, (_, i) => text.slice(i * gap, i * gap + size).trim()).join(
    '\n[…]\n',
  )
}

const aiSchema = z.object({
  suggestions: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      fromPage: z.number().int().nullable(),
      toPage: z.number().int().nullable(),
      estimatedQuestions: z.number().int(),
    }),
  ),
})

function aiPrompt(input: FocusInput): string {
  const isTopic = input.kind === 'topic'
  const isPdf = input.kind === 'file' && Boolean(input.file.pages)
  const kind = isTopic ? 'topic' : 'study material'
  return `<source type="${kind}">
${condensedView(input).replace(/<\/?source\b[^>]*>/gi, '')}
</source>

${
  isTopic
    ? 'Suggest 4 to 8 subtopics a learner could choose to be quizzed on separately.'
    : `This is ${input.kind === 'file' ? 'a condensed view of a longer document' : 'the learner’s study material'}. Suggest 4 to 8 distinct parts of it a learner could choose to be quizzed on separately.`
}

Rules:
- Each suggestion must cover a different part or idea, with a short title (at most 6 words) and a one-sentence description.
- estimatedQuestions: how many distinct quiz questions that part could support (roughly one per 70 words of material; for a topic, a sensible number between 3 and 20).
${isPdf ? '- fromPage/toPage: the page range the part covers, using the [Page N] markers.' : '- fromPage/toPage: null.'}
- If the ${kind} is already narrow or has no clear separate parts, return an empty list.

Respond with JSON only: {"suggestions": [{"title": "...", "description": "...", "fromPage": null, "toPage": null, "estimatedQuestions": 5}]}`
}

const cache = new Map<string, Promise<FocusSuggestion[]>>()

function cacheKey(input: FocusInput): string {
  const body =
    input.kind === 'topic' ? input.topic.trim().toLowerCase() : condensedView(input).slice(0, 2000)
  const len = input.kind === 'topic' ? 0 : inputWords(input)
  return `${input.kind}:${len}:${body}`
}

/** AI-written suggestions, cached per source so the same source never costs twice. */
export function aiSuggestions(
  client: AiClient,
  input: FocusInput,
  signal?: AbortSignal,
): Promise<FocusSuggestion[]> {
  const key = cacheKey(input)
  const cached = cache.get(key)
  if (cached) return cached
  const pageCount = input.kind === 'file' ? (input.file.pages?.length ?? 0) : 0
  const promise = client
    .generateJson({
      system: SYSTEM_PROMPT,
      prompt: aiPrompt(input),
      schema: aiSchema,
      maxTokens: 4_000,
      signal,
    })
    .then(({ suggestions }) =>
      finish(
        suggestions
          .filter((s) => s.title.trim())
          .map((s, i) => {
            const from = s.fromPage ?? undefined
            const to = s.toPage ?? from
            const valid = pageCount > 0 && from && to && from >= 1 && to >= from && to <= pageCount
            return {
              id: `ai${i}`,
              title: s.title.trim().slice(0, 60),
              description: s.description.trim() || undefined,
              pageRange: valid ? ([from, to] as [number, number]) : undefined,
              estimatedQuestions: Math.min(30, Math.max(1, s.estimatedQuestions)),
            }
          }),
      ),
    )
  // Don't cache failures, so the user can try again.
  promise.catch(() => cache.delete(key))
  cache.set(key, promise)
  return promise
}

export function clearSuggestionCacheForTests() {
  cache.clear()
}
