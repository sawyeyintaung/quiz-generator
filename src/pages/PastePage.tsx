import { motion } from 'framer-motion'
import { useId, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { pastePrompt, PROMPT_VERSION } from '../features/generate/prompts.ts'
import { parsePastedReply } from '../features/generate/pasteImport.ts'
import { requestLabel } from '../features/generate/source.ts'
import type { GenerationRequest } from '../features/generate/types.ts'
import { CopyButton } from '../features/paste/CopyButton.tsx'
import { recordCoverage, saveQuiz } from '../features/history/db.ts'
import { newId } from '../lib/id.ts'
import type { PlayState } from '../features/quiz/navigation.ts'
import type { Quiz } from '../features/quiz/schema.ts'
import { useDocumentTitle } from '../lib/useDocumentTitle.ts'

export type PastePageState = { request: GenerationRequest }

/** Chat apps the learner can paste into. Claude is the default. */
const aiApps = [
  { id: 'claude', name: 'Claude', host: 'claude.ai', url: 'https://claude.ai/new' },
  { id: 'chatgpt', name: 'ChatGPT', host: 'chatgpt.com', url: 'https://chatgpt.com/' },
  { id: 'gemini', name: 'Gemini', host: 'gemini.google.com', url: 'https://gemini.google.com/app' },
] as const

type Target = (typeof aiApps)[number]['id']

const PROMPT_FILE = 'quiz-prompt.txt'

function readState(value: unknown): PastePageState | undefined {
  const v = value as Partial<PastePageState> | null
  return v && typeof v === 'object' && v.request && typeof v.request === 'object'
    ? (v as PastePageState)
    : undefined
}

export function PastePage() {
  useDocumentTitle('Copy & paste')
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
  // Every quiz belongs to a saved source, so later batches can continue without repeats.
  const [sourceId] = useState(() => request.sourceId ?? newId())
  const [target, setTarget] = useState<Target>('claude')
  const selectedApp = aiApps.find((a) => a.id === target) ?? aiApps[0]
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
    const continuing = Boolean(request.avoid?.concepts.length)
    // A next batch where the AI reports nothing new is left: the source is fully covered.
    if (result.questions.length === 0 && continuing && result.totalIdeas !== undefined) {
      void recordCoverage({ ...request, sourceId }, requestLabel(request.source), {
        concepts: [],
        prompts: [],
        totalIdeas: result.totalIdeas,
        exhausted: true,
      }).catch(() => undefined)
      setError(
        "You've covered every idea in this source. Try a new source or a different focus, or replay your quizzes from History.",
      )
      return
    }
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
      id: newId(),
      title:
        result.title ??
        (request.source.kind === 'topic' ? request.source.text.slice(0, 60) : 'My quiz'),
      source: { kind: request.source.kind, label: requestLabel(request.source) },
      settings: {
        count: request.count,
        focus: request.focus,
        difficulty: request.difficulty,
        types: request.types,
      },
      provider: 'copy-paste',
      promptVersion: PROMPT_VERSION,
      sourceId,
      questions: result.questions,
      createdAt: new Date().toISOString(),
    }
    void saveQuiz(quiz, 'pasted').catch(() => undefined)
    void recordCoverage({ ...request, sourceId }, requestLabel(request.source), {
      concepts: result.concepts,
      prompts: result.questions.map((q) => q.prompt),
      totalIdeas: result.totalIdeas,
    }).catch(() => undefined)
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
        Copy the instructions into Claude, ChatGPT or Gemini, then paste the reply back here. No API
        key needed: it uses your own plan.
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
          <div role="group" aria-label="AI app" className="mt-4 flex flex-wrap gap-2">
            {aiApps.map((app) => (
              <button
                key={app.id}
                type="button"
                aria-pressed={target === app.id}
                onClick={() => setTarget(app.id)}
                className={`rounded-full border-2 px-4 py-1.5 text-sm font-medium ${
                  target === app.id
                    ? 'border-brand bg-brand/10 text-brand'
                    : 'border-border text-muted'
                }`}
              >
                {app.name}
              </button>
            ))}
          </div>
          <p className="mt-4 text-sm leading-relaxed">
            Open a new chat at{' '}
            <a
              href={selectedApp.url}
              target="_blank"
              rel="noreferrer noopener"
              className="text-brand underline"
            >
              {selectedApp.host}
            </a>
            , paste the instructions and send. Then use the copy button on the code block in the
            reply.
          </p>
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
