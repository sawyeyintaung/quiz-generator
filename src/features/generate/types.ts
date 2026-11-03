import type { QuestionType } from '../quiz/schema.ts'

export type Difficulty = 'easy' | 'medium' | 'hard'

export type SourceInput =
  | { kind: 'topic'; text: string }
  | { kind: 'text'; text: string; label?: string }
  /** Text extracted in the browser from an uploaded file (label: file name and pages). */
  | { kind: 'file'; text: string; label: string }
  /** A web page, fetched by the AI provider (API mode) or the learner's AI app (paste mode). */
  | { kind: 'url'; url: string }

export type GenerationRequest = {
  source: SourceInput
  focus?: string
  count: number
  difficulty: Difficulty
  types: QuestionType[]
}

export const questionCounts = [5, 10, 15, 20] as const
export const difficulties: { id: Difficulty; label: string; hint: string }[] = [
  { id: 'easy', label: 'Easy', hint: 'Key facts and definitions' },
  { id: 'medium', label: 'Medium', hint: 'Understanding and applying ideas' },
  { id: 'hard', label: 'Hard', hint: 'Analysis, edge cases, close choices' },
]
