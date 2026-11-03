import { isCorrect, type AnswerValue, type Question } from './schema.ts'

export type RecordedAnswer = {
  questionId: string
  value: AnswerValue
  correct: boolean
}

export type SessionState = {
  questions: Question[]
  index: number
  answers: RecordedAnswer[]
  streak: number
  bestStreak: number
  finished: boolean
}

export type SessionAction = { type: 'answer'; value: AnswerValue } | { type: 'next' }

export function createSession(questions: Question[]): SessionState {
  return { questions, index: 0, answers: [], streak: 0, bestStreak: 0, finished: false }
}

export function currentQuestion(state: SessionState): Question | undefined {
  return state.questions[state.index]
}

/** The answer given to the current question, if it has been answered. */
export function currentAnswer(state: SessionState): RecordedAnswer | undefined {
  const question = currentQuestion(state)
  return question ? state.answers.find((a) => a.questionId === question.id) : undefined
}

export function score(state: Pick<SessionState, 'answers'>): number {
  return state.answers.filter((a) => a.correct).length
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'answer': {
      const question = currentQuestion(state)
      // Ignore answers once finished or if this question was already answered.
      if (!question || state.finished || currentAnswer(state)) return state
      const correct = isCorrect(question, action.value)
      const streak = correct ? state.streak + 1 : 0
      return {
        ...state,
        answers: [...state.answers, { questionId: question.id, value: action.value, correct }],
        streak,
        bestStreak: Math.max(state.bestStreak, streak),
      }
    }
    case 'next': {
      if (!currentAnswer(state)) return state
      const isLast = state.index >= state.questions.length - 1
      return isLast ? { ...state, finished: true } : { ...state, index: state.index + 1 }
    }
  }
}
