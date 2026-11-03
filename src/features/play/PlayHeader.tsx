import { AnimatePresence, motion } from 'framer-motion'

type Props = {
  title: string
  answered: number
  total: number
  score: number
  streak: number
}

export function PlayHeader({ title, answered, total, score, streak }: Props) {
  const progress = total > 0 ? answered / total : 0

  return (
    <div className="mb-6">
      <div className="flex items-end justify-between gap-4">
        <h1 className="truncate text-lg font-bold tracking-tight sm:text-xl">{title}</h1>
        <div className="flex shrink-0 items-center gap-2 text-sm font-semibold">
          <AnimatePresence>
            {streak >= 2 && (
              <motion.span
                key={streak}
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                className="rounded-full bg-amber-400/20 px-2.5 py-1 text-amber-600 dark:text-amber-300"
                aria-label={`${streak} correct in a row`}
              >
                🔥 {streak}
              </motion.span>
            )}
          </AnimatePresence>
          <span className="bg-brand/10 text-brand rounded-full px-3 py-1">
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
        className="bg-border mt-3 h-2.5 overflow-hidden rounded-full"
        role="progressbar"
        aria-label="Quiz progress"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={answered}
      >
        <motion.div
          className="from-brand h-full rounded-full bg-gradient-to-r to-fuchsia-500"
          initial={false}
          animate={{ width: `${progress * 100}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>
    </div>
  )
}
