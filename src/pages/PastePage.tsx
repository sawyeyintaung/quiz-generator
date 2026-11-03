import { motion } from 'framer-motion'
import { useId, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { pastePrompt, PROMPT_VERSION } from '../features/generate/prompts.ts'
import { parsePastedReply } from '../features/generate/pasteImport.ts'
import { sourceLabel } from '../features/generate/source.ts'
import type { GenerationRequest } from '../features/generate/types.ts'
import { CopyButton } from '../features/paste/CopyButton.tsx'
import type { PlayState } from '../features/quiz/navigation.ts'
import type { Quiz } from '../features/quiz/schema.ts'

export type PastePageState = { request: GenerationRequest }

type Target = 'claude-code' | 'claude' | 'chatgpt'

const PROMPT_FILE = 'quiz-prompt.txt'
const CLI_COMMAND = `claude -p "$(cat ~/Downloads/${PROMPT_FILE})"`

function readState(value: unknown): PastePageState | undefined {
  const v = value as Partial<PastePageState> | null
  return v && typeof v === 'object' && v.request && typeof v.request === 'object'
    ? (v as PastePageState)
    : undefined
}

export function PastePage() {
  const location = useLocation()
  const state = readState(location.state)
  if (!state) {
    return (
      <section className="py-12 text-center">
        <h1 className="text-2xl font-bold">Copy &amp; paste</h1>
        <p className="text-muted mt-2">Start from the Create page to choose your topic or notes.</p>
        <Link
          to="/"
          className="bg-accent hover:bg-accent-strong mt-6 inline-block rounded-xl px-5 py-2.5 font-semibold text-white"
        >
          Create a quiz
        </Link>
      </section>
    )
  }
  return <PasteFlow request={state.request} />
}

function PasteFlow({ request }: { request: GenerationRequest }) {
  const navigate = useNavigate()
  const prompt = useMemo(() => pastePrompt(request), [request])
  const [target, setTarget] = useState<Target>('claude-code')
  const [reply, setReply] = useState('')
  const [error, setError] = useState<string>()
  const previewRef = useRef<HTMLDetailsElement>(null)
  const replyId = useId()

  function downloadPrompt() {
    const url = URL.createObjectURL(new Blob([prompt], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url
    a.download = PROMPT_FILE
    a.click()
    URL.revokeObjectURL(url)
  }

  function startQuiz() {
    const result = parsePastedReply(reply, request)
    if (result.questions.length === 0) {
      setError(
        "We couldn't find any quiz questions in that reply. Make sure you copied the whole reply, including the JSON code block.",
      )
      return
    }
    const { invalid, duplicates, extra } = result.skipped
    const skippedParts = [
      duplicates && `${duplicates} duplicate${duplicates === 1 ? '' : 's'}`,
      invalid && `${invalid} unreadable question${invalid === 1 ? '' : 's'}`,
      extra && `${extra} extra question${extra === 1 ? '' : 's'}`,
    ].filter(Boolean)
    const made = result.questions.length
    const notes = [
      made < request.count &&
        `The reply had ${made} unique question${made === 1 ? '' : 's'} (you asked for ${request.count}).`,
      skippedParts.length > 0 && `Skipped ${skippedParts.join(', ')}.`,
    ].filter(Boolean)

    const quiz: Quiz = {
      id:
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}`,
      title:
        result.title ??
        (request.source.kind === 'topic' ? request.source.text.slice(0, 60) : 'My quiz'),
      source: { kind: request.source.kind, label: sourceLabel(request.source.text) },
      settings: {
        count: request.count,
        focus: request.focus,
        difficulty: request.difficulty,
        types: request.types,
      },
      provider: 'copy-paste',
      promptVersion: PROMPT_VERSION,
      questions: result.questions,
      createdAt: new Date().toISOString(),
    }
    const playState: PlayState = { quiz, note: notes.join(' ') || undefined }
    navigate('/play', { state: playState })
  }

  const step = 'border-border bg-surface rounded-2xl border p-5 shadow-sm sm:p-6'
  const stepNumber =
    'bg-brand grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold text-white'

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <h1 className="text-3xl font-bold tracking-tight">Create with your subscription</h1>
      <p className="text-muted mt-2">
        Copy the instructions into Claude Code, Claude or ChatGPT, then paste the reply back here.
        No API key needed: it uses your own plan.
      </p>

      <ol className="mt-6 space-y-4">
        <li className={step}>
          <div className="flex items-center gap-3">
            <span className={stepNumber}>1</span>
            <h2 className="font-semibold">Copy the instructions</h2>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <CopyButton
              text={prompt}
              label="Copy instructions"
              onFail={() => {
                if (previewRef.current) previewRef.current.open = true
              }}
              className="bg-accent hover:bg-accent-strong min-w-44 rounded-xl px-5 py-2.5 font-semibold text-white"
            />
            <button
              type="button"
              onClick={downloadPrompt}
              className="border-border hover:border-brand rounded-xl border-2 px-4 py-2.5 text-sm font-semibold"
            >
              Download as file
            </button>
          </div>
          <details ref={previewRef} className="mt-3">
            <summary className="text-muted cursor-pointer text-sm">Show instructions</summary>
            <pre className="bg-bg border-border mt-2 max-h-64 overflow-auto rounded-xl border p-3 text-xs whitespace-pre-wrap">
              {prompt}
            </pre>
          </details>
        </li>

        <li className={step}>
          <div className="flex items-center gap-3">
            <span className={stepNumber}>2</span>
            <h2 className="font-semibold">Paste them into your AI app</h2>
          </div>
          <div role="tablist" aria-label="AI app" className="mt-4 flex flex-wrap gap-2">
            {(
              [
                ['claude-code', 'Claude Code'],
                ['claude', 'Claude'],
                ['chatgpt', 'ChatGPT'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={target === id}
                onClick={() => setTarget(id)}
                className={`rounded-full border-2 px-4 py-1.5 text-sm font-medium ${
                  target === id ? 'border-brand bg-brand/10 text-brand' : 'border-border text-muted'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-4 text-sm leading-relaxed">
            {target === 'claude-code' && (
              <>
                <p>
                  Open Claude Code (in your terminal, the desktop app or{' '}
                  <a
                    href="https://claude.ai/code"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-brand underline"
                  >
                    claude.ai/code
                  </a>
                  ), paste the instructions and press Enter. Then copy Claude&apos;s whole reply.
                </p>
                <p className="text-muted mt-3">
                  Prefer one command? Download the file above, then run this in your terminal
                  (macOS/Linux). Add <code className="bg-bg rounded px-1">| pbcopy</code> on macOS
                  to copy the reply automatically.
                </p>
                <div className="bg-bg border-border mt-2 flex items-center gap-2 rounded-xl border p-2 pl-3">
                  <code className="min-w-0 flex-1 overflow-x-auto font-mono text-xs whitespace-nowrap">
                    {CLI_COMMAND}
                  </code>
                  <CopyButton
                    text={CLI_COMMAND}
                    label="Copy"
                    className="border-border hover:border-brand shrink-0 rounded-lg border-2 px-3 py-1 text-xs font-semibold"
                  />
                </div>
              </>
            )}
            {target === 'claude' && (
              <p>
                Open a new chat at{' '}
                <a
                  href="https://claude.ai/new"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-brand underline"
                >
                  claude.ai
                </a>
                , paste the instructions and send. Use the copy button on the code block in the
                reply.
              </p>
            )}
            {target === 'chatgpt' && (
              <p>
                Open a new chat at{' '}
                <a
                  href="https://chatgpt.com/"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-brand underline"
                >
                  chatgpt.com
                </a>
                , paste the instructions and send. Use the copy button on the code block in the
                reply.
              </p>
            )}
          </div>
        </li>

        <li className={step}>
          <div className="flex items-center gap-3">
            <span className={stepNumber}>3</span>
            <label htmlFor={replyId} className="font-semibold">
              Paste the reply here
            </label>
          </div>
          <textarea
            id={replyId}
            value={reply}
            onChange={(e) => {
              setReply(e.target.value)
              setError(undefined)
            }}
            rows={7}
            placeholder={'```json\n{"title": "...", "questions": [ ... ]}\n```'}
            className="border-border bg-bg focus:border-brand mt-4 w-full resize-y rounded-xl border-2 px-3 py-2.5 font-mono text-xs outline-none"
          />
          {error && (
            <p className="text-wrong mt-2 text-sm" role="alert">
              {error}
            </p>
          )}
          <div className="mt-4 flex justify-end">
            <motion.button
              type="button"
              onClick={startQuiz}
              disabled={!reply.trim()}
              whileHover={reply.trim() ? { scale: 1.02 } : undefined}
              whileTap={reply.trim() ? { scale: 0.98 } : undefined}
              className="bg-accent hover:bg-accent-strong rounded-xl px-6 py-3 font-semibold text-white shadow-sm disabled:opacity-50"
            >
              Start quiz →
            </motion.button>
          </div>
        </li>
      </ol>
    </motion.section>
  )
}
