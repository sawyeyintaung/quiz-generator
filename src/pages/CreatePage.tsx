import { AnimatePresence, motion } from 'framer-motion'
import { useId, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { SegmentedControl } from '../features/create/SegmentedControl.tsx'
import { providers } from '../features/ai/providers.ts'
import { startGeneration } from '../features/generate/generationStore.ts'
import {
  MAX_FOCUS_CHARS,
  MAX_TEXT_CHARS,
  MAX_TOPIC_CHARS,
  recommendedMaxQuestions,
  wordCount,
} from '../features/generate/source.ts'
import { difficulties, questionCounts, type GenerationRequest } from '../features/generate/types.ts'
import { demoQuiz } from '../features/quiz/demoQuiz.ts'
import type { QuestionType } from '../features/quiz/schema.ts'
import {
  getDraft,
  MIN_TEXT_WORDS,
  saveDraft,
  type Draft,
  type SourceTab,
} from '../features/create/draft.ts'
import { activeCredentials, useSettings } from '../features/settings/settingsStore.ts'

const tabs: { id: SourceTab; label: string; soon?: boolean }[] = [
  { id: 'topic', label: 'Topic' },
  { id: 'text', label: 'Paste notes' },
  { id: 'file', label: 'Upload file', soon: true },
  { id: 'url', label: 'Link', soon: true },
]

export function CreatePage() {
  const navigate = useNavigate()
  const settings = useSettings()
  const credentials = activeCredentials(settings)
  const [draft, setDraftState] = useState<Draft>(getDraft)
  const [submitted, setSubmitted] = useState(false)
  const ids = { topic: useId(), text: useId(), focus: useId() }

  function setDraft(patch: Partial<Draft>) {
    setDraftState((d) => saveDraft({ ...d, ...patch }))
  }

  const words = wordCount(draft.text)
  const recommended = recommendedMaxQuestions(draft.text)
  const sourceError =
    draft.tab === 'topic'
      ? draft.topic.trim().length < 2
        ? 'Enter a topic to quiz yourself on.'
        : undefined
      : words < MIN_TEXT_WORDS
        ? `Paste at least ${MIN_TEXT_WORDS} words of notes (you have ${words}).`
        : undefined
  const tooMany = draft.tab === 'text' && words >= MIN_TEXT_WORDS && draft.count > recommended

  function toggleType(type: QuestionType) {
    const has = draft.types.includes(type)
    if (has && draft.types.length === 1) return // keep at least one
    setDraft({ types: has ? draft.types.filter((t) => t !== type) : [...draft.types, type] })
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (sourceError) return
    if (!credentials) {
      navigate('/settings')
      return
    }
    const request: GenerationRequest = {
      source:
        draft.tab === 'topic'
          ? { kind: 'topic', text: draft.topic.trim() }
          : { kind: 'text', text: draft.text.trim() },
      focus: draft.focus.trim() || undefined,
      count: draft.count,
      difficulty: draft.difficulty,
      types: draft.types,
    }
    const id = startGeneration(request, credentials)
    navigate(`/play?job=${id}`)
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <h1 className="text-3xl font-bold tracking-tight">Create a quiz</h1>
      <p className="text-muted mt-2">
        Add a topic or your notes, pick your settings, and start answering in seconds.
      </p>

      {!credentials && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 flex flex-col gap-3 rounded-2xl border border-amber-500/40 bg-amber-400/10 p-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <h2 className="font-semibold">Add your API key to create quizzes</h2>
            <p className="text-muted mt-1 text-sm">
              Use your own key from Anthropic, OpenAI or Google. It stays in this browser.
            </p>
          </div>
          <Link
            to="/settings"
            className="bg-accent hover:bg-accent-strong shrink-0 rounded-xl px-5 py-2.5 text-center font-semibold text-white"
          >
            Add API key
          </Link>
        </motion.div>
      )}

      <form
        onSubmit={submit}
        noValidate
        className="border-border bg-surface mt-6 rounded-2xl border p-5 shadow-sm sm:p-6"
      >
        <div role="tablist" aria-label="Source" className="flex flex-wrap gap-2">
          {tabs.map((t) => {
            const active = draft.tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                disabled={t.soon}
                onClick={() => setDraft({ tab: t.id })}
                className={`rounded-full border-2 px-4 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? 'border-brand bg-brand/10 text-brand'
                    : 'border-border text-muted enabled:hover:text-text disabled:opacity-50'
                }`}
              >
                {t.label}
                {t.soon && <span className="ml-1 text-xs">(soon)</span>}
              </button>
            )
          })}
        </div>

        <div className="mt-5">
          {draft.tab === 'topic' ? (
            <>
              <label htmlFor={ids.topic} className="text-sm font-semibold">
                What do you want to be quizzed on?
              </label>
              <input
                id={ids.topic}
                value={draft.topic}
                onChange={(e) => setDraft({ topic: e.target.value })}
                maxLength={MAX_TOPIC_CHARS}
                placeholder="e.g. Photosynthesis, high-school level"
                className="border-border bg-bg focus:border-brand mt-2 w-full rounded-xl border-2 px-3 py-2.5 outline-none"
              />
            </>
          ) : (
            <>
              <label htmlFor={ids.text} className="text-sm font-semibold">
                Paste your notes or study text
              </label>
              <textarea
                id={ids.text}
                value={draft.text}
                onChange={(e) => setDraft({ text: e.target.value })}
                maxLength={MAX_TEXT_CHARS}
                rows={8}
                placeholder="Paste a chapter, lecture notes, an article…"
                className="border-border bg-bg focus:border-brand mt-2 w-full resize-y rounded-xl border-2 px-3 py-2.5 text-sm leading-relaxed outline-none"
              />
              <p className="text-muted mt-1 text-xs">
                {words.toLocaleString()} words
                {words >= MIN_TEXT_WORDS &&
                  ` · enough for about ${recommended} unique question${recommended === 1 ? '' : 's'}`}
                {draft.text.length >= MAX_TEXT_CHARS * 0.9 &&
                  ` · ${(MAX_TEXT_CHARS - draft.text.length).toLocaleString()} characters left`}
              </p>
            </>
          )}
          {submitted && sourceError && (
            <p className="text-wrong mt-1.5 text-sm" role="alert">
              {sourceError}
            </p>
          )}
        </div>

        <div className="mt-5">
          <label htmlFor={ids.focus} className="text-sm font-semibold">
            Focus on <span className="text-muted font-normal">(optional)</span>
          </label>
          <input
            id={ids.focus}
            value={draft.focus}
            onChange={(e) => setDraft({ focus: e.target.value })}
            maxLength={MAX_FOCUS_CHARS}
            placeholder="e.g. only the light reactions"
            className="border-border bg-bg focus:border-brand mt-2 w-full rounded-xl border-2 px-3 py-2.5 outline-none"
          />
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <SegmentedControl
            label="Questions"
            options={questionCounts.map((n) => ({ value: n, label: String(n) }))}
            value={draft.count}
            onChange={(count) => setDraft({ count })}
          />
          <SegmentedControl
            label="Difficulty"
            options={difficulties.map((d) => ({ value: d.id, label: d.label }))}
            value={draft.difficulty}
            onChange={(difficulty) => setDraft({ difficulty })}
            hint={difficulties.find((d) => d.id === draft.difficulty)?.hint}
          />
        </div>

        <AnimatePresence>
          {tooMany && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
              role="status"
            >
              <span className="mt-4 block rounded-xl bg-amber-400/15 px-4 py-3 text-sm">
                This text is fairly short. We recommend up to {recommended} question
                {recommended === 1 ? '' : 's'}. You can continue, but you may get fewer unique
                questions than you asked for.
              </span>
            </motion.p>
          )}
        </AnimatePresence>

        <fieldset className="mt-6">
          <legend className="text-sm font-semibold">Question types</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {(
              [
                ['multiple_choice', 'Multiple choice'],
                ['true_false', 'True / false'],
              ] as const
            ).map(([type, label]) => {
              const checked = draft.types.includes(type)
              return (
                <label
                  key={type}
                  className={`flex cursor-pointer items-center gap-2 rounded-xl border-2 px-4 py-2 text-sm font-medium transition-colors ${
                    checked ? 'border-brand bg-brand/10' : 'border-border'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleType(type)}
                    className="accent-brand size-4"
                  />
                  {label}
                </label>
              )
            })}
          </div>
        </fieldset>

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted text-xs">
            {credentials ? (
              <>
                Using {providers[credentials.provider].name} · {credentials.model} ·{' '}
                <Link to="/settings" className="text-brand underline">
                  Change
                </Link>
              </>
            ) : (
              'No API key yet: you will be asked to add one.'
            )}
          </p>
          <motion.button
            type="submit"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="bg-accent hover:bg-accent-strong rounded-xl px-6 py-3 font-semibold text-white shadow-sm"
          >
            Generate quiz ✨
          </motion.button>
        </div>
      </form>

      <div className="border-brand/30 from-brand/10 mt-6 flex flex-col gap-4 rounded-2xl border bg-gradient-to-br to-fuchsia-500/10 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold">Try the demo quiz</h2>
          <p className="text-muted mt-1 text-sm">
            {demoQuiz.title} · {demoQuiz.questions.length} questions · no API key needed
          </p>
        </div>
        <Link
          to="/play?demo"
          className="border-brand text-brand hover:bg-brand/10 shrink-0 rounded-xl border-2 px-5 py-2.5 text-center font-semibold"
        >
          Play demo
        </Link>
      </div>
    </motion.section>
  )
}
