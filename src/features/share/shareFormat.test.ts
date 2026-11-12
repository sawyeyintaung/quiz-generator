import { describe, expect, it } from 'vitest'
import { demoQuiz } from '../quiz/demoQuiz.ts'
import type { Quiz } from '../quiz/schema.ts'
import {
  decodeQuizFromLink,
  encodeQuizForLink,
  parseSharedQuiz,
  parseSharedQuizText,
  quizFileName,
  shareLink,
  ShareError,
  toSharedQuiz,
} from './shareFormat.ts'

const quiz: Quiz = {
  ...demoQuiz,
  id: 'abc',
  source: { kind: 'topic', label: 'Solar system' },
  provider: 'anthropic',
  model: 'claude-haiku-5-5',
  promptVersion: 1,
}

describe('shared quiz format', () => {
  it('never includes provider, model or ids from this browser', () => {
    const shared = toSharedQuiz(quiz)
    expect(shared).toMatchObject({
      format: 'quiz-generator',
      version: 1,
      title: 'Our Solar System',
    })
    expect(JSON.stringify(shared)).not.toMatch(/anthropic|claude-haiku|promptVersion/)
  })

  it('round-trips through a link and gets a stable id', () => {
    const decoded = decodeQuizFromLink(encodeQuizForLink(quiz))
    expect(decoded.title).toBe(quiz.title)
    expect(decoded.questions).toEqual(quiz.questions)
    expect(decoded.id).toMatch(/^shared-/)
    expect(decodeQuizFromLink(encodeQuizForLink(quiz)).id).toBe(decoded.id)
  })

  it('builds a hash link and refuses links that would be too long', () => {
    expect(shareLink(quiz, 'https://app.example/')).toMatch(/^https:\/\/app\.example\/#\/play\?q=/)
    // Varied text so it can't compress away (a long, real-looking quiz).
    let seed = 7
    const word = () => {
      seed = (seed * 48271) % 2147483647
      return seed.toString(36).slice(0, 6)
    }
    const prompt = () => Array.from({ length: 40 }, word).join(' ')
    const long = {
      ...quiz,
      questions: Array.from({ length: 40 }, (_, i) => ({
        ...quiz.questions[0],
        id: `q${i}`,
        prompt: prompt(),
      })),
    }
    expect(shareLink(long, 'https://app.example/')).toBeUndefined()
  })

  it('rejects damaged or hostile input', () => {
    expect(() => decodeQuizFromLink('not-a-real-quiz')).toThrow(ShareError)
    expect(() => parseSharedQuizText('{oops')).toThrow("isn't valid JSON")
    expect(() => parseSharedQuiz({ format: 'something-else' })).toThrow(ShareError)
    const tooMany = {
      ...toSharedQuiz(quiz),
      questions: Array(101).fill(toSharedQuiz(quiz).questions[0]),
    }
    expect(() => parseSharedQuiz(tooMany)).toThrow(ShareError)
    const badAnswer = {
      ...toSharedQuiz(quiz),
      questions: [{ ...quiz.questions[0], correctIndex: 9 }],
    }
    expect(() => parseSharedQuiz(badAnswer)).toThrow(ShareError)
  })

  it('makes a friendly file name', () => {
    expect(quizFileName({ title: 'Photosynthesis: Light Reactions!' })).toBe(
      'photosynthesis-light-reactions.quiz.json',
    )
  })
})
