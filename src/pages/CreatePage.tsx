import { AnimatePresence, motion } from 'framer-motion'
import { lazy, Suspense, useId, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  ArrowRightIcon,
  LinkIcon,
  NotesIcon,
  SparkIcon,
  TopicIcon,
  UploadIcon,
} from '../components/icons.tsx'
import { FileSource } from '../features/create/FileSource.tsx'
import { SegmentedControl } from '../features/create/SegmentedControl.tsx'
import { isWebUrl } from '../features/ai/fetchPrompt.ts'
import { FocusSuggestions } from '../features/focus/FocusSuggestions.tsx'
import type { FocusInput, FocusSuggestion } from '../features/focus/suggest.ts'
import { useFocusSuggestions } from '../features/focus/useFocusSuggestions.ts'
import { textForRange } from '../features/sources/readFile.ts'
import { MAX_FILE_TEXT_CHARS } from '../features/sources/types.ts'
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
import {
  activeCredentials,
  updateSettings,
  useSettings,
} from '../features/settings/settingsStore.ts'
import type { PastePageState } from './PastePage.tsx'
import { useDocumentTitle } from '../lib/useDocumentTitle.ts'

const tabs: { id: SourceTab; label: string; hint: string; Icon: typeof TopicIcon }[] = [
  { id: 'topic', label: 'Topic', hint: 'Any subject, any level', Icon: TopicIcon },
  { id: 'text', label: 'Notes', hint: 'Paste your study text', Icon: NotesIcon },
  { id: 'file', label: 'File', hint: 'PDF, Word or text', Icon: UploadIcon },
  { id: 'url', label: 'Link', hint: 'A web page', Icon: LinkIcon },
]

const typeSummary = (types: QuestionType[]) =>
  types.length === 2
    ? 'Mixed types'
    : types[0] === 'true_false'
      ? 'True / false'
      : 'Multiple choice'

// History code loads only when this side panel renders (keeps the first download small).
const RecentQuizzes = lazy(() => import('../features/history/RecentQuizzes.tsx'))

export function CreatePage() {
  useDocumentTitle('Create a quiz')
  const navigate = useNavigate()
  const settings = useSettings()
  const credentials = activeCredentials(settings)
  const pasteMode = settings.mode === 'paste'
  const [draft, setDraftState] = useState<Draft>(getDraft)
  const [submitted, setSubmitted] = useState(false)
  const ids = {
    topic: useId(),
    text: useId(),
    focus: useId(),
    url: useId(),
    step1: useId(),
    step2: useId(),
  }

  function setDraft(patch: Partial<Draft>) {
    setDraftState((d) => saveDraft({ ...d, ...patch }))
  }

  // The text a quiz would be written from, for each kind of source.
  const selectedFileText = draft.file ? textForRange(draft.file, draft.pageRange) : ''
  const bodyText = draft.tab === 'text' ? draft.text : draft.tab === 'file' ? selectedFileText : ''
  const words = wordCount(bodyText)
  const recommended = recommendedMaxQuestions(bodyText)
  const fileTooLong = draft.tab === 'file' && selectedFileText.length > MAX_FILE_TEXT_CHARS
  const urlUnsupported = draft.tab === 'url' && !pasteMode && credentials?.provider === 'openai'

  const sourceError =
    draft.tab === 'topic'
      ? draft.topic.trim().length < 2
        ? 'Enter a topic to quiz yourself on.'
        : undefined
      : draft.tab === 'text'
        ? words < MIN_TEXT_WORDS
          ? `Paste at least ${MIN_TEXT_WORDS} words of notes (you have ${words}).`
          : undefined
        : draft.tab === 'file'
          ? !draft.file
            ? 'Choose a file to quiz yourself on.'
            : words < MIN_TEXT_WORDS
              ? `The selected part has only ${words} words. Choose more pages or another file.`
              : undefined
          : !isWebUrl(draft.url)
            ? 'Enter a web address starting with https://'
            : urlUnsupported
              ? "GPT can't read web pages. Switch to Claude or Gemini in Settings, or paste the page text."
              : undefined
  const tooMany =
    (draft.tab === 'text' || draft.tab === 'file') &&
    words >= MIN_TEXT_WORDS &&
    draft.count > recommended

  // Focus-area suggestions for the current source.
  const focusInput = useMemo<FocusInput | undefined>(() => {
    if (draft.tab === 'topic') return { kind: 'topic', topic: draft.topic }
    if (draft.tab === 'text') return { kind: 'text', text: draft.text }
    if (draft.tab === 'file' && draft.file) return { kind: 'file', file: draft.file }
    return undefined
  }, [draft.tab, draft.topic, draft.text, draft.file])
  const focusKey =
    draft.tab === 'topic'
      ? `topic:${draft.topic.trim().toLowerCase()}`
      : draft.tab === 'text'
        ? `text:${draft.text.length}:${draft.text.slice(0, 200)}`
        : draft.tab === 'file' && draft.file
          ? `file:${draft.file.name}:${draft.file.text.length}`
          : 'none'
  const suggestions = useFocusSuggestions(focusInput, focusKey, {
    credentials: pasteMode ? undefined : credentials,
    auto: settings.autoSuggest,
  })

  function togglePick(s: FocusSuggestion) {
    const options = suggestions.state.status === 'ready' ? suggestions.state.suggestions : []
    const picks = draft.focusPicks.includes(s.title)
      ? draft.focusPicks.filter((t) => t !== s.title)
      : [...draft.focusPicks, s.title]
    const picked = options.filter((o) => picks.includes(o.title))
    const ranges = picked.map((o) => o.pageRange).filter((r): r is [number, number] => Boolean(r))
    setDraft({
      focusPicks: picks,
      focus: picks.join('; ').slice(0, MAX_FOCUS_CHARS),
      // For PDFs, read only the pages the picked parts cover.
      pageRange:
        draft.tab === 'file' && ranges.length > 0 && ranges.length === picked.length
          ? [Math.min(...ranges.map((r) => r[0])), Math.max(...ranges.map((r) => r[1]))]
          : picks.length === 0
            ? undefined
            : draft.pageRange,
    })
  }

  function clearPicks() {
    setDraft({
      focusPicks: [],
      focus: '',
      pageRange: draft.tab === 'file' ? undefined : draft.pageRange,
    })
  }

  function toggleType(type: QuestionType) {
    const has = draft.types.includes(type)
    if (has && draft.types.length === 1) return // keep at least one
    setDraft({ types: has ? draft.types.filter((t) => t !== type) : [...draft.types, type] })
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (sourceError) return
    const range = draft.pageRange
    const source: GenerationRequest['source'] =
      draft.tab === 'topic'
        ? { kind: 'topic', text: draft.topic.trim() }
        : draft.tab === 'text'
          ? { kind: 'text', text: draft.text.trim() }
          : draft.tab === 'file' && draft.file
            ? {
                kind: 'file',
                text: selectedFileText.slice(0, MAX_FILE_TEXT_CHARS).trim(),
                label: range
                  ? `${draft.file.name} (pages ${range[0]}–${range[1]})`
                  : draft.file.name,
              }
            : { kind: 'url', url: draft.url.trim() }
    const request: GenerationRequest = {
      source,
      focus: draft.focus.trim() || undefined,
      count: draft.count,
      difficulty: draft.difficulty,
      types: draft.types,
    }
    if (pasteMode) {
      const state: PastePageState = { request }
      navigate('/paste', { state })
      return
    }
    if (!credentials) {
      navigate('/settings')
      return
    }
    const id = startGeneration(request, credentials)
    navigate(`/play?job=${id}`)
  }

  const sectionCard = 'border-border bg-surface rounded-3xl border p-5 sm:p-7'
  const stepBadge =
    'bg-text text-bg grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold'
  const field =
    'border-border bg-bg focus:border-brand mt-2 w-full rounded-2xl border-2 px-4 outline-none transition-colors'

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]"
    >
      <div className="min-w-0 space-y-6">
        <div>
          <p className="text-brand text-xs font-bold tracking-widest uppercase">New quiz</p>
          <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Create a quiz
          </h1>
          <p className="text-muted mt-2 text-base sm:text-lg">
            Add a topic, your notes, a file or a link. We turn it into an animated quiz.
          </p>
        </div>

        {!credentials && !pasteMode && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-amber-500/40 bg-amber-400/10 p-5 sm:p-6"
          >
            <h2 className="font-display font-bold">How do you want to create quizzes?</h2>
            <p className="text-muted mt-1 text-sm">
              Add your own API key from Anthropic, OpenAI or Google, or use your Claude Code, Claude
              or ChatGPT subscription by copying and pasting.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Link
                to="/settings"
                className="bg-accent hover:bg-accent-strong rounded-xl px-5 py-2.5 text-center font-semibold text-white"
              >
                Add API key
              </Link>
              <button
                type="button"
                onClick={() => updateSettings({ mode: 'paste' })}
                className="border-brand text-brand hover:bg-brand/10 rounded-xl border-2 px-5 py-2.5 font-semibold"
              >
                Use my subscription (copy &amp; paste)
              </button>
            </div>
          </motion.div>
        )}

        <form onSubmit={submit} noValidate className="space-y-6">
          <section className={sectionCard} aria-labelledby={ids.step1}>
            <div className="flex items-center gap-3">
              <span className={stepBadge} aria-hidden>
                1
              </span>
              <h2 id={ids.step1} className="font-display text-lg font-bold">
                Choose your source
              </h2>
            </div>

            <div
              role="group"
              aria-label="Source"
              className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"
            >
              {tabs.map((t) => {
                const active = draft.tab === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setDraft({ tab: t.id })}
                    className={`flex flex-col gap-2 rounded-2xl border-2 p-3.5 text-left transition-colors sm:p-4 ${
                      active
                        ? 'border-brand bg-brand/10'
                        : 'border-border bg-surface hover:border-brand/50'
                    }`}
                  >
                    <t.Icon className={active ? 'text-brand' : 'text-muted'} />
                    <span className="font-bold">{t.label}</span>
                    <span className="text-muted text-xs sm:text-sm" aria-hidden>
                      {t.hint}
                    </span>
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
                    onChange={(e) => setDraft({ topic: e.target.value, focusPicks: [] })}
                    maxLength={MAX_TOPIC_CHARS}
                    placeholder="e.g. Photosynthesis, high-school level"
                    className={`${field} h-13 text-base`}
                  />
                </>
              ) : draft.tab === 'text' ? (
                <>
                  <label htmlFor={ids.text} className="text-sm font-semibold">
                    Paste your notes or study text
                  </label>
                  <textarea
                    id={ids.text}
                    value={draft.text}
                    onChange={(e) => setDraft({ text: e.target.value, focusPicks: [] })}
                    maxLength={MAX_TEXT_CHARS}
                    rows={8}
                    placeholder="Paste a chapter, lecture notes, an article…"
                    className={`${field} resize-y py-3 text-sm leading-relaxed`}
                  />
                  <p className="text-muted mt-1 text-xs">
                    {words.toLocaleString()} words
                    {words >= MIN_TEXT_WORDS &&
                      ` · enough for about ${recommended} unique question${recommended === 1 ? '' : 's'}`}
                    {draft.text.length >= MAX_TEXT_CHARS * 0.9 &&
                      ` · ${(MAX_TEXT_CHARS - draft.text.length).toLocaleString()} characters left`}
                  </p>
                </>
              ) : draft.tab === 'file' ? (
                <>
                  <p className="mb-2 text-sm font-semibold">Upload your study material</p>
                  <FileSource
                    file={draft.file}
                    pageRange={draft.pageRange}
                    onFile={(file) =>
                      setDraft({ file, pageRange: undefined, focusPicks: [], focus: '' })
                    }
                    onPageRange={(pageRange) => setDraft({ pageRange })}
                  />
                  {draft.file && words >= MIN_TEXT_WORDS && (
                    <p className="text-muted mt-1 text-xs">
                      {draft.pageRange ? 'Selected pages: ' : ''}
                      {words.toLocaleString()} words · enough for about {recommended} unique
                      question{recommended === 1 ? '' : 's'}
                    </p>
                  )}
                  {fileTooLong && (
                    <p className="mt-2 rounded-xl bg-amber-400/15 px-4 py-3 text-sm" role="status">
                      This is a lot of text. Only about the first{' '}
                      {Math.round(MAX_FILE_TEXT_CHARS / 6).toLocaleString()} words will be used.
                      Pick a focus area or page range to quiz on a specific part.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <label htmlFor={ids.url} className="text-sm font-semibold">
                    Web page address
                  </label>
                  <input
                    id={ids.url}
                    type="url"
                    inputMode="url"
                    value={draft.url}
                    onChange={(e) => setDraft({ url: e.target.value })}
                    placeholder="https://en.wikipedia.org/wiki/Photosynthesis"
                    className={`${field} h-13 text-base`}
                  />
                  <p className="text-muted mt-1 text-xs">
                    {pasteMode
                      ? 'Your AI app will open the page. Pages that need a login may not work.'
                      : urlUnsupported
                        ? "GPT can't read web pages: use Claude or Gemini, or paste the page text instead."
                        : 'Your AI provider opens and reads the page. Pages that need a login may not work.'}
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
                onChange={(e) => setDraft({ focus: e.target.value, focusPicks: [] })}
                maxLength={MAX_FOCUS_CHARS}
                placeholder="e.g. only the light reactions"
                className={`${field} h-12`}
              />
              <FocusSuggestions
                state={suggestions.state}
                picks={draft.focusPicks}
                onToggle={togglePick}
                onClear={clearPicks}
                onRequest={suggestions.request}
              />
            </div>
          </section>

          <section className={sectionCard} aria-labelledby={ids.step2}>
            <div className="flex items-center gap-3">
              <span className={stepBadge} aria-hidden>
                2
              </span>
              <h2 id={ids.step2} className="font-display text-lg font-bold">
                Quiz settings
              </h2>
            </div>
            <div className="mt-5 grid gap-5 md:grid-cols-3">
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
              <fieldset>
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
                        className={`flex cursor-pointer items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-semibold transition-colors ${
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
                  <span className="mt-5 block rounded-xl bg-amber-400/15 px-4 py-3 text-sm">
                    This text is fairly short. We recommend up to {recommended} question
                    {recommended === 1 ? '' : 's'}. You can continue, but you may get fewer unique
                    questions than you asked for.
                  </span>
                </motion.p>
              )}
            </AnimatePresence>
          </section>

          <div className="bg-text text-bg flex flex-col gap-4 rounded-3xl p-4 sm:flex-row sm:items-center sm:justify-between sm:pl-6">
            <div className="min-w-0">
              <p className="font-display font-bold">
                {draft.count} questions ·{' '}
                {difficulties.find((d) => d.id === draft.difficulty)?.label} ·{' '}
                {typeSummary(draft.types)}
              </p>
              <p className="mt-0.5 text-sm opacity-80">
                {pasteMode ? (
                  <>Copy &amp; paste with your subscription · </>
                ) : credentials ? (
                  <>
                    {providers[credentials.provider].name} · {credentials.model} ·{' '}
                  </>
                ) : (
                  <>No API key yet · </>
                )}
                <Link to="/settings" className="underline">
                  {credentials || pasteMode ? 'Change' : 'Add one'}
                </Link>
              </p>
            </div>
            <motion.button
              type="submit"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="bg-accent hover:bg-accent-strong flex h-13 shrink-0 items-center justify-center gap-2.5 rounded-2xl px-6 text-base font-bold text-white"
            >
              {pasteMode ? (
                <>
                  Get instructions <ArrowRightIcon size={18} />
                </>
              ) : (
                <>
                  <SparkIcon className="text-spark" /> Generate quiz
                </>
              )}
            </motion.button>
          </div>
        </form>
      </div>

      <aside className="space-y-5 lg:sticky lg:top-24" aria-label="Shortcuts">
        <Suspense fallback={null}>
          <RecentQuizzes />
        </Suspense>
        <section className="bg-brand/10 rounded-3xl p-5 sm:p-6">
          <h2 className="font-display text-base font-bold">New here?</h2>
          <p className="text-muted mt-1.5 text-sm leading-relaxed">
            Play an {demoQuiz.questions.length}-question demo about {demoQuiz.title.toLowerCase()}.
            No API key needed.
          </p>
          <Link
            to="/play?demo"
            className="border-brand text-brand hover:bg-brand/10 mt-4 inline-block rounded-xl border-2 px-4 py-2 text-sm font-bold"
          >
            Play demo
          </Link>
        </section>
      </aside>
    </motion.section>
  )
}
