import type { Difficulty } from '../generate/types.ts'
import type { QuestionType } from '../quiz/schema.ts'

export type SourceTab = 'topic' | 'text' | 'file' | 'url'

export type Draft = {
  tab: SourceTab
  topic: string
  text: string
  focus: string
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
