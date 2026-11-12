import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import { z } from 'zod'
import {
  difficultySchema,
  multipleChoiceQuestionSchema,
  questionTypeSchema,
  trueFalseQuestionSchema,
  type Quiz,
} from '../quiz/schema.ts'

/** Limits for anything coming from a file or link: shared quizzes are untrusted input. */
export const MAX_SHARED_BYTES = 1_000_000
export const MAX_SHARED_QUESTIONS = 100
/** Longer links are unreliable in chat apps; offer the file instead. */
export const MAX_LINK_LENGTH = 8_000

const text = (max: number) => z.string().trim().min(1).max(max)

const sharedQuestionSchema = z.discriminatedUnion('type', [
  multipleChoiceQuestionSchema.extend({
    id: z.string().max(64).optional(),
    prompt: text(1_000),
    options: z.array(text(300)).length(4),
    explanation: text(2_000),
  }),
  trueFalseQuestionSchema.extend({
    id: z.string().max(64).optional(),
    prompt: text(1_000),
    explanation: text(2_000),
  }),
])

/** The versioned, shareable quiz format. Never includes keys, provider, model or source text. */
export const sharedQuizSchema = z.object({
  format: z.literal('quiz-generator'),
  version: z.literal(1),
  title: text(120),
  source: z
    .object({
      kind: z.enum(['topic', 'text', 'file', 'url', 'demo']),
      label: z.string().max(200),
    })
    .optional(),
  settings: z
    .object({
      count: z.number().int().positive().max(MAX_SHARED_QUESTIONS).optional(),
      focus: z.string().max(200).optional(),
      difficulty: difficultySchema.optional(),
      types: z.array(questionTypeSchema).optional(),
    })
    .optional(),
  questions: z.array(sharedQuestionSchema).min(1).max(MAX_SHARED_QUESTIONS),
  createdAt: z.string().max(40).optional(),
})

export type SharedQuiz = z.infer<typeof sharedQuizSchema>

export class ShareError extends Error {}

export function toSharedQuiz(quiz: Quiz): SharedQuiz {
  return {
    format: 'quiz-generator',
    version: 1,
    title: quiz.title,
    source: quiz.source,
    settings: {
      count: quiz.settings.count,
      focus: quiz.settings.focus,
      difficulty: quiz.settings.difficulty,
      types: quiz.settings.types,
    },
    questions: quiz.questions.map((q) => ({ ...q })),
    createdAt: quiz.createdAt,
  }
}

/** Small, stable hash so importing the same quiz twice updates it instead of duplicating it. */
function hash(input: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

/** Builds a playable Quiz from validated shared data, with fresh, consistent ids. */
export function quizFromShared(shared: SharedQuiz): Quiz {
  const questions = shared.questions.map((q, i) => ({ ...q, id: `q${i + 1}` }))
  const types = [...new Set(questions.map((q) => q.type))]
  return {
    id: `shared-${hash(JSON.stringify([shared.title, questions]))}`,
    title: shared.title,
    source: shared.source ?? { kind: 'topic', label: shared.title },
    settings: {
      count: questions.length,
      focus: shared.settings?.focus,
      difficulty: shared.settings?.difficulty ?? 'medium',
      types: shared.settings?.types?.length ? shared.settings.types : types,
    },
    questions,
    createdAt: shared.createdAt ?? new Date().toISOString(),
  }
}

/** Validates untrusted JSON (from a file or link) as a shared quiz. */
export function parseSharedQuiz(value: unknown): Quiz {
  const result = sharedQuizSchema.safeParse(value)
  if (!result.success) {
    throw new ShareError("This doesn't look like a Quiz Generator quiz, or it is damaged.")
  }
  return quizFromShared(result.data)
}

export function parseSharedQuizText(textValue: string): Quiz {
  if (textValue.length > MAX_SHARED_BYTES) throw new ShareError('This quiz file is too large.')
  let value: unknown
  try {
    value = JSON.parse(textValue)
  } catch {
    throw new ShareError("This file isn't valid JSON.")
  }
  return parseSharedQuiz(value)
}

export function encodeQuizForLink(quiz: Quiz): string {
  return compressToEncodedURIComponent(JSON.stringify(toSharedQuiz(quiz)))
}

/**
 * Full share link, or undefined if it would be too long. The quiz sits after the `#`,
 * so it is never sent to any server.
 */
export function shareLink(
  quiz: Quiz,
  base = `${location.origin}${location.pathname}`,
): string | undefined {
  const link = `${base}#/play?q=${encodeQuizForLink(quiz)}`
  return link.length <= MAX_LINK_LENGTH ? link : undefined
}

export function decodeQuizFromLink(param: string): Quiz {
  if (param.length > MAX_LINK_LENGTH * 2) throw new ShareError('This quiz link is too long.')
  const json = decompressFromEncodedURIComponent(param)
  if (!json) throw new ShareError('This quiz link is incomplete or damaged.')
  return parseSharedQuizText(json)
}

export function quizFileName(quiz: Pick<Quiz, 'title'>): string {
  const slug = quiz.title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `${slug || 'quiz'}.quiz.json`
}

/** Saves JSON as a file on the user's device (nothing is uploaded). */
export function downloadJson(fileName: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
  )
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}
