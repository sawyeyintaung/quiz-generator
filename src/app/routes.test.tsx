import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { routes } from './routes.tsx'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

describe('app routes', () => {
  it.each([
    ['/', 'Create a quiz'],
    ['/play', 'No quiz loaded'],
    ['/results', 'Results'],
    ['/history', 'History'],
    ['/settings', 'Settings'],
    ['/does-not-exist', 'Page not found'],
  ])('renders %s', async (path, heading) => {
    renderAt(path)
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
  })

  it('navigates with the main nav', async () => {
    const user = userEvent.setup()
    const router = renderAt('/')
    const nav = screen.getByRole('navigation', { name: 'Main' })

    await user.click(within(nav).getByRole('link', { name: 'History' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/history'))
    expect(within(nav).getByRole('link', { name: 'History' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })
})
