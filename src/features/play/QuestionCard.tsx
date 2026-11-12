import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { ArrowRightIcon, CheckIcon, CloseIcon } from '../../components/icons.tsx'
import { burstFrom } from '../../lib/celebrate.ts'
import { correctAnswerText, type AnswerValue, type Question } from '../quiz/schema.ts'
import type { RecordedAnswer } from '../quiz/session.ts'
import { AnswerOption, type OptionStatus } from './AnswerOption.tsx'

type Choice = { value: AnswerValue; label: string; keyHint: string; keys: string[] }

function choicesFor(question: Question): Choice[] {
  if (question.type === 'true_false') {
    return [
      { value: true, label: 'True', keyHint: 'T', keys: ['t', '1'] },
      { value: false, label: 'False', keyHint: 'F', keys: ['f', '2'] },
    ]
  }
  return question.options.map((label, i) => ({
    value: i,
    label,
    keyHint: String(i + 1),
    keys: [String(i + 1), 'abcd'[i]],
  }))
}

function statusFor(choice: Choice, question: Question, answer?: RecordedAnswer): OptionStatus {
  if (!answer) return 'idle'
  const isRight =
    question.type === 'multiple_choice'
      ? choice.value === question.correctIndex
      : choice.value === question.answer
  if (choice.value === answer.value) return answer.correct ? 'picked-correct' : 'picked-wrong'
  return isRight ? 'reveal-correct' : 'dimmed'
}

type Props = {
  question: Question
  number: number
  total: number
  answer?: RecordedAnswer
  isLast: boolean
  onAnswer: (value: AnswerValue) => void
  onNext: () => void
}

export function QuestionCard({ question, number, total, answer, isLast, onAnswer, onNext }: Props) {
  const choices = choicesFor(question)
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([])
  const nextRef = useRef<HTMLButtonElement>(null)

  function select(index: number) {
    if (answer) return
    const choice = choices[index]
    const correct =
      question.type === 'multiple_choice'
        ? choice.value === question.correctIndex
        : choice.value === question.answer
    if (correct) burstFrom(optionRefs.current[index])
    onAnswer(choice.value)
  }

  // Keyboard shortcuts: 1–4 / A–D for multiple choice, T / F for true/false.
  useEffect(() => {
    if (answer) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return
      const target = e.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
      const index = choices.findIndex((c) => c.keys.includes(e.key.toLowerCase()))
      if (index >= 0) {
        e.preventDefault()
        select(index)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  // Move focus to "Next" once answered, so Enter/Space continues.
  useEffect(() => {
    if (answer) nextRef.current?.focus({ preventScroll: true })
  }, [answer])

  return (
    <motion.article
      initial={{ opacity: 0, x: 48 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -48 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className="border-border bg-surface rounded-3xl border p-5 shadow-[0_1px_2px_rgb(23_23_42/0.04),0_12px_32px_rgb(23_23_42/0.06)] [grid-area:1/1] sm:p-9"
      aria-labelledby={`q-${question.id}`}
    >
      <p className="text-muted text-xs font-bold tracking-widest uppercase">
        <span className="sr-only">
          Question {number} of {total},{' '}
        </span>
        {question.type === 'true_false' ? 'True or false' : 'Multiple choice'}
      </p>
      <h2
        id={`q-${question.id}`}
        className="font-display mt-3 text-2xl leading-snug font-extrabold tracking-tight sm:text-3xl"
      >
        {question.prompt}
      </h2>

      <motion.ul
        className="mt-6 grid gap-3 sm:grid-cols-2"
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } } }}
      >
        {choices.map((choice, i) => (
          <AnswerOption
            key={String(choice.value)}
            ref={(el) => {
              optionRefs.current[i] = el
            }}
            keyHint={choice.keyHint}
            label={choice.label}
            status={statusFor(choice, question, answer)}
            disabled={Boolean(answer)}
            onSelect={() => select(i)}
          />
        ))}
      </motion.ul>

      <div role="status" aria-live="polite">
        <AnimatePresence initial={false}>
          {answer && (
            <motion.div
              key="feedback"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <div
                className={`mt-6 flex gap-3.5 rounded-2xl p-4 sm:p-5 ${
                  answer.correct ? 'bg-correct/10' : 'bg-wrong/10'
                }`}
              >
                <span
                  aria-hidden
                  className={`grid size-9 shrink-0 place-items-center rounded-full text-white ${
                    answer.correct ? 'bg-correct' : 'bg-wrong'
                  }`}
                >
                  {answer.correct ? <CheckIcon size={18} /> : <CloseIcon size={18} />}
                </span>
                <div>
                  <p className={`font-extrabold ${answer.correct ? 'text-correct' : 'text-wrong'}`}>
                    {answer.correct
                      ? 'Correct!'
                      : `Not quite. The answer is: ${correctAnswerText(question)}`}
                  </p>
                  <p className="text-text mt-1 text-sm leading-relaxed sm:text-base">
                    {question.explanation}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-6 flex min-h-13 items-center justify-between gap-3">
        <p className="text-muted hidden text-sm sm:block">
          {answer ? (
            <>
              Press{' '}
              <kbd className="border-border bg-bg rounded-md border px-1.5 py-0.5 font-sans font-bold">
                Enter
              </kbd>{' '}
              to continue
            </>
          ) : question.type === 'true_false' ? (
            <>
              Keys{' '}
              <kbd className="border-border bg-bg rounded-md border px-1.5 py-0.5 font-sans font-bold">
                T
              </kbd>{' '}
              /{' '}
              <kbd className="border-border bg-bg rounded-md border px-1.5 py-0.5 font-sans font-bold">
                F
              </kbd>
            </>
          ) : (
            <>
              Keys{' '}
              <kbd className="border-border bg-bg rounded-md border px-1.5 py-0.5 font-sans font-bold">
                1
              </kbd>
              –
              <kbd className="border-border bg-bg rounded-md border px-1.5 py-0.5 font-sans font-bold">
                4
              </kbd>
            </>
          )}
        </p>
        <AnimatePresence>
          {answer && (
            <motion.button
              ref={nextRef}
              type="button"
              onClick={onNext}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="bg-accent hover:bg-accent-strong ml-auto flex h-13 w-full items-center justify-center gap-2 rounded-2xl px-6 font-bold text-white sm:w-auto"
            >
              {isLast ? 'See results' : 'Next question'} <ArrowRightIcon size={18} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </motion.article>
  )
}
