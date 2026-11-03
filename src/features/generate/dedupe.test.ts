import { describe, expect, it } from 'vitest'
import type { Question } from '../quiz/schema.ts'
import { isDuplicate, similarity, uniqueConcepts } from './dedupe.ts'

const mcq = (id: string, prompt: string, answer: string): Question => ({
  id,
  type: 'multiple_choice',
  prompt,
  options: [answer, 'Alpha', 'Beta', 'Gamma'],
  correctIndex: 0,
  explanation: 'e',
})
const tfq = (id: string, prompt: string, answer: boolean): Question => ({
  id,
  type: 'true_false',
  prompt,
  answer,
  explanation: 'e',
})

describe('dedupe', () => {
  const existing = [mcq('1', 'Which planet is closest to the Sun?', 'Mercury')]

  it('flags reworded questions with the same answer', () => {
    expect(
      isDuplicate(mcq('2', 'What planet orbits closest to the Sun?', 'Mercury'), existing),
    ).toBe(true)
    expect(
      isDuplicate(mcq('3', 'Which planet is the closest one to the Sun?', 'Mercury'), existing),
    ).toBe(true)
  })

  it('keeps genuinely different questions', () => {
    expect(isDuplicate(mcq('2', 'Which planet is the largest?', 'Jupiter'), existing)).toBe(false)
    expect(isDuplicate(tfq('3', 'Pluto is one of the eight planets.', false), existing)).toBe(false)
  })

  it('flags near-identical true/false statements', () => {
    const tf = [tfq('1', 'Venus is the hottest planet in the solar system.', true)]
    expect(
      isDuplicate(tfq('2', 'Venus is the hottest planet in our solar system.', true), tf),
    ).toBe(true)
  })

  it('removes near-duplicate concepts from a plan', () => {
    expect(
      uniqueConcepts([
        'Mercury is the closest planet to the Sun',
        'Mercury is closest planet to the Sun',
        'Jupiter is the largest planet',
        '  ',
      ]),
    ).toEqual(['Mercury is the closest planet to the Sun', 'Jupiter is the largest planet'])
  })

  it('scores identical text as 1 and unrelated text low', () => {
    expect(similarity('Photosynthesis makes glucose', 'photosynthesis makes glucose!')).toBe(1)
    expect(
      similarity('Photosynthesis makes glucose', 'The French Revolution began in 1789'),
    ).toBeLessThan(0.2)
  })
})
