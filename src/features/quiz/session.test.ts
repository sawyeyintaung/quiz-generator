import { describe, expect, it } from 'vitest'
import { demoQuiz } from './demoQuiz.ts'
import { answerFor, createSession, score, sessionReducer } from './session.ts'

const [q1, q2, q3] = demoQuiz.questions // MC (correct 1), TF (true), MC (correct 2)

describe('sessionReducer', () => {
  it('records a correct answer and grows the streak', () => {
    const s = sessionReducer(createSession(), { type: 'answer', question: q1, value: 1 })
    expect(answerFor(s, q1)).toEqual({ questionId: q1.id, value: 1, correct: true })
    expect(s.streak).toBe(1)
    expect(score(s)).toBe(1)
  })

  it('resets the streak on a wrong answer but keeps the best streak', () => {
    let s = createSession()
    s = sessionReducer(s, { type: 'answer', question: q1, value: 1 })
    s = sessionReducer(s, { type: 'next' })
    s = sessionReducer(s, { type: 'answer', question: q2, value: true })
    expect(s.streak).toBe(2)
    s = sessionReducer(s, { type: 'next' })
    s = sessionReducer(s, { type: 'answer', question: q3, value: 0 })
    expect(s.streak).toBe(0)
    expect(s.bestStreak).toBe(2)
    expect(score(s)).toBe(2)
  })

  it('ignores a second answer to the same question', () => {
    const s = sessionReducer(createSession(), { type: 'answer', question: q1, value: 0 })
    expect(sessionReducer(s, { type: 'answer', question: q1, value: 1 })).toBe(s)
  })

  it('does not advance before the question is answered', () => {
    const s = createSession()
    expect(sessionReducer(s, { type: 'next' })).toBe(s)
  })

  it('advances past the last available question (waiting for more)', () => {
    let s = sessionReducer(createSession(), { type: 'answer', question: q2, value: false })
    s = sessionReducer(s, { type: 'next' })
    expect(s.index).toBe(1)
    expect(score(s)).toBe(0)
  })
})
