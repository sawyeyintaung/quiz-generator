import { motion } from 'framer-motion'
import { Link } from 'react-router'
import type { GenerationJob } from '../generate/generationStore.ts'

type Props = { job: GenerationJob; onCancel: () => void }

/** Shown before the first question arrives. */
export function GeneratingCard({ job, onCancel }: Props) {
  const steps = [
    { label: 'Reading your material', done: job.status !== 'planning' },
    {
      label: job.plannedCount
        ? `Planned ${job.plannedCount} unique question${job.plannedCount === 1 ? '' : 's'}`
        : 'Planning distinct questions',
      done: job.status !== 'planning',
    },
    { label: 'Writing the first question', done: false },
  ]
  const active = steps.findIndex((s) => !s.done)

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="border-border bg-surface rounded-2xl border p-6 shadow-sm sm:p-8"
      aria-busy="true"
    >
      <h1 className="text-2xl font-bold tracking-tight">{job.title ?? 'Creating your quiz'}</h1>
      <ol className="mt-6 space-y-3" role="status" aria-live="polite">
        {steps.map((step, i) => (
          <li key={step.label} className="flex items-center gap-3">
            <span
              aria-hidden
              className={`grid size-7 place-items-center rounded-full text-sm font-bold ${
                step.done
                  ? 'bg-correct text-white'
                  : i === active
                    ? 'bg-brand/15 text-brand'
                    : 'bg-border text-muted'
              }`}
            >
              {step.done ? (
                '✓'
              ) : i === active ? (
                <motion.span
                  className="bg-brand block size-2.5 rounded-full"
                  animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
              ) : (
                i + 1
              )}
            </span>
            <span className={i === active ? 'font-medium' : step.done ? '' : 'text-muted'}>
              {step.label}
              {i === active ? '…' : ''}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-8 space-y-3" aria-hidden>
        {[0.9, 0.7, 0.8, 0.6].map((w, i) => (
          <motion.div
            key={i}
            className="bg-border h-11 rounded-xl"
            style={{ width: `${w * 100}%` }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={onCancel}
        className="text-muted hover:text-text mt-6 text-sm font-medium underline"
      >
        Cancel
      </button>
    </motion.section>
  )
}

/** Shown in place of a question while the next one is still being written. */
export function WaitingCard() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="border-border bg-surface text-muted flex items-center gap-3 rounded-2xl border p-6 [grid-area:1/1]"
      role="status"
    >
      <motion.span
        aria-hidden
        className="bg-brand block size-3 rounded-full"
        animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
        transition={{ duration: 1, repeat: Infinity }}
      />
      Writing the next question…
    </motion.div>
  )
}

type FailedProps = {
  title: string
  message: string
  /** The provider's own error text, for troubleshooting. */
  detail?: string
  /** e.g. a link to the provider's API billing page. */
  action?: { label: string; href: string }
  onRetry?: () => void
}

export function GenerationFailed({ title, message, detail, action, onRetry }: FailedProps) {
  return (
    <section className="border-border bg-surface rounded-2xl border p-6 text-center sm:p-8">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-muted mx-auto mt-2 max-w-md" role="alert">
        {message}
      </p>
      {action && (
        <a
          href={action.href}
          target="_blank"
          rel="noreferrer noopener"
          className="text-brand mt-3 inline-block font-medium underline"
        >
          {action.label}
        </a>
      )}
      {detail && (
        <details className="text-muted mx-auto mt-4 max-w-md text-left text-xs">
          <summary className="cursor-pointer text-center">Details from your provider</summary>
          <p className="bg-bg mt-2 rounded-lg p-3 font-mono break-words">{detail}</p>
        </details>
      )}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="bg-accent hover:bg-accent-strong rounded-xl px-5 py-2.5 font-semibold text-white"
          >
            Try again
          </button>
        )}
        <Link
          to="/"
          className="border-border hover:border-brand rounded-xl border-2 px-5 py-2.5 font-semibold"
        >
          Back to Create
        </Link>
        <Link
          to="/settings"
          className="border-border hover:border-brand rounded-xl border-2 px-5 py-2.5 font-semibold"
        >
          Settings
        </Link>
      </div>
    </section>
  )
}
