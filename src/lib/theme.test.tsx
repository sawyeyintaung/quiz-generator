import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { routes } from '../app/routes.tsx'
import { initTheme, setThemePreference } from './theme.ts'

beforeEach(() => {
  localStorage.clear()
  setThemePreference('system')
})

describe('theme', () => {
  it('toggles from the header and remembers the choice', async () => {
    const user = userEvent.setup()
    initTheme()
    render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/'] })} />)
    // jsdom reports a light device, so the button offers dark mode.
    await user.click(screen.getByRole('button', { name: 'Switch to dark mode' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')
    expect(localStorage.getItem('qg.theme')).toBe('dark')
    await user.click(screen.getByRole('button', { name: 'Switch to light mode' }))
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('offers System, Light and Dark in Settings', async () => {
    const user = userEvent.setup()
    setThemePreference('dark')
    render(
      <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/settings'] })} />,
    )
    await user.click(await screen.findByRole('radio', { name: /System/ }))
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
    expect(localStorage.getItem('qg.theme')).toBeNull()
  })
})
