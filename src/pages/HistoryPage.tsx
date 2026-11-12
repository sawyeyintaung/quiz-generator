import { AnimatePresence, motion } from 'framer-motion'
import { useRef, useState, type DragEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  deleteQuiz,
  exportHistory,
  importHistory,
  isHistoryBackup,
  saveQuiz,
  useHistory,
  type HistoryEntry,
  type QuizOrigin,
} from '../features/history/db.ts'
import type { PlayState } from '../features/quiz/navigation.ts'
import type { Quiz } from '../features/quiz/schema.ts'
import { ShareDialog } from '../features/share/ShareDialog.tsx'
import { CoveragePanel } from '../features/coverage/CoveragePanel.tsx'
import {
  downloadJson,
  MAX_SHARED_BYTES,
  parseSharedQuiz,
  ShareError,
} from '../features/share/shareFormat.ts'
import { useDocumentTitle } from '../lib/useDocumentTitle.ts'

type Status = { kind: 'ok' | 'error'; message: string; quiz?: Quiz } | undefined

const originLabel: Record<QuizOrigin, string | undefined> = {
  generated: undefined,
  pasted: 'Copy & paste',
  imported: 'Imported',
}

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

export function HistoryPage() {
  useDocumentTitle('History')
  const history = useHistory()
  const navigate = useNavigate()
  const fileInput = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<Status>()
  const [dragging, setDragging] = useState(false)
  const [sharing, setSharing] = useState<Quiz>()

  function play(state: PlayState) {
    navigate('/play', { state })
  }

  async function importFile(file: File) {
    try {
      if (file.size > MAX_SHARED_BYTES * 20) throw new ShareError('This file is too large.')
      const value: unknown = JSON.parse(await file.text())
      if (isHistoryBackup(value)) {
        const count = await importHistory(value)
        setStatus({
          kind: 'ok',
          message: `Restored ${count} quiz${count === 1 ? '' : 'zes'} from backup.`,
        })
        return
      }
      if (file.size > MAX_SHARED_BYTES) throw new ShareError('This quiz file is too large.')
      const quiz = parseSharedQuiz(value)
      await saveQuiz(quiz, 'imported')
      setStatus({ kind: 'ok', message: `Imported “${quiz.title}”.`, quiz })
    } catch (error) {
      const message =
        error instanceof ShareError
          ? error.message
          : error instanceof SyntaxError
            ? "This file isn't valid JSON."
            : error instanceof Error
              ? error.message
              : 'Could not import this file.'
      setStatus({ kind: 'error', message })
    }
  }

  async function exportAll() {
    const backup = await exportHistory()
    const day = new Date().toISOString().slice(0, 10)
    downloadJson(`quiz-generator-history-${day}.json`, backup)
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) void importFile(file)
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false)
      }}
      onDrop={onDrop}
      className="relative"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">History</h1>
          <p className="text-muted mt-2">Your quizzes and scores, saved in this browser.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="bg-accent hover:bg-accent-strong rounded-xl px-4 py-2 text-sm font-semibold text-white"
          >
            Import
          </button>
          <button
            type="button"
            onClick={() => void exportAll()}
            disabled={!Array.isArray(history) || history.length === 0}
            className="border-border hover:border-brand rounded-xl border-2 px-4 py-2 text-sm font-semibold disabled:opacity-40"
          >
            Export all
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            aria-label="Import a quiz or history file"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void importFile(file)
              e.target.value = ''
            }}
          />
        </div>
      </div>

      <AnimatePresence>
        {status && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div
              role={status.kind === 'error' ? 'alert' : 'status'}
              className={`mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm ${
                status.kind === 'error' ? 'bg-wrong/10 text-wrong' : 'bg-correct/10'
              }`}
            >
              <span>{status.message}</span>
              {status.quiz && (
                <button
                  type="button"
                  onClick={() => play({ quiz: status.quiz! })}
                  className="text-brand font-semibold underline"
                >
                  Play now
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {history === undefined ? null : history === 'unavailable' ? (
        <div
          className="border-border text-muted mt-8 rounded-2xl border border-dashed p-8 text-center"
          role="alert"
        >
          <p className="text-text font-semibold">
            History isn&apos;t available in this browser window
          </p>
          <p className="mt-1 text-sm">
            Your browser is blocking storage for this site (this often happens in private windows).
            You can still create, play and share quizzes; they just won&apos;t be saved here.
          </p>
        </div>
      ) : history.length === 0 ? (
        <div className="border-border text-muted mt-8 rounded-2xl border border-dashed p-8 text-center">
          <p className="text-text font-semibold">No quizzes yet</p>
          <p className="mt-1 text-sm">
            Quizzes you create, paste or import appear here. You can also drop a{' '}
            <code>.quiz.json</code> file on this page.
          </p>
          <Link
            to="/"
            className="bg-accent hover:bg-accent-strong mt-5 inline-block rounded-xl px-5 py-2.5 font-semibold text-white"
          >
            Create a quiz
          </Link>
        </div>
      ) : (
        <motion.ul layout className="mt-6 space-y-3">
          <AnimatePresence initial={false}>
            {history.map((entry) => (
              <HistoryCard
                key={entry.quiz.id}
                entry={entry}
                onPlay={play}
                onShare={() => setSharing(entry.quiz)}
              />
            ))}
          </AnimatePresence>
        </motion.ul>
      )}

      <p className="text-muted mt-8 text-xs">
        History is stored only in this browser on this device. Clearing site data removes it, and
        Safari may clear it after 7 days without a visit. Use Export all to keep a backup.
      </p>

      <AnimatePresence>
        {dragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="border-brand bg-brand/10 pointer-events-none absolute inset-0 grid place-items-center rounded-2xl border-2 border-dashed"
          >
            <p className="text-brand font-semibold">Drop a quiz or backup file to import</p>
          </motion.div>
        )}
      </AnimatePresence>

      <ShareDialog quiz={sharing} onClose={() => setSharing(undefined)} />
    </motion.section>
  )
}

function HistoryCard({
  entry,
  onPlay,
  onShare,
}: {
  entry: HistoryEntry
  onPlay: (state: PlayState) => void
  onShare: () => void
}) {
  const { quiz, best, last, attempts } = entry
  const [confirming, setConfirming] = useState(false)
  const missed = last?.answers.filter((a) => !a.correct).map((a) => a.questionId) ?? []
  const label = originLabel[quiz.origin]
  const pct = (a: { correct: number; total: number }) =>
    a.total ? Math.round((a.correct / a.total) * 100) : 0

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -40, height: 0, marginTop: 0 }}
      className="border-border bg-surface overflow-hidden rounded-2xl border p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold">
            {quiz.title}
            {label && (
              <span className="bg-brand/10 text-brand ml-2 rounded-full px-2 py-0.5 align-middle text-xs font-medium">
                {label}
              </span>
            )}
          </h2>
          <p className="text-muted mt-0.5 text-sm">
            {quiz.questions.length} question{quiz.questions.length === 1 ? '' : 's'} ·{' '}
            {quiz.settings.difficulty[0].toUpperCase() + quiz.settings.difficulty.slice(1)} ·{' '}
            {dateFormat.format(new Date(quiz.savedAt))}
          </p>
          {quiz.settings.focus && (
            <p className="text-muted truncate text-xs">Focus: {quiz.settings.focus}</p>
          )}
        </div>
        <div className="text-right text-sm">
          {best ? (
            <>
              <p className="font-semibold tabular-nums">
                Best {best.correct}/{best.total} ({pct(best)}%)
              </p>
              <p className="text-muted text-xs">
                {attempts.length} attempt{attempts.length === 1 ? '' : 's'}
                {last && ` · last ${last.correct}/${last.total}`}
              </p>
            </>
          ) : (
            <p className="text-muted text-xs">Not played yet</p>
          )}
        </div>
      </div>

      <CoveragePanel sourceId={quiz.sourceId} compact />

      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <button
          type="button"
          onClick={() => onPlay({ quiz })}
          className="bg-accent hover:bg-accent-strong rounded-lg px-3 py-1.5 font-semibold text-white"
        >
          {attempts.length ? 'Play again' : 'Play'}
        </button>
        {missed.length > 0 && (
          <button
            type="button"
            onClick={() => onPlay({ quiz, questionIds: missed })}
            className="border-border hover:border-brand rounded-lg border-2 px-3 py-1 font-semibold"
          >
            Retry missed ({missed.length})
          </button>
        )}
        <button
          type="button"
          onClick={onShare}
          className="border-border hover:border-brand rounded-lg border-2 px-3 py-1 font-semibold"
        >
          Share
        </button>
        {confirming ? (
          <span className="ml-auto flex items-center gap-2">
            <span className="text-muted">Delete this quiz and its scores?</span>
            <button
              type="button"
              onClick={() => void deleteQuiz(quiz.id)}
              className="bg-wrong rounded-lg px-3 py-1.5 font-semibold text-white"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="text-muted hover:text-text px-2 font-medium"
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="text-muted hover:text-wrong ml-auto px-2 font-medium"
          >
            Delete
          </button>
        )}
      </div>
    </motion.li>
  )
}
