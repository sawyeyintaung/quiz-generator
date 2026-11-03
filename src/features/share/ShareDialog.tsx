import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useId, useMemo, useRef } from 'react'
import { CopyButton } from '../paste/CopyButton.tsx'
import type { Quiz } from '../quiz/schema.ts'
import { downloadJson, quizFileName, shareLink, toSharedQuiz } from './shareFormat.ts'

type Props = { quiz: Quiz | undefined; onClose: () => void }

/** Share a quiz as a link (when short enough) or as a file. */
export function ShareDialog({ quiz, onClose }: Props) {
  return (
    <AnimatePresence>
      {quiz && <DialogBody key={quiz.id} quiz={quiz} onClose={onClose} />}
    </AnimatePresence>
  )
}

function DialogBody({ quiz, onClose }: { quiz: Quiz; onClose: () => void }) {
  const link = useMemo(() => shareLink(quiz), [quiz])
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <motion.div
      className="fixed inset-0 z-[200] grid place-items-center bg-black/40 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="border-border bg-surface w-full max-w-lg rounded-2xl border p-6 shadow-xl"
        initial={{ scale: 0.95, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 12 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-xl font-bold">
              Share “{quiz.title}”
            </h2>
            <p className="text-muted mt-1 text-sm">
              Friends can play it right away, without an API key or the AI.
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-muted hover:text-text rounded-lg px-2 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="mt-5">
          <h3 className="text-sm font-semibold">Link</h3>
          {link ? (
            <div className="bg-bg border-border mt-2 flex items-center gap-2 rounded-xl border p-2 pl-3">
              <input
                readOnly
                value={link}
                aria-label="Share link"
                onFocus={(e) => e.target.select()}
                className="min-w-0 flex-1 truncate bg-transparent font-mono text-xs outline-none"
              />
              <CopyButton
                text={link}
                label="Copy link"
                className="bg-accent hover:bg-accent-strong shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold text-white"
              />
            </div>
          ) : (
            <p className="text-muted mt-2 text-sm">
              This quiz is too long for a link. Share it as a file instead.
            </p>
          )}
        </div>

        <div className="mt-5">
          <h3 className="text-sm font-semibold">File</h3>
          <button
            type="button"
            onClick={() => downloadJson(quizFileName(quiz), toSharedQuiz(quiz))}
            className="border-border hover:border-brand mt-2 rounded-xl border-2 px-4 py-2 text-sm font-semibold"
          >
            Download {quizFileName(quiz)}
          </button>
          <p className="text-muted mt-1 text-xs">
            Open it later with “Import” on the History page.
          </p>
        </div>

        <p className="text-muted mt-5 border-t border-dashed border-current/20 pt-4 text-xs">
          The link and file contain the questions and answers, so a curious friend could peek. Your
          API key and original notes are never included.
        </p>
      </motion.div>
    </motion.div>
  )
}
