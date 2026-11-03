import type { Quiz } from './schema.ts'
import type { RecordedAnswer } from './session.ts'

/** Router state passed to /play (e.g. "Retry missed" passes a subset of question ids). */
export type PlayState = {
  quiz: Quiz
  questionIds?: string[]
}

/** Router state passed to /results when a run finishes. */
export type ResultsState = {
  quiz: Quiz
  questionIds: string[]
  answers: RecordedAnswer[]
  bestStreak: number
  /** e.g. why fewer questions were made than requested. */
  note?: string
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function readPlayState(value: unknown): PlayState | undefined {
  return isObject(value) && isObject(value.quiz) ? (value as PlayState) : undefined
}

export function readResultsState(value: unknown): ResultsState | undefined {
  return isObject(value) && isObject(value.quiz) && Array.isArray(value.answers)
    ? (value as ResultsState)
    : undefined
}
