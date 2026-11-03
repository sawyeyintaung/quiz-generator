import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useReducer, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import {
  GeneratingCard,
  GenerationFailed,
  WaitingCard,
} from '../features/play/GenerationStatus.tsx'
import { PlayHeader } from '../features/play/PlayHeader.tsx'
import { QuestionCard } from '../features/play/QuestionCard.tsx'
import {
  cancelGeneration,
  isFinished,
  jobToQuiz,
  retryGeneration,
  startGeneration,
  useJob,
} from '../features/generate/generationStore.ts'
import { providers, suggestedReplacement } from '../features/ai/providers.ts'
import { newId } from '../lib/id.ts'
import { useDocumentTitle } from '../lib/useDocumentTitle.ts'
import { decodeQuizFromLink, ShareError } from '../features/share/shareFormat.ts'
import { demoQuiz } from '../features/quiz/demoQuiz.ts'
import { readPlayState, type ResultsState } from '../features/quiz/navigation.ts'
import type { Question, Quiz } from '../features/quiz/schema.ts'
import { answerFor, createSession, score, sessionReducer } from '../features/quiz/session.ts'
import {
  activeCredentials,
  updateSettings,
  useSettings,
} from '../features/settings/settingsStore.ts'

export function PlayPage() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const jobId = searchParams.get('job')
  const playState = readPlayState(location.state)

  if (playState) {
    const ids = playState.questionIds
    const questions = ids
      ? playState.quiz.questions.filter((q) => ids.includes(q.id))
      : playState.quiz.questions
    // Keyed by location so "Retry" (a new navigation) always starts a fresh session.
    return (
      <PlaySession
        key={location.key}
        quiz={playState.quiz}
        questions={questions}
        complete
        note={playState.note}
      />
    )
  }
  if (jobId) return <GeneratedPlay key={jobId} jobId={jobId} />
  const shared = searchParams.get('q')
  if (shared) return <SharedPlay key={shared} param={shared} />
  if (searchParams.has('demo')) {
    return (
      <PlaySession key={location.key} quiz={demoQuiz} questions={demoQuiz.questions} complete />
    )
  }

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

function SharedPlay({ param }: { param: string }) {
  const result = useMemo(() => {
    try {
      return { quiz: decodeQuizFromLink(param) }
    } catch (error) {
      return {
        error: error instanceof ShareError ? error.message : 'This quiz link could not be opened.',
      }
    }
  }, [param])

  if (!result.quiz) {
    return <GenerationFailed title="Couldn't open this quiz" message={result.error ?? ''} />
  }
  return (
    <PlaySession
      quiz={result.quiz}
      questions={result.quiz.questions}
      complete
      note="Shared quiz: it runs entirely in your browser."
    />
  )
}

function GeneratedPlay({ jobId }: { jobId: string }) {
  const job = useJob(jobId)
  const settings = useSettings()
  const navigate = useNavigate()

  if (!job) {
    return (
      <GenerationFailed
        title="Quiz not found"
        message="This quiz was being created in a tab that has since been closed or reloaded. Please create it again."
      />
    )
  }

  // The provider may say a model is retired and name its replacement: offer to switch.
  const replacement =
    job.error?.kind === 'model' ? suggestedReplacement(job.error.detail) : undefined
  const switchModel = replacement && replacement !== job.model ? replacement : undefined

  const retry = () => {
    const apiKey = settings.keys[job.provider] ?? activeCredentials(settings)?.apiKey
    if (!apiKey) {
      navigate('/settings')
      return
    }
    let id: string | undefined
    if (switchModel) {
      updateSettings((s) => ({ models: { ...s.models, [job.provider]: switchModel } }))
      id = startGeneration(job.request, { provider: job.provider, apiKey, model: switchModel })
    } else {
      id = retryGeneration(job.id, apiKey)
    }
    if (id) navigate(`/play?job=${id}`, { replace: true })
  }

  if (job.questions.length === 0) {
    if (job.status === 'error') {
      return (
        <GenerationFailed
          title="Couldn't create your quiz"
          message={job.error?.message ?? ''}
          detail={job.error?.detail}
          action={
            job.error?.kind === 'quota'
              ? {
                  label: `Open ${providers[job.provider].company} API billing`,
                  href: providers[job.provider].billingUrl,
                }
              : undefined
          }
          onRetry={retry}
          retryLabel={switchModel ? `Switch to ${switchModel} and try again` : undefined}
        />
      )
    }
    if (job.status === 'cancelled') {
      return <GenerationFailed title="Cancelled" message="No questions were created." />
    }
    return <GeneratingCard job={job} onCancel={() => cancelGeneration(job.id)} />
  }

  const complete = isFinished(job)
  return (
    <PlaySession
      quiz={jobToQuiz(job)}
      questions={job.questions}
      complete={complete}
      total={complete ? job.questions.length : (job.plannedCount ?? job.questions.length)}
      note={job.note ?? (job.status === 'cancelled' ? 'Generation was cancelled.' : undefined)}
    />
  )
}

type SessionProps = {
  quiz: Quiz
  questions: Question[]
  /** False while more questions may still arrive. */
  complete: boolean
  total?: number
  note?: string
}

const difficultyLabel = { easy: 'Easy', medium: 'Medium', hard: 'Hard' } as const

function PlaySession({ quiz, questions, complete, total = questions.length, note }: SessionProps) {
  const navigate = useNavigate()
  useDocumentTitle(quiz.title)
  const [state, dispatch] = useReducer(sessionReducer, undefined, createSession)
  // One id per run, so saving the attempt is idempotent (reloads, double effects).
  const [attemptId] = useState(newId)
  const question = questions[state.index]
  const answer = answerFor(state, question)
  const isLast = complete && state.index === questions.length - 1
  const outOfQuestions = complete && state.index >= questions.length

  useEffect(() => {
    if (!outOfQuestions) return
    // Generation ended while the player was waiting for another question.
    const results: ResultsState = {
      quiz: { ...quiz, questions },
      questionIds: questions.map((q) => q.id),
      answers: state.answers,
      bestStreak: state.bestStreak,
      note,
      attemptId,
    }
    navigate('/results', { state: results, replace: true })
  }, [outOfQuestions, quiz, questions, state.answers, state.bestStreak, note, attemptId, navigate])

  return (
    <section>
      <PlayHeader
        title={quiz.title}
        subtitle={`${
          question
            ? `Question ${state.index + 1} of ${Math.max(total, questions.length)}`
            : 'Writing the next question'
        } · ${difficultyLabel[quiz.settings.difficulty]}`}
        results={Array.from({ length: Math.max(total, questions.length) }, (_, i) => {
          const q = questions[i]
          return q ? state.answers.find((a) => a.questionId === q.id)?.correct : undefined
        })}
        current={state.index}
        score={score(state)}
        streak={state.streak}
      />
      <AnimatePresence>
        {note && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="bg-brand/10 text-text mb-4 overflow-hidden rounded-xl px-4 py-3 text-sm"
            role="status"
          >
            {note}
          </motion.p>
        )}
      </AnimatePresence>
      {/* Both cards share one grid cell, so the next card slides in while the old one
          slides out and can take key presses right away (no injected styles: CSP-safe). */}
      <div className="grid">
        <AnimatePresence>
          {question ? (
            <QuestionCard
              key={question.id}
              question={question}
              number={state.index + 1}
              total={Math.max(total, questions.length)}
              answer={answer}
              isLast={isLast}
              onAnswer={(value) => dispatch({ type: 'answer', question, value })}
              onNext={() => dispatch({ type: 'next' })}
            />
          ) : (
            !complete && <WaitingCard key="waiting" />
          )}
        </AnimatePresence>
      </div>
    </section>
  )
}
