import { motion } from 'framer-motion'
import { Link } from 'react-router'
import { demoQuiz } from '../features/quiz/demoQuiz.ts'
import { PagePlaceholder } from '../components/PagePlaceholder.tsx'

export function CreatePage() {
  return (
    <PagePlaceholder
      title="Create a quiz"
      description="Add a topic, notes, a file or a link, then pick your settings."
      milestone="Milestone 3"
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.25 }}
        className="border-brand/30 from-brand/10 mt-6 flex flex-col gap-4 rounded-2xl border bg-gradient-to-br to-fuchsia-500/10 p-6 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h2 className="font-semibold">Try the demo quiz</h2>
          <p className="text-muted mt-1 text-sm">
            {demoQuiz.title} · {demoQuiz.questions.length} questions · no API key needed
          </p>
        </div>
        <Link
          to="/play?demo"
          className="bg-accent hover:bg-accent-strong shrink-0 rounded-xl px-5 py-2.5 text-center font-semibold text-white"
        >
          Play demo
        </Link>
      </motion.div>
    </PagePlaceholder>
  )
}
