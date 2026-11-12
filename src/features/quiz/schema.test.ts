import { describe, expect, it } from 'vitest'
import { demoQuiz } from './demoQuiz.ts'
import { answerText, correctAnswerText, isCorrect, questionSchema } from './schema.ts'

describe('question schema', () => {
  it('rejects multiple choice without exactly 4 options', () => {
    const result = questionSchema.safeParse({
      id: 'x',
      type: 'multiple_choice',
      prompt: 'p',
      options: ['a', 'b', 'c'],
      correctIndex: 0,
      explanation: 'e',
    })
    expect(result.success).toBe(false)
  })

  it('rejects an out-of-range correctIndex', () => {
    const result = questionSchema.safeParse({
      id: 'x',
      type: 'multiple_choice',
      prompt: 'p',
      options: ['a', 'b', 'c', 'd'],
      correctIndex: 4,
      explanation: 'e',
    })
    expect(result.success).toBe(false)
  })

  it('checks answers and formats them', () => {
    const [mc, tf] = demoQuiz.questions
    expect(isCorrect(mc, 1)).toBe(true)
    expect(isCorrect(mc, 0)).toBe(false)
    expect(isCorrect(tf, true)).toBe(true)
    expect(correctAnswerText(mc)).toBe('Mercury')
    expect(correctAnswerText(tf)).toBe('True')
    expect(answerText(mc, 0)).toBe('Venus')
    expect(answerText(tf, false)).toBe('False')
  })
})
