import { AnimatePresence } from 'framer-motion'
import { useReducer } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { PlayHeader } from '../features/play/PlayHeader.tsx'
import { QuestionCard } from '../features/play/QuestionCard.tsx'
import { demoQuiz } from '../features/quiz/demoQuiz.ts'
import { readPlayState, type ResultsState } from '../features/quiz/navigation.ts'
import type { Question, Quiz } from '../features/quiz/schema.ts'
import {
  createSession,
  currentAnswer,
  currentQuestion,
  score,
  sessionReducer,
} from '../features/quiz/session.ts'

export function PlayPage() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const playState = readPlayState(location.state)
  const quiz = playState?.quiz ?? (searchParams.has('demo') ? demoQuiz : undefined)

  if (!quiz) {
    return (
      <section className="py-12 text-center">
        <h1 className="text-2xl font-bold">No quiz loaded</h1>
        <p className="text-muted mt-2">Create a quiz, or try the demo to see how it works.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            to="/play?demo"
            className="bg-accent hover:bg-accent-strong rounded-xl px-5 py-2.5 font-semibold text-white"
          >
            Play the demo quiz
          </Link>
          <Link to="/" className="border-border rounded-xl border px-5 py-2.5 font-semibold">
            Create a quiz
          </Link>
        </div>
      </section>
    )
  }

  const ids = playState?.questionIds
  const questions = ids ? quiz.questions.filter((q) => ids.includes(q.id)) : quiz.questions

  // Keyed by location so "Retry" (a new navigation) always starts a fresh session.
  return <PlaySession key={location.key} quiz={quiz} questions={questions} />
}

function PlaySession({ quiz, questions }: { quiz: Quiz; questions: Question[] }) {
  const navigate = useNavigate()
  const [state, dispatch] = useReducer(sessionReducer, questions, createSession)
  const question = currentQuestion(state)
  const answer = currentAnswer(state)
  const isLast = state.index === questions.length - 1

  function handleNext() {
    if (isLast) {
      const results: ResultsState = {
        quiz,
        questionIds: questions.map((q) => q.id),
        answers: state.answers,
        bestStreak: state.bestStreak,
      }
      navigate('/results', { state: results, replace: true })
    } else {
      dispatch({ type: 'next' })
    }
  }

  if (!question) return null

  return (
    <section>
      <PlayHeader
        title={quiz.title}
        answered={state.answers.length}
        total={questions.length}
        score={score(state)}
        streak={state.streak}
      />
      <AnimatePresence mode="wait">
        <QuestionCard
          key={question.id}
          question={question}
          number={state.index + 1}
          total={questions.length}
          answer={answer}
          isLast={isLast}
          onAnswer={(value) => dispatch({ type: 'answer', value })}
          onNext={handleNext}
        />
      </AnimatePresence>
    </section>
  )
}
