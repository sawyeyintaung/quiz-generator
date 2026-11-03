import { beforeEach, describe, expect, it } from 'vitest'
import { fakeClient } from '../../test/fakeClient.ts'
import type { ParsedFile } from '../sources/types.ts'
import {
  aiSuggestions,
  canSuggest,
  clearSuggestionCacheForTests,
  condensedView,
  structuralSuggestions,
} from './suggest.ts'

const words = (n: number, w = 'word') => Array(n).fill(w).join(' ')

beforeEach(() => clearSuggestionCacheForTests())

describe('focus suggestions', () => {
  it('skips sources that are too small to split', () => {
    expect(canSuggest({ kind: 'text', text: words(200) })).toBe(false)
    expect(canSuggest({ kind: 'text', text: words(400) })).toBe(true)
    expect(canSuggest({ kind: 'topic', topic: 'AI' })).toBe(false)
    expect(canSuggest({ kind: 'topic', topic: 'World War II' })).toBe(true)
  })

  it('uses Markdown headings for free, with question estimates', () => {
    const text = `# Causes\n${words(210)}\n# Battles\n${words(350)}\n# Tiny\nfew words`
    expect(structuralSuggestions({ kind: 'text', text })).toEqual([
      { id: 'h0', title: 'Causes', estimatedQuestions: 3 },
      { id: 'h1', title: 'Battles', estimatedQuestions: 5 },
    ])
  })

  it('turns PDF bookmarks into page ranges', () => {
    const file: ParsedFile = {
      name: 'book.pdf',
      kind: 'pdf',
      pages: Array.from({ length: 10 }, () => words(100)),
      text: words(1000),
      sections: [
        { title: 'Chapter 1', page: 1 },
        { title: 'Chapter 2', page: 4 },
        { title: 'Chapter 3', page: 8 },
      ],
    }
    expect(
      structuralSuggestions({ kind: 'file', file }).map((s) => [s.title, s.pageRange]),
    ).toEqual([
      ['Chapter 1', [1, 3]],
      ['Chapter 2', [4, 7]],
      ['Chapter 3', [8, 10]],
    ])
  })

  it('condenses long sources', () => {
    expect(condensedView({ kind: 'text', text: 'x'.repeat(50_000) }).length).toBeLessThan(16_500)
  })

  it('asks the AI once per source and drops invalid page ranges', async () => {
    const reply = {
      suggestions: [
        {
          title: 'Light reactions',
          description: 'd',
          fromPage: 2,
          toPage: 3,
          estimatedQuestions: 6,
        },
        {
          title: 'Calvin cycle',
          description: 'd',
          fromPage: 9,
          toPage: 99,
          estimatedQuestions: 99,
        },
      ],
    }
    const { client, calls } = fakeClient({ plan: reply, streams: [] })
    const file: ParsedFile = {
      name: 'p.pdf',
      kind: 'pdf',
      pages: Array(10).fill(words(60)),
      text: words(600),
      sections: [],
    }
    const first = await aiSuggestions(client, { kind: 'file', file })
    expect(first.map((s) => [s.title, s.pageRange, s.estimatedQuestions])).toEqual([
      ['Light reactions', [2, 3], 6],
      ['Calvin cycle', undefined, 30],
    ])
    expect(calls.json[0].prompt).toContain('[Page 1]')
    await aiSuggestions(client, { kind: 'file', file })
    expect(calls.json).toHaveLength(1) // cached
  })
})
