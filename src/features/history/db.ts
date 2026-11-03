import { Dexie, type EntityTable } from 'dexie'
import { useLiveQuery } from 'dexie-react-hooks'
import { z } from 'zod'
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

class HistoryDb extends Dexie {
  quizzes!: EntityTable<StoredQuiz, 'id'>
  attempts!: EntityTable<Attempt, 'id'>

  constructor() {
    super('quiz-generator')
    this.version(1).stores({
      quizzes: 'id, savedAt',
      attempts: 'id, quizId, finishedAt',
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

export async function deleteQuiz(id: string) {
  await db.transaction('rw', db.quizzes, db.attempts, async () => {
    await db.attempts.where('quizId').equals(id).delete()
    await db.quizzes.delete(id)
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
})

export type HistoryBackup = z.infer<typeof backupSchema>

export async function exportHistory(): Promise<HistoryBackup> {
  const [quizzes, attempts] = await Promise.all([db.quizzes.toArray(), db.attempts.toArray()])
  return {
    format: 'quiz-generator-history',
    version: 1,
    exportedAt: new Date().toISOString(),
    quizzes,
    attempts,
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
  const { quizzes, attempts } = result.data
  await db.transaction('rw', db.quizzes, db.attempts, async () => {
    await db.quizzes.bulkPut(quizzes)
    await db.attempts.bulkPut(attempts)
  })
  void requestPersistence()
  return quizzes.length
}
