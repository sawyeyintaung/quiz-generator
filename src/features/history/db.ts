import { Dexie, type EntityTable } from 'dexie'
import { useLiveQuery } from 'dexie-react-hooks'
import { z } from 'zod'
import type { GenerationRequest } from '../generate/types.ts'
import { quizSchema, type AnswerValue, type Quiz } from '../quiz/schema.ts'

/** How a quiz got into this browser. */
export type QuizOrigin = 'generated' | 'pasted' | 'imported'

export type StoredQuiz = Quiz & { origin: QuizOrigin; savedAt: string }

export type Attempt = {
  id: string
  quizId: string
  questionIds: string[]
  answers: { questionId: string; value: AnswerValue; correct: boolean }[]
  correct: number
  total: number
  bestStreak: number
  finishedAt: string
}

/**
 * A source (topic, notes, file text or link) kept so later quizzes can continue from it
 * without repeating ideas. Stored only in this browser.
 */
export type StoredSource = {
  id: string
  /** The original request minus the per-batch fields. Holds the notes/file text itself. */
  request: Omit<GenerationRequest, 'sourceId' | 'avoid'>
  label: string
  /** Short labels of the ideas already quizzed. */
  covered: string[]
  /** Questions already asked (sent as "don't repeat these"). */
  prompts: string[]
  /** The AI's latest estimate of distinct ideas in the whole source (or focus). */
  totalIdeas?: number
  /** True once the AI reports nothing new is left. */
  exhausted: boolean
  createdAt: string
  updatedAt: string
}

class HistoryDb extends Dexie {
  quizzes!: EntityTable<StoredQuiz, 'id'>
  attempts!: EntityTable<Attempt, 'id'>
  sources!: EntityTable<StoredSource, 'id'>

  constructor() {
    super('quiz-generator')
    this.version(1).stores({
      quizzes: 'id, savedAt',
      attempts: 'id, quizId, finishedAt',
    })
    this.version(2).stores({
      quizzes: 'id, savedAt',
      attempts: 'id, quizId, finishedAt',
      sources: 'id, updatedAt',
    })
  }
}

export const db = new HistoryDb()

let persistRequested = false

/** Asks the browser to keep our data under storage pressure (best effort, asked once). */
async function requestPersistence() {
  if (persistRequested) return
  persistRequested = true
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist()
    }
  } catch {
    // Not supported or denied: data is still saved, just evictable.
  }
}

export function originOf(quiz: Quiz): QuizOrigin | undefined {
  if (quiz.source.kind === 'demo') return undefined // the demo is built in, not history
  if (quiz.id.startsWith('shared-')) return 'imported'
  return quiz.provider === 'copy-paste' ? 'pasted' : 'generated'
}

/** Saves or updates a quiz. Keeps the original save time and origin if it already exists. */
export async function saveQuiz(quiz: Quiz, origin = originOf(quiz)) {
  if (!origin) return
  const existing = await db.quizzes.get(quiz.id)
  await db.quizzes.put({
    ...quiz,
    origin: existing?.origin ?? origin,
    savedAt: existing?.savedAt ?? new Date().toISOString(),
  })
  void requestPersistence()
}

export async function saveAttempt(attempt: Attempt) {
  await db.attempts.put(attempt)
}

/** Deletes a quiz and its scores, and its saved source text once no other quiz uses it. */
export async function deleteQuiz(id: string) {
  await db.transaction('rw', db.quizzes, db.attempts, db.sources, async () => {
    const sourceId = (await db.quizzes.get(id))?.sourceId
    await db.attempts.where('quizId').equals(id).delete()
    await db.quizzes.delete(id)
    if (sourceId && (await db.quizzes.filter((q) => q.sourceId === sourceId).count()) === 0) {
      await db.sources.delete(sourceId)
    }
  })
}

export type HistoryEntry = {
  quiz: StoredQuiz
  attempts: Attempt[] // newest first
  best?: Attempt
  last?: Attempt
}

async function loadHistory(): Promise<HistoryEntry[]> {
  const [quizzes, attempts] = await Promise.all([db.quizzes.toArray(), db.attempts.toArray()])
  const byQuiz = new Map<string, Attempt[]>()
  for (const a of attempts) byQuiz.set(a.quizId, [...(byQuiz.get(a.quizId) ?? []), a])
  return quizzes
    .map((quiz) => {
      const list = (byQuiz.get(quiz.id) ?? []).sort((a, b) =>
        b.finishedAt.localeCompare(a.finishedAt),
      )
      // Best and last only count full runs, not "retry missed" subsets.
      const full = list.filter((a) => a.total === quiz.questions.length)
      const best = full.reduce<Attempt | undefined>(
        (top, a) => (!top || a.correct > top.correct ? a : top),
        undefined,
      )
      return { quiz, attempts: list, best, last: list[0] }
    })
    .sort((a, b) => b.quiz.savedAt.localeCompare(a.quiz.savedAt))
}

/**
 * Live history list; undefined while loading, 'unavailable' if this browser blocks
 * storage (e.g. some private windows). Updates whenever the database changes.
 */
export function useHistory(): HistoryEntry[] | 'unavailable' | undefined {
  return useLiveQuery(() => loadHistory().catch(() => 'unavailable' as const), [])
}

// ---- Backup (export / import of the whole history) ----

const attemptSchema = z.object({
  id: z.string().min(1).max(100),
  quizId: z.string().min(1).max(100),
  questionIds: z.array(z.string().max(64)).max(500),
  answers: z
    .array(
      z.object({
        questionId: z.string().max(64),
        value: z.union([z.number(), z.boolean()]),
        correct: z.boolean(),
      }),
    )
    .max(500),
  correct: z.number().int().min(0),
  total: z.number().int().min(0),
  bestStreak: z.number().int().min(0),
  finishedAt: z.string().max(40),
})

const backupSchema = z.object({
  format: z.literal('quiz-generator-history'),
  version: z.literal(1),
  exportedAt: z.string(),
  quizzes: z.array(
    quizSchema.extend({
      origin: z.enum(['generated', 'pasted', 'imported']),
      savedAt: z.string().max(40),
    }),
  ),
  attempts: z.array(attemptSchema),
  // Added later: older backups have no sources.
  sources: z
    .array(
      z.object({
        id: z.string().min(1).max(100),
        request: z.looseObject({}),
        label: z.string().max(500),
        covered: z.array(z.string().max(500)).max(1000),
        prompts: z.array(z.string().max(2000)).max(1000),
        totalIdeas: z.number().int().nonnegative().optional(),
        exhausted: z.boolean(),
        createdAt: z.string().max(40),
        updatedAt: z.string().max(40),
      }),
    )
    .optional(),
})

export type HistoryBackup = z.infer<typeof backupSchema>

export async function exportHistory(): Promise<HistoryBackup> {
  const [quizzes, attempts, sources] = await Promise.all([
    db.quizzes.toArray(),
    db.attempts.toArray(),
    db.sources.toArray(),
  ])
  return {
    format: 'quiz-generator-history',
    version: 1,
    exportedAt: new Date().toISOString(),
    quizzes,
    attempts,
    sources,
  }
}

export function isHistoryBackup(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { format?: unknown }).format === 'quiz-generator-history'
  )
}

/** Merges a backup into this browser's history. Returns how many quizzes were imported. */
export async function importHistory(value: unknown): Promise<number> {
  const result = backupSchema.safeParse(value)
  if (!result.success) throw new Error('This history backup is damaged or from an unknown version.')
  const { quizzes, attempts, sources = [] } = result.data
  await db.transaction('rw', db.quizzes, db.attempts, db.sources, async () => {
    await db.quizzes.bulkPut(quizzes)
    await db.attempts.bulkPut(attempts)
    await db.sources.bulkPut(sources as StoredSource[])
  })
  void requestPersistence()
  return quizzes.length
}

// ---- Sources: "questions left" and the next batch ----

const MAX_REMEMBERED = 400

/**
 * Records what a finished batch covered. Creates the source on its first quiz.
 * `exhausted` means the AI reported that nothing new was left.
 */
export async function recordCoverage(
  request: GenerationRequest,
  label: string,
  batch: { concepts: string[]; prompts: string[]; totalIdeas?: number; exhausted?: boolean },
) {
  if (!request.sourceId) return
  const id = request.sourceId
  await db.transaction('rw', db.sources, async () => {
    const existing = await db.sources.get(id)
    const now = new Date().toISOString()
    const merge = (a: string[], b: string[]) =>
      [...new Set([...a, ...b.map((x) => x.trim()).filter(Boolean)])].slice(-MAX_REMEMBERED)
    // Keep the original request (with the notes/file text), minus the per-batch fields.
    const stored: StoredSource['request'] = {
      source: request.source,
      focus: request.focus,
      count: request.count,
      difficulty: request.difficulty,
      types: request.types,
    }
    await db.sources.put({
      id,
      request: existing?.request ?? stored,
      label: existing?.label ?? label,
      covered: merge(existing?.covered ?? [], batch.concepts),
      prompts: merge(existing?.prompts ?? [], batch.prompts),
      totalIdeas: batch.totalIdeas ?? existing?.totalIdeas,
      exhausted: Boolean(batch.exhausted),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    })
  })
  void requestPersistence()
}

export function useSource(id: string | undefined): StoredSource | null | undefined {
  return useLiveQuery(() => (id ? db.sources.get(id).then((s) => s ?? null) : null), [id])
}
