import { AnimatePresence, motion } from 'framer-motion'
import type { FocusSuggestion } from './suggest.ts'
import type { SuggestionState } from './useFocusSuggestions.ts'

type Props = {
  state: SuggestionState
  picks: string[]
  onToggle: (suggestion: FocusSuggestion) => void
  onClear: () => void
  onRequest: () => void
}

const chip =
  'rounded-xl border-2 px-3 py-1.5 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'

export function FocusSuggestions({ state, picks, onToggle, onClear, onRequest }: Props) {
  if (state.status === 'none') return null

  return (
    <div className="mt-3" aria-live="polite">
      {state.status === 'available' && (
        <button
          type="button"
          onClick={onRequest}
          className="text-brand text-sm font-medium underline"
        >
          ✨ Suggest focus areas
        </button>
      )}

      {state.status === 'loading' && (
        <div className="flex flex-wrap items-center gap-2" role="status">
          <span className="text-muted text-xs">Finding focus areas…</span>
          {[96, 128, 80, 112].map((w, i) => (
            <motion.span
              key={i}
              aria-hidden
              className="bg-border block h-8 rounded-xl"
              style={{ width: w }}
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.12 }}
            />
          ))}
        </div>
      )}

      {state.status === 'error' && (
        <p className="text-muted text-xs">
          Couldn&apos;t load suggestions.{' '}
          <button type="button" onClick={onRequest} className="text-brand underline">
            Try again
          </button>
        </p>
      )}

      <AnimatePresence>
        {state.status === 'ready' && state.suggestions.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <p className="text-muted text-xs">
              Suggested focus areas{state.from === 'structure' ? ' (from your document)' : ''}: pick
              one or more
            </p>
            <motion.ul
              className="mt-2 flex flex-wrap gap-2"
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.05 } } }}
            >
              <motion.li variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }}>
                <button
                  type="button"
                  aria-pressed={picks.length === 0}
                  onClick={onClear}
                  className={`${chip} ${
                    picks.length === 0
                      ? 'border-brand bg-brand/10 text-brand'
                      : 'border-border text-muted hover:border-brand/50'
                  }`}
                >
                  <span className="block font-medium">Whole source</span>
                  <span className="block text-xs opacity-80">general overview</span>
                </button>
              </motion.li>
              {state.suggestions.map((s) => {
                const active = picks.includes(s.title)
                return (
                  <motion.li
                    key={s.id}
                    variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }}
                  >
                    <button
                      type="button"
                      aria-pressed={active}
                      title={s.description}
                      onClick={() => onToggle(s)}
                      className={`${chip} ${
                        active
                          ? 'border-brand bg-brand/10 text-brand'
                          : 'border-border hover:border-brand/50'
                      }`}
                    >
                      <span className="block font-medium">{s.title}</span>
                      <span className="text-muted block text-xs">
                        ~{s.estimatedQuestions} question{s.estimatedQuestions === 1 ? '' : 's'}
                        {s.pageRange &&
                          ` · p. ${s.pageRange[0]}${s.pageRange[1] !== s.pageRange[0] ? `–${s.pageRange[1]}` : ''}`}
                      </span>
                    </button>
                  </motion.li>
                )
              })}
            </motion.ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
