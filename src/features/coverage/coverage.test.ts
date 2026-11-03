import { describe, expect, it } from 'vitest'
import type { StoredSource } from '../history/db.ts'
import { computeCoverage, nextBatchRequest } from './coverage.ts'

const words = (n: number) => Array(n).fill('word').join(' ')

function source(patch: Partial<StoredSource> = {}): StoredSource {
  return {
    id: 's1',
    request: {
      source: { kind: 'topic', text: 'Volcanoes' },
      count: 10,
      difficulty: 'medium',
      types: ['multiple_choice'],
    },
    label: 'Volcanoes',
    covered: ['a', 'b', 'c'],
    prompts: ['Q1?', 'Q2?', 'Q3?'],
    exhausted: false,
    createdAt: '',
    updatedAt: '',
    ...patch,
  }
}

describe('computeCoverage', () => {
  it("uses the AI's estimate for topics", () => {
    expect(computeCoverage(source({ totalIdeas: 40 }))).toEqual({
      covered: 3,
      total: 40,
      left: 37,
      exhausted: false,
    })
  })

  it('shows only what was covered when nobody estimated a total', () => {
    expect(computeCoverage(source())).toMatchObject({
      covered: 3,
      total: undefined,
      left: undefined,
    })
  })

  it("uses the app's own estimate for notes, and the smaller one when they disagree a lot", () => {
    const notes = (totalIdeas?: number) =>
      source({
        totalIdeas,
        request: { ...source().request, source: { kind: 'text', text: words(1400) } }, // ~20
      })
    expect(computeCoverage(notes()).total).toBe(20)
    expect(computeCoverage(notes(30)).total).toBe(30) // close enough: trust the AI
    expect(computeCoverage(notes(200)).total).toBe(20) // 10x apart: the cautious number
  })

  it('is exhausted when the AI says so or nothing is left', () => {
    expect(computeCoverage(source({ totalIdeas: 40, exhausted: true }))).toMatchObject({
      left: 0,
      exhausted: true,
    })
    expect(computeCoverage(source({ totalIdeas: 2 }))).toMatchObject({
      total: 3, // never less than what was already covered
      left: 0,
      exhausted: true,
    })
  })
})

describe('nextBatchRequest', () => {
  it('keeps the settings, skips what was covered, and never asks for more than is left', () => {
    const s = source({ totalIdeas: 7 })
    const next = nextBatchRequest(s, computeCoverage(s))
    expect(next).toMatchObject({
      count: 4,
      difficulty: 'medium',
      sourceId: 's1',
      avoid: { concepts: ['a', 'b', 'c'], prompts: ['Q1?', 'Q2?', 'Q3?'] },
    })
  })
})
