import { motion } from 'framer-motion'
import { useNavigate } from 'react-router'
import { ArrowRightIcon, SparkIcon } from '../../components/icons.tsx'
import { startGeneration } from '../generate/generationStore.ts'
import { useSource, type StoredSource } from '../history/db.ts'
import { activeCredentials, useSettings } from '../settings/settingsStore.ts'
import { computeCoverage, nextBatchRequest, type Coverage } from './coverage.ts'

/** Starts the next batch from a source, in whichever mode the learner uses. */
function useNextBatch() {
  const navigate = useNavigate()
  const settings = useSettings()
  return (source: StoredSource, coverage: Coverage) => {
    const request = nextBatchRequest(source, coverage)
    if (settings.mode === 'paste') {
      navigate('/paste', { state: { request } })
      return
    }
    const credentials = activeCredentials(settings)
    if (!credentials) {
      navigate('/settings')
      return
    }
    navigate(`/play?job=${startGeneration(request, credentials)}`)
  }
}

function summary(c: Coverage): string {
  if (c.exhausted)
    return `Covered all ${c.covered} idea${c.covered === 1 ? '' : 's'} in this source`
  if (c.total === undefined) return `Covered ${c.covered} idea${c.covered === 1 ? '' : 's'} so far`
  return `Covered ${c.covered} of about ${c.total} ideas · about ${c.left} left`
}

type Props = { sourceId: string | undefined; compact?: boolean }

/**
 * How much of a source has been quizzed, with a button for the next batch (no repeats).
 * `compact` is the one-line version for History cards.
 */
export function CoveragePanel({ sourceId, compact = false }: Props) {
  const source = useSource(sourceId)
  const startNext = useNextBatch()
  if (!source) return null

  const coverage = computeCoverage(source)
  const next = nextBatchRequest(source, coverage).count
  const pct =
    coverage.total !== undefined ? Math.min(100, (coverage.covered / coverage.total) * 100) : 0
  const button = !coverage.exhausted && (
    <button
      type="button"
      onClick={() => startNext(source, coverage)}
      className={
        compact
          ? 'border-border hover:border-brand rounded-lg border-2 px-3 py-1 text-sm font-semibold'
          : 'bg-accent hover:bg-accent-strong flex h-12 items-center justify-center gap-2 rounded-2xl px-5 font-bold text-white'
      }
    >
      Next {next} question{next === 1 ? '' : 's'} (no repeats)
      {!compact && <ArrowRightIcon size={18} />}
    </button>
  )

  if (compact) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        <span className="text-muted">{summary(coverage)}</span>
        {button}
      </div>
    )
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="border-border bg-surface mt-6 rounded-3xl border p-5 sm:p-6"
      aria-labelledby="coverage-title"
    >
      <div className="flex items-start gap-3">
        <span className="bg-spark/25 grid size-9 shrink-0 place-items-center rounded-xl text-amber-700 dark:text-amber-300">
          <SparkIcon size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="coverage-title" className="font-display font-bold">
            {coverage.exhausted ? "You've covered this source" : 'Keep going with this source'}
          </h2>
          <p className="text-muted mt-0.5 text-sm">{source.label}</p>
        </div>
      </div>

      {coverage.total !== undefined && (
        <div
          className="bg-border mt-4 h-2.5 overflow-hidden rounded-full"
          role="progressbar"
          aria-label="Source covered"
          aria-valuemin={0}
          aria-valuemax={coverage.total}
          aria-valuenow={coverage.covered}
        >
          <motion.div
            className={coverage.exhausted ? 'bg-correct h-full' : 'bg-brand h-full'}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.5 }}
          />
        </div>
      )}
      <p className="mt-3 text-sm font-semibold">{summary(coverage)}</p>
      {coverage.exhausted ? (
        <p className="text-muted mt-1 text-sm">
          Every idea has been quizzed. Replay or retry your quizzes from History.
        </p>
      ) : (
        <p className="text-muted mt-1 text-xs">
          Counts are the AI&apos;s estimate
          {source.request.source.kind === 'text' || source.request.source.kind === 'file'
            ? ', checked against the length of your material'
            : ''}
          .
        </p>
      )}
      {button && <div className="mt-4">{button}</div>}
    </motion.section>
  )
}
