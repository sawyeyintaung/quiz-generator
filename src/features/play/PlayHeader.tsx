import { AnimatePresence, motion } from 'framer-motion'
import { Link } from 'react-router'
import { CloseIcon, SparkIcon } from '../../components/icons.tsx'

/** Result per question in order: true = right, false = wrong, undefined = not answered yet. */
export type QuestionResult = boolean | undefined

type Props = {
  title: string
  subtitle: string
  results: QuestionResult[]
  current: number
  score: number
  streak: number
}

/** Past this many questions, segments get too thin: show one continuous bar instead. */
const MAX_SEGMENTS = 30

export function PlayHeader({ title, subtitle, results, current, score, streak }: Props) {
  const total = results.length
  const answered = results.filter((r) => r !== undefined).length
  const right = results.filter((r) => r === true).length

  return (
    <div className="mb-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to="/"
            aria-label="Exit quiz"
            title="Exit quiz"
            className="border-border bg-surface hover:border-brand/50 grid size-10 shrink-0 place-items-center rounded-xl border transition-colors"
          >
            <CloseIcon size={18} />
          </Link>
          <div className="min-w-0">
            <h1 className="font-display truncate text-lg font-extrabold tracking-tight sm:text-xl">
              {title}
            </h1>
            <p className="text-muted truncate text-xs sm:text-sm">{subtitle}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-sm font-bold">
          <AnimatePresence>
            {streak >= 2 && (
              <motion.span
                key={streak}
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                className="bg-spark/25 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-amber-800 dark:text-amber-200"
                aria-label={`${streak} correct in a row`}
              >
                <SparkIcon size={14} className="text-amber-600 dark:text-amber-300" />
                <span className="hidden sm:inline">{streak} in a row</span>
                <span className="sm:hidden">{streak}</span>
              </motion.span>
            )}
          </AnimatePresence>
          <span className="bg-brand/10 text-brand rounded-full px-3 py-1.5">
            Score{' '}
            <motion.span
              key={score}
              initial={{ y: -6, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="inline-block tabular-nums"
            >
              {score}
            </motion.span>
          </span>
        </div>
      </div>

      <div
        role="progressbar"
        aria-label="Quiz progress"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={answered}
        aria-valuetext={`${answered} of ${total} answered, ${right} correct`}
      >
        {total <= MAX_SEGMENTS ? (
          // One segment per question: green when right, red when wrong, violet for the current one.
          <div className="flex gap-1 sm:gap-1.5">
            {results.map((r, i) => (
              <motion.span
                key={i}
                className={`h-2 flex-1 rounded-full transition-colors duration-300 ${
                  r === true
                    ? 'bg-correct'
                    : r === false
                      ? 'bg-wrong'
                      : i === current
                        ? 'bg-brand'
                        : 'bg-border'
                }`}
                animate={r !== undefined ? { scaleY: [1, 1.6, 1] } : undefined}
                transition={{ duration: 0.35 }}
              />
            ))}
          </div>
        ) : (
          <div className="bg-border h-2 overflow-hidden rounded-full">
            <motion.div
              className="bg-brand h-full rounded-full"
              initial={false}
              animate={{ width: `${total ? (answered / total) * 100 : 0}%` }}
              transition={{ type: 'spring', stiffness: 120, damping: 20 }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
