import { MotionConfig } from 'framer-motion'
import { Link, NavLink, Outlet } from 'react-router'

const navItems = [
  { to: '/', label: 'Create', end: true },
  { to: '/history', label: 'History', end: false },
  { to: '/settings', label: 'Settings', end: false },
]

export function AppLayout() {
  return (
    // reducedMotion="user" makes every animation respect prefers-reduced-motion.
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-dvh flex-col">
        <header className="border-border bg-surface/80 sticky top-0 z-10 border-b backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
            <Link
              to="/"
              className="flex shrink-0 items-center gap-2 font-bold tracking-tight whitespace-nowrap"
            >
              <span
                aria-hidden
                className="bg-brand grid size-8 place-items-center rounded-lg text-white"
              >
                ?
              </span>
              <span className="sr-only sm:not-sr-only">Quiz Generator</span>
            </Link>
            <nav aria-label="Main">
              <ul className="flex gap-0.5 text-sm sm:gap-1">
                {navItems.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        `rounded-md px-2.5 py-2 font-medium transition-colors sm:px-3 ${
                          isActive ? 'bg-brand/10 text-brand' : 'text-muted hover:text-text'
                        }`
                      }
                    >
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </header>

        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
          <Outlet />
        </main>

        <footer className="text-muted mx-auto w-full max-w-3xl px-4 py-6 text-xs">
          Runs entirely in your browser. Your API key is only sent to the AI provider you choose.
        </footer>
      </div>
    </MotionConfig>
  )
}
