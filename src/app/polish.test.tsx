import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { ShareDialog } from '../features/share/ShareDialog.tsx'
import { demoQuiz } from '../features/quiz/demoQuiz.ts'
import { RouteErrorPage } from './RouteErrorPage.tsx'
import { routes } from './routes.tsx'

function DialogHarness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open share
      </button>
      <ShareDialog quiz={open ? demoQuiz : undefined} onClose={() => setOpen(false)} />
    </>
  )
}

describe('polish', () => {
  it('keeps focus inside the share dialog and returns it on close', async () => {
    const user = userEvent.setup()
    render(<DialogHarness />)
    const opener = screen.getByRole('button', { name: 'Open share' })
    await user.click(opener)
    const close = await screen.findByRole('button', { name: 'Close' })
    expect(close).toHaveFocus()

    // Tab past the last control wraps back to the first; Shift+Tab wraps the other way.
    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: /Download/ })).toHaveFocus()
    await user.tab()
    expect(close).toHaveFocus()

    // Focus returns once the closing animation finishes.
    await user.keyboard('{Escape}')
    await waitFor(() => expect(opener).toHaveFocus())
  })

  it('sets a page title per screen', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/settings'] })
    render(<RouterProvider router={router} />)
    await screen.findByRole('heading', { level: 1, name: 'Settings' })
    expect(document.title).toBe('Settings · Quiz Generator')
  })

  it('offers a reload when an old tab cannot load new code', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          errorElement: <RouteErrorPage />,
          loader: () => {
            throw new TypeError('Failed to fetch dynamically imported module: /assets/x.js')
          },
          element: <p>never</p>,
        },
      ],
      { initialEntries: ['/'] },
    )
    render(<RouterProvider router={router} />)
    expect(await screen.findByText('A new version is available')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
  })
})
