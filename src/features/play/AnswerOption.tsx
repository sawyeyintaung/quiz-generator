import { motion, type TargetAndTransition, type Variants } from 'framer-motion'
import { forwardRef } from 'react'

export type OptionStatus = 'idle' | 'picked-correct' | 'picked-wrong' | 'reveal-correct' | 'dimmed'

type Props = {
  keyHint: string
  label: string
  status: OptionStatus
  disabled: boolean
  onSelect: () => void
}

const optionVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: 'easeOut' } },
}

const statusClass: Record<OptionStatus, string> = {
  idle: 'border-border bg-surface hover:border-brand hover:bg-brand/5',
  'picked-correct': 'border-correct bg-correct/15 text-text',
  'picked-wrong': 'border-wrong bg-wrong/15 text-text',
  'reveal-correct': 'border-correct bg-correct/10 text-text',
  dimmed: 'border-border bg-surface opacity-55',
}

const badgeClass: Record<OptionStatus, string> = {
  idle: 'bg-brand/10 text-brand',
  'picked-correct': 'bg-correct text-white',
  'picked-wrong': 'bg-wrong text-white',
  'reveal-correct': 'bg-correct text-white',
  dimmed: 'bg-border text-muted',
}

// Feedback animations, triggered by changing `status`.
const feedbackAnimation: Record<OptionStatus, TargetAndTransition> = {
  idle: {},
  'picked-correct': { scale: [1, 1.04, 1], transition: { duration: 0.35 } },
  'picked-wrong': { x: [0, -10, 10, -7, 7, -3, 0], transition: { duration: 0.45 } },
  'reveal-correct': { scale: [1, 1.02, 1], transition: { duration: 0.4, delay: 0.25 } },
  dimmed: {},
}

export const AnswerOption = forwardRef<HTMLButtonElement, Props>(function AnswerOption(
  { keyHint, label, status, disabled, onSelect },
  ref,
) {
  const icon =
    status === 'picked-correct' || status === 'reveal-correct'
      ? '✓'
      : status === 'picked-wrong'
        ? '✕'
        : keyHint

  return (
    <motion.li variants={optionVariants}>
      <motion.button
        ref={ref}
        type="button"
        onClick={onSelect}
        disabled={disabled}
        aria-keyshortcuts={keyHint}
        animate={feedbackAnimation[status]}
        whileHover={disabled ? undefined : { y: -2 }}
        whileTap={disabled ? undefined : { scale: 0.98 }}
        className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left font-medium transition-colors disabled:cursor-default ${statusClass[status]}`}
      >
        <span
          aria-hidden
          className={`grid size-8 shrink-0 place-items-center rounded-lg text-sm font-bold transition-colors ${badgeClass[status]}`}
        >
          {icon}
        </span>
        <span>{label}</span>
      </motion.button>
    </motion.li>
  )
})
