import { isCorrect, type AnswerValue, type Question } from './schema.ts'

export type RecordedAnswer = {
  questionId: string
  value: AnswerValue
  correct: boolean
}

/**
 * Progress through a quiz. Questions are passed in separately because a
 * generated quiz can still be growing while it is being played.
 */
export type SessionState = {
  index: number
  answers: RecordedAnswer[]
  streak: number
  bestStreak: number
}

export type SessionAction =
  { type: 'answer'; question: Question; value: AnswerValue } | { type: 'next' }

export function createSession(): SessionState {
  return { index: 0, answers: [], streak: 0, bestStreak: 0 }
}

export function answerFor(state: SessionState, question: Question | undefined) {
  return question ? state.answers.find((a) => a.questionId === question.id) : undefined
}

export function score(state: Pick<SessionState, 'answers'>): number {
  return state.answers.filter((a) => a.correct).length
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'answer': {
      // Each question can be answered once.
      if (answerFor(state, action.question)) return state
      const correct = isCorrect(action.question, action.value)
      const streak = correct ? state.streak + 1 : 0
      return {
        ...state,
        answers: [
          ...state.answers,
          { questionId: action.question.id, value: action.value, correct },
        ],
        streak,
        bestStreak: Math.max(state.bestStreak, streak),
      }
    }
    case 'next':
      // Only move on once the current question has been answered.
      return state.answers.length > state.index ? { ...state, index: state.index + 1 } : state
  }
}
