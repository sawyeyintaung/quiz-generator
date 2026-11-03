import { motion } from 'framer-motion'
import { CountUp } from './CountUp.tsx'

type Props = { correct: number; total: number }

export function ScoreRing({ correct, total }: Props) {
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0
  const color = pct >= 70 ? 'var(--color-correct)' : pct >= 40 ? '#f59e0b' : 'var(--color-wrong)'

  return (
    <div
      className="relative size-44"
      role="img"
      aria-label={`You scored ${correct} out of ${total}, ${pct} percent`}
    >
      <svg viewBox="0 0 120 120" className="size-full -rotate-90">
        <circle cx="60" cy="60" r="52" fill="none" stroke="var(--color-border)" strokeWidth="10" />
        <motion.circle
          cx="60"
          cy="60"
          r="52"
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: pct / 100 }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.15 }}
        />
      </svg>
      <div aria-hidden className="absolute inset-0 grid place-content-center text-center">
        <span className="text-4xl font-bold tracking-tight">
          <CountUp to={pct} suffix="%" />
        </span>
        <span className="text-muted text-sm">
          {correct} / {total}
        </span>
      </div>
    </div>
  )
}
