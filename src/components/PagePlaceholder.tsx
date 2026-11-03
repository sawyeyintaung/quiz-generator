import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

type Props = {
  title: string
  description: string
  milestone: string
  children?: ReactNode
}

/** Temporary page body used by the app shell until each screen is built. */
export function PagePlaceholder({ title, description, milestone, children }: Props) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <p className="text-muted mt-2">{description}</p>
      <div className="border-border bg-surface text-muted mt-8 rounded-2xl border border-dashed p-6 text-sm">
        Coming in {milestone}.
      </div>
      {children}
    </motion.section>
  )
}
