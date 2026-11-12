import type { Difficulty } from '../generate/types.ts'
import type { QuestionType } from '../quiz/schema.ts'
import type { ParsedFile } from '../sources/types.ts'

export type SourceTab = 'topic' | 'text' | 'file' | 'url'

export type Draft = {
  tab: SourceTab
  topic: string
  text: string
  focus: string
  /** Titles of the focus suggestions currently picked. */
  focusPicks: string[]
  file?: ParsedFile
  /** PDF page range, 1-based inclusive; undefined = all pages. */
  pageRange?: [number, number]
  url: string
  count: number
  difficulty: Difficulty
  types: QuestionType[]
}

export const MIN_TEXT_WORDS = 30

const initialDraft: Draft = {
  tab: 'topic',
  topic: '',
  text: '',
  focus: '',
  focusPicks: [],
  url: '',
  count: 10,
  difficulty: 'medium',
  types: ['multiple_choice', 'true_false'],
}

// Keeps the Create form filled in while moving between pages (this tab only, in memory).
let draft = initialDraft

export function getDraft(): Draft {
  return draft
}

export function saveDraft(next: Draft): Draft {
  draft = next
  return draft
}

export function resetDraftForTests() {
  draft = initialDraft
}
