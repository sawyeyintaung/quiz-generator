import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { ScoreRing } from '../features/results/ScoreRing.tsx'
import { readResultsState, type PlayState } from '../features/quiz/navigation.ts'
import { answerText, correctAnswerText } from '../features/quiz/schema.ts'
import { celebrate } from '../lib/celebrate.ts'
import { originOf, saveAttempt, saveQuiz } from '../features/history/db.ts'
import { ShareDialog } from '../features/share/ShareDialog.tsx'
import { useDocumentTitle } from '../lib/useDocumentTitle.ts'

function headline(pct: number): string {
  if (pct === 100) return 'Perfect score!'
  if (pct >= 80) return 'Great job!'
  if (pct >= 50) return 'Good effort!'
  return 'Keep practicing!'
}

export function ResultsPage() {
  useDocumentTitle('Results')
  const location = useLocation()
  const navigate = useNavigate()
  const results = readResultsState(location.state)
  const celebrated = useRef(false)
  const [sharing, setSharing] = useState(false)
  const [saved, setSaved] = useState(false)

  const total = results?.questionIds.length ?? 0
  const correct = results?.answers.filter((a) => a.correct).length ?? 0
  const pct = total > 0 ? correct / total : 0

  // Save the quiz and this attempt to History (idempotent: same attempt id on reload).
  useEffect(() => {
    if (!results?.attemptId || !originOf(results.quiz)) return
    const { quiz, answers, questionIds, bestStreak, attemptId } = results
    void (async () => {
      await saveQuiz(quiz)
      await saveAttempt({
        id: attemptId,
        quizId: quiz.id,
        questionIds,
        answers,
        correct: answers.filter((a) => a.correct).length,
        total: questionIds.length,
        bestStreak,
        finishedAt: new Date().toISOString(),
      })
      setSaved(true)
    })().catch(() => undefined) // storage unavailable: results still show, just not saved
  }, [results])

  useEffect(() => {
    if (!results || celebrated.current) return
    celebrated.current = true
    // Celebrate only good runs; scale the confetti with the score.
    const timer = window.setTimeout(() => celebrate(pct >= 0.5 ? pct : 0), 700)
    return () => window.clearTimeout(timer)
  }, [results, pct])

  if (!results) {
    return (
      <section className="py-12 text-center">
        <h1 className="text-2xl font-bold">Results</h1>
        <p className="text-muted mt-2">No finished quiz yet. Play one to see your results here.</p>
        <Link
          to="/play?demo"
          className="bg-accent hover:bg-accent-strong mt-6 inline-block rounded-xl px-5 py-2.5 font-semibold text-white"
        >
          Play the demo quiz
        </Link>
      </section>
    )
  }

  const { quiz, answers, bestStreak, note } = results
  const missed = answers
    .filter((a) => !a.correct)
    .map((a) => ({ answer: a, question: quiz.questions.find((q) => q.id === a.questionId) }))
    .filter((m) => m.question !== undefined)

  function play(state: PlayState) {
    navigate('/play', { state })
  }

  return (
    <section>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="border-border bg-surface flex flex-col items-center rounded-2xl border p-6 text-center shadow-sm sm:p-8"
      >
        <p className="text-muted text-sm font-medium">{quiz.title}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Results</h1>
        {note && <p className="text-muted mt-2 max-w-md text-sm">{note}</p>}
        <div className="mt-6">
          <ScoreRing correct={correct} total={total} />
        </div>
        <motion.p
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.1, type: 'spring', stiffness: 300, damping: 18 }}
          className="mt-4 text-xl font-semibold"
        >
          {headline(Math.round(pct * 100))}
        </motion.p>

        <dl className="mt-6 grid w-full max-w-sm grid-cols-3 gap-3 text-center">
          {[
            ['Correct', correct],
            ['Missed', total - correct],
            ['Best streak', bestStreak],
          ].map(([label, value]) => (
            <div key={label} className="bg-bg rounded-xl px-2 py-3">
              <dt className="text-muted text-xs">{label}</dt>
              <dd className="mt-1 text-lg font-bold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          {missed.length > 0 && (
            <button
              type="button"
              onClick={() => play({ quiz, questionIds: missed.map((m) => m.answer.questionId) })}
              className="bg-accent hover:bg-accent-strong rounded-xl px-5 py-2.5 font-semibold text-white"
            >
              Retry missed ({missed.length})
            </button>
          )}
          <button
            type="button"
            onClick={() => play({ quiz })}
            className="border-border hover:border-brand rounded-xl border-2 px-5 py-2.5 font-semibold"
          >
            Retry all
          </button>
          <button
            type="button"
            onClick={() => setSharing(true)}
            className="border-border hover:border-brand rounded-xl border-2 px-5 py-2.5 font-semibold"
          >
            Share
          </button>
          <Link
            to="/"
            className="border-border hover:border-brand rounded-xl border-2 px-5 py-2.5 font-semibold"
          >
            New quiz
          </Link>
        </div>
        {saved && (
          <p className="text-muted mt-4 text-xs" role="status">
            Saved to{' '}
            <Link to="/history" className="text-brand underline">
              History
            </Link>{' '}
            in this browser.
          </p>
        )}
      </motion.div>
      <ShareDialog quiz={sharing ? quiz : undefined} onClose={() => setSharing(false)} />

      {missed.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-bold">Review what you missed</h2>
          <motion.ol
            className="mt-4 space-y-3"
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.08, delayChildren: 0.6 } } }}
          >
            {missed.map(({ answer, question }) =>
              question ? (
                <motion.li
                  key={question.id}
                  variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
                  className="border-border bg-surface rounded-xl border p-4"
                >
                  <p className="font-semibold">{question.prompt}</p>
                  <p className="mt-2 text-sm">
                    <span className="text-wrong font-medium">Your answer:</span>{' '}
                    {answerText(question, answer.value)}
                  </p>
                  <p className="text-sm">
                    <span className="text-correct font-medium">Correct answer:</span>{' '}
                    {correctAnswerText(question)}
                  </p>
                  <p className="text-muted mt-2 text-sm leading-relaxed">{question.explanation}</p>
                </motion.li>
              ) : null,
            )}
          </motion.ol>
        </div>
      )}
    </section>
  )
}
