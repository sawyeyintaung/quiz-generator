import { beforeEach, describe, expect, it } from 'vitest'
import { demoQuiz } from '../quiz/demoQuiz.ts'
import type { Quiz } from '../quiz/schema.ts'
import {
  db,
  deleteQuiz,
  exportHistory,
  importHistory,
  saveAttempt,
  saveQuiz,
  type Attempt,
} from './db.ts'

const quiz: Quiz = { ...demoQuiz, id: 'quiz-1', source: { kind: 'topic', label: 'Space' } }

const attempt = (id: string, correct: number, total = 8): Attempt => ({
  id,
  quizId: quiz.id,
  questionIds: quiz.questions.slice(0, total).map((q) => q.id),
  answers: quiz.questions
    .slice(0, total)
    .map((q, i) => ({ questionId: q.id, value: 0, correct: i < correct })),
  correct,
  total,
  bestStreak: correct,
  finishedAt: new Date(Date.now() + Number(id.slice(1)) * 1000).toISOString(),
})

beforeEach(async () => {
  await db.quizzes.clear()
  await db.attempts.clear()
})

describe('history database', () => {
  it('does not store the built-in demo quiz', async () => {
    await saveQuiz(demoQuiz)
    expect(await db.quizzes.count()).toBe(0)
  })

  it('keeps the first save time and origin when a quiz is saved again', async () => {
    await saveQuiz(quiz, 'pasted')
    const first = await db.quizzes.get(quiz.id)
    await saveQuiz({ ...quiz, title: 'Renamed' }, 'generated')
    const second = await db.quizzes.get(quiz.id)
    expect(second).toMatchObject({ title: 'Renamed', origin: 'pasted', savedAt: first?.savedAt })
  })

  it('deletes a quiz together with its attempts', async () => {
    await saveQuiz(quiz)
    await saveAttempt(attempt('a1', 5))
    await deleteQuiz(quiz.id)
    expect(await db.quizzes.count()).toBe(0)
    expect(await db.attempts.count()).toBe(0)
  })

  it('exports and restores a backup', async () => {
    await saveQuiz(quiz)
    await saveAttempt(attempt('a1', 6))
    const backup = await exportHistory()
    await db.quizzes.clear()
    await db.attempts.clear()
    expect(await importHistory(JSON.parse(JSON.stringify(backup)))).toBe(1)
    expect(await db.attempts.get('a1')).toMatchObject({ correct: 6 })
    await expect(importHistory({ format: 'quiz-generator-history', version: 2 })).rejects.toThrow()
  })
})
