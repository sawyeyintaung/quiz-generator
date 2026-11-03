import type { Question } from '../quiz/schema.ts'
import { isDuplicate } from './dedupe.ts'
import { toQuestion } from './modelQuestion.ts'
import type { GenerationRequest } from './types.ts'

export type PasteResult = {
  title?: string
  questions: Question[]
  /** The concept label of each accepted question (same order as `questions`). */
  concepts: string[]
  /** The AI's estimate of distinct ideas in the whole source, if it gave one. */
  totalIdeas?: number
  /** Items we found but could not use, so the user knows what happened. */
  skipped: { invalid: number; duplicates: number; extra: number }
}

/** Candidate JSON texts, most likely first: fenced blocks, the whole reply, then the outer braces. */
function candidates(text: string): string[] {
  const found: string[] = []
  for (const m of text.matchAll(/```(?:json)?\s*\n?([\s\S]*?)```/gi)) found.push(m[1].trim())
  found.push(text.trim())
  const start = text.search(/[[{]/)
  const end = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'))
  if (start >= 0 && end > start) found.push(text.slice(start, end + 1))
  return found
}

type Extracted = { title?: string; totalIdeas?: number; items: unknown[] }

function asItems(value: unknown): Extracted | undefined {
  if (Array.isArray(value)) return { items: value }
  if (typeof value === 'object' && value !== null) {
    const v = value as Record<string, unknown>
    if (Array.isArray(v.questions)) {
      const total = typeof v.totalIdeas === 'number' ? Math.round(v.totalIdeas) : undefined
      return {
        title: typeof v.title === 'string' ? v.title : undefined,
        totalIdeas: total && total > 0 && total < 100_000 ? total : undefined,
        items: v.questions,
      }
    }
  }
  return undefined
}

function extract(text: string): Extracted {
  for (const candidate of candidates(text)) {
    try {
      const parsed = asItems(JSON.parse(candidate))
      if (parsed) return parsed
    } catch {
      // Try the next candidate.
    }
  }
  // Fall back to JSON Lines: one question object per line.
  const items: unknown[] = []
  for (const line of text.split('\n')) {
    const cleaned = line.trim().replace(/^[[,\s]+|[\],\s]+$/g, '')
    if (!cleaned.startsWith('{')) continue
    try {
      items.push(JSON.parse(cleaned))
    } catch {
      // Skip lines that are not complete JSON objects.
    }
  }
  return { items }
}

/**
 * Reads a reply pasted from Claude, ChatGPT or Gemini. Accepts a JSON object
 * with `questions`, a bare array, or JSON Lines, with or without code fences and
 * surrounding commentary. Every question gets the same checks as API-generated ones.
 */
export function parsePastedReply(
  text: string,
  req: GenerationRequest,
  random: () => number = Math.random,
): PasteResult {
  const { title, totalIdeas, items } = extract(text)
  const questions: Question[] = []
  const concepts: string[] = []
  const skipped = { invalid: 0, duplicates: 0, extra: 0 }

  for (const item of items) {
    if (typeof item !== 'object' || item === null) {
      skipped.invalid++
      continue
    }
    const q = toQuestion(item as Record<string, unknown>, `q${questions.length + 1}`, req, random)
    if (!q) skipped.invalid++
    else if (isDuplicate(q, questions)) skipped.duplicates++
    else if (questions.length >= req.count) skipped.extra++
    else {
      questions.push(q)
      const label = (item as Record<string, unknown>).concept
      concepts.push(
        typeof label === 'string' && label.trim()
          ? label.trim().slice(0, 80)
          : q.prompt.slice(0, 80),
      )
    }
  }

  const cleanTitle = title?.replace(/\s+/g, ' ').trim()
  return {
    title: cleanTitle ? cleanTitle.slice(0, 60) : undefined,
    questions,
    concepts,
    totalIdeas,
    skipped,
  }
}
