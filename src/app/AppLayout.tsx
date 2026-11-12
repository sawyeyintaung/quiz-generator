import { MotionConfig } from 'framer-motion'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { Logo } from '../components/Logo.tsx'
import { ThemeToggle } from '../components/ThemeToggle.tsx'

const navItems = [
  { to: '/', label: 'Create', end: true },
  { to: '/history', label: 'History', end: false },
  { to: '/settings', label: 'Settings', end: false },
]

export function AppLayout() {
  const wide = useLocation().pathname === '/'
  return (
    // reducedMotion="user" makes every animation respect prefers-reduced-motion.
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-dvh flex-col">
        <header className="border-border bg-surface/80 sticky top-0 z-10 border-b backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <Link to="/" className="shrink-0 rounded-xl">
              <Logo size={36} hideWordmarkOnMobile />
            </Link>
            <div className="flex items-center gap-1 sm:gap-2">
              <nav aria-label="Main">
                <ul className="flex gap-0.5 text-sm sm:gap-1">
                  {navItems.map((item) => (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.end}
                        className={({ isActive }) =>
                          `rounded-lg px-2.5 py-2 font-semibold transition-colors sm:px-3.5 ${
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
              <ThemeToggle />
            </div>
          </div>
        </header>

        {/* Create uses a wide two-column layout; other pages keep a comfortable reading width. */}
        <main
          className={`mx-auto w-full flex-1 overflow-x-clip px-4 py-8 sm:px-6 sm:py-10 ${
            wide ? 'max-w-6xl' : 'max-w-3xl'
          }`}
        >
          <Outlet />
        </main>

        <footer className="text-muted mx-auto w-full max-w-6xl px-4 py-6 text-xs sm:px-6">
          Runs entirely in your browser. Your API key is only sent to the AI provider you choose.
        </footer>
      </div>
    </MotionConfig>
  )
}
