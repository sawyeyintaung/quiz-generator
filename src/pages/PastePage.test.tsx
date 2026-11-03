import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../app/routes.tsx'
import { resetDraftForTests } from '../features/create/draft.ts'
import { resetSettingsForTests } from '../features/settings/settingsStore.ts'
import { mc, tf } from '../test/fakeClient.ts'

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  resetSettingsForTests()
  resetDraftForTests()
})

describe('copy & paste mode', () => {
  it('copies instructions, reads the pasted reply and starts the quiz', async () => {
    const user = userEvent.setup()
    const writeText = vi.spyOn(navigator.clipboard, 'writeText')
    const router = createMemoryRouter(routes, { initialEntries: ['/'] })
    render(<RouterProvider router={router} />)

    // No API key: choose the subscription option instead.
    await user.click(screen.getByRole('button', { name: /Use my subscription/ }))
    await user.type(screen.getByLabelText('What do you want to be quizzed on?'), 'Volcanoes')
    await user.click(screen.getByRole('button', { name: /Get instructions/ }))
    expect(router.state.location.pathname).toBe('/paste')

    await user.click(screen.getByRole('button', { name: 'Copy instructions' }))
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Volcanoes'))
    expect(await screen.findByText('Copied ✓')).toBeInTheDocument()

    const reply = `\`\`\`json\n{"title": "Volcano Quiz", "questions": [${[
      mc(1, 'What is magma called at the surface?', 'Lava', ['Ash', 'Basalt', 'Pumice']),
      tf(2, 'Most active volcanoes lie on the Ring of Fire.', true),
    ].join(',')}]}\n\`\`\``
    await user.click(screen.getByLabelText('Paste the reply here'))
    await user.paste(reply)
    await user.click(screen.getByRole('button', { name: /Start quiz/ }))

    expect(router.state.location.pathname).toBe('/play')
    expect(await screen.findByRole('heading', { name: 'Volcano Quiz' })).toBeInTheDocument()
    expect(screen.getByText(/had 2 unique questions \(you asked for 10\)/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Lava$/ }))
    expect(await screen.findByText('Correct!')).toBeInTheDocument()
  })

  it('explains when the pasted text has no questions', async () => {
    const user = userEvent.setup()
    const router = createMemoryRouter(routes, {
      initialEntries: [
        {
          pathname: '/paste',
          state: {
            request: {
              source: { kind: 'topic', text: 'Volcanoes' },
              count: 5,
              difficulty: 'easy',
              types: ['multiple_choice'],
            },
          },
        },
      ],
    })
    render(<RouterProvider router={router} />)
    await user.type(screen.getByLabelText('Paste the reply here'), 'Sorry, I cannot do that.')
    await user.click(screen.getByRole('button', { name: /Start quiz/ }))
    expect(screen.getByRole('alert')).toHaveTextContent(/couldn't find any quiz questions/)
  })
})
