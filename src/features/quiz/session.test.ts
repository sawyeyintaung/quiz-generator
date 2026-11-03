import { describe, expect, it } from 'vitest'
import { demoQuiz } from './demoQuiz.ts'
import { createSession, currentAnswer, score, sessionReducer } from './session.ts'

const [q1, q2, q3] = demoQuiz.questions // MC (correct 1), TF (true), MC (correct 2)

describe('sessionReducer', () => {
  it('records a correct answer and grows the streak', () => {
    const s = sessionReducer(createSession([q1, q2]), { type: 'answer', value: 1 })
    expect(currentAnswer(s)).toEqual({ questionId: q1.id, value: 1, correct: true })
    expect(s.streak).toBe(1)
    expect(score(s)).toBe(1)
  })

  it('resets the streak on a wrong answer but keeps the best streak', () => {
    let s = createSession([q1, q2, q3])
    s = sessionReducer(s, { type: 'answer', value: 1 })
    s = sessionReducer(s, { type: 'next' })
    s = sessionReducer(s, { type: 'answer', value: true })
    expect(s.streak).toBe(2)
    s = sessionReducer(s, { type: 'next' })
    s = sessionReducer(s, { type: 'answer', value: 0 })
    expect(s.streak).toBe(0)
    expect(s.bestStreak).toBe(2)
    expect(score(s)).toBe(2)
  })

  it('ignores a second answer to the same question', () => {
    let s = createSession([q1])
    s = sessionReducer(s, { type: 'answer', value: 0 })
    const again = sessionReducer(s, { type: 'answer', value: 1 })
    expect(again).toBe(s)
  })

  it('does not advance before the question is answered', () => {
    const s = createSession([q1, q2])
    expect(sessionReducer(s, { type: 'next' })).toBe(s)
  })

  it('finishes after the last question', () => {
    let s = createSession([q2])
    s = sessionReducer(s, { type: 'answer', value: false })
    s = sessionReducer(s, { type: 'next' })
    expect(s.finished).toBe(true)
    expect(score(s)).toBe(0)
  })
})
