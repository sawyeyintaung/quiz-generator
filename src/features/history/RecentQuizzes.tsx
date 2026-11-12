import { Link } from 'react-router'
import { useHistory } from './db.ts'

/** "Continue learning": the three most recent quizzes, for the Create page side column. */
export default function RecentQuizzes() {
  const history = useHistory()
  if (!Array.isArray(history)) return null

  return (
    <section className="border-border bg-surface rounded-3xl border p-5 sm:p-6">
      <h2 className="font-display text-base font-bold">Continue learning</h2>
      {history.length === 0 ? (
        <p className="text-muted mt-2 text-sm">Quizzes you create will appear here.</p>
      ) : (
        <>
          <ul className="mt-3 space-y-2">
            {history.slice(0, 3).map(({ quiz, best }) => (
              <li key={quiz.id}>
                <Link
                  to="/play"
                  state={{ quiz }}
                  className="bg-bg hover:bg-brand/10 flex items-center justify-between gap-3 rounded-2xl p-3 transition-colors"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{quiz.title}</span>
                    <span className="text-muted block text-xs">
                      {quiz.questions.length} questions ·{' '}
                      {quiz.settings.difficulty[0].toUpperCase() +
                        quiz.settings.difficulty.slice(1)}
                    </span>
                  </span>
                  <span className="text-brand shrink-0 text-sm font-bold">
                    {best ? `Best ${Math.round((best.correct / best.total) * 100)}%` : 'New'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            to="/history"
            className="text-brand mt-3 inline-block text-sm font-semibold underline"
          >
            See all history
          </Link>
        </>
      )}
    </section>
  )
}
