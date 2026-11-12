import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'

type Props = {
  text: string
  label: string
  className?: string
  /** Called if the clipboard is unavailable, so the page can offer manual copying. */
  onFail?: () => void
}

export function CopyButton({ text, label, className = '', onFail }: Props) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setState('copied')
    } catch {
      setState('failed')
      onFail?.()
    }
    window.setTimeout(() => setState('idle'), 2000)
  }

  return (
    <motion.button
      type="button"
      onClick={() => void copy()}
      whileTap={{ scale: 0.96 }}
      className={`relative overflow-hidden ${className}`}
      aria-live="polite"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={state}
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -10, opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="block"
        >
          {state === 'copied' ? 'Copied ✓' : state === 'failed' ? 'Copy failed' : label}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  )
}
