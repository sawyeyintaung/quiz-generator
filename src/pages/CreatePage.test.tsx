import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { routes } from '../app/routes.tsx'
import { resetDraftForTests } from '../features/create/draft.ts'
import { setClientFactoryForTests } from '../features/generate/generationStore.ts'
import { resetSettingsForTests, setApiKey } from '../features/settings/settingsStore.ts'
import { fakeClient, mc, tf } from '../test/fakeClient.ts'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  resetSettingsForTests()
  resetDraftForTests()
})
afterEach(() => setClientFactoryForTests())

describe('creating a quiz', () => {
  it('asks for an API key first', async () => {
    const user = userEvent.setup()
    const router = renderAt('/')
    expect(screen.getByText('How do you want to create quizzes?')).toBeInTheDocument()
    await user.type(screen.getByLabelText('What do you want to be quizzed on?'), 'Volcanoes')
    await user.click(screen.getByRole('button', { name: /Generate quiz/ }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/settings'))
  })

  it('validates pasted notes and warns when asking for too many questions', async () => {
    const user = userEvent.setup()
    renderAt('/')
    await user.click(screen.getByRole('button', { name: 'Paste notes' }))
    await user.type(screen.getByLabelText('Paste your notes or study text'), 'Too short.')
    await user.click(screen.getByRole('button', { name: /Generate quiz/ }))
    expect(screen.getByRole('alert')).toHaveTextContent('Paste at least 30 words')

    await user.type(screen.getByLabelText('Paste your notes or study text'), ' word'.repeat(80))
    expect(screen.getByText(/We recommend up to 1 question/)).toBeInTheDocument()
  })

  it('generates a quiz, plays it while it streams, and shows results', async () => {
    setApiKey('anthropic', 'sk-ant-test')
    const { client, calls } = fakeClient({
      plan: { title: 'Volcano Basics', concepts: ['Magma vs lava', 'Ring of Fire'] },
      streams: [
        [
          mc(1, 'What is magma called once it reaches the surface?', 'Lava', [
            'Ash',
            'Basalt',
            'Pumice',
          ]),
          '\n',
          tf(2, 'Most active volcanoes are around the Pacific Ring of Fire.', true),
        ],
      ],
    })
    setClientFactoryForTests(async () => client)

    const user = userEvent.setup()
    const router = renderAt('/')
    await user.type(screen.getByLabelText('What do you want to be quizzed on?'), 'Volcanoes')
    await user.type(screen.getByLabelText(/Focus on/), 'eruptions')
    await user.click(screen.getByRole('radio', { name: '5' }))
    await user.click(screen.getByRole('button', { name: /Generate quiz/ }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/play'))
    expect(await screen.findByRole('heading', { name: /magma called/ })).toBeInTheDocument()
    expect(calls.json[0].prompt).toContain('<focus>eruptions</focus>')
    expect(calls.json[0].prompt).toContain('up to 5 questions')

    await user.click(screen.getByRole('button', { name: /Lava$/ }))
    await user.click(await screen.findByRole('button', { name: /Next question/ }))
    await user.click(await screen.findByRole('button', { name: /True$/ }))
    await user.click(await screen.findByRole('button', { name: /See results/ }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/results'))
    expect(await screen.findByRole('img', { name: /You scored 2 out of 2/ })).toBeInTheDocument()
    expect(screen.getByText(/supports 2 unique questions/)).toBeInTheDocument()
  })

  it('shows a friendly error and lets the user retry', async () => {
    setApiKey('anthropic', 'sk-ant-bad')
    const { client } = fakeClient({
      plan: Object.assign(new Error('invalid x-api-key'), { status: 401 }),
      streams: [],
    })
    setClientFactoryForTests(async () => client)

    const user = userEvent.setup()
    renderAt('/')
    await user.type(screen.getByLabelText('What do you want to be quizzed on?'), 'Volcanoes')
    await user.click(screen.getByRole('button', { name: /Generate quiz/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/API key was rejected/)
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(screen.getByText('invalid x-api-key')).toBeInTheDocument()
  })

  it('explains an empty API balance and links to billing', async () => {
    setApiKey('anthropic', 'sk-ant-empty')
    const { client } = fakeClient({
      plan: Object.assign(
        new Error('Your credit balance is too low to access the Anthropic API.'),
        { status: 400 },
      ),
      streams: [],
    })
    setClientFactoryForTests(async () => client)

    const user = userEvent.setup()
    renderAt('/')
    await user.type(screen.getByLabelText('What do you want to be quizzed on?'), 'Volcanoes')
    await user.click(screen.getByRole('button', { name: /Generate quiz/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/billed separately from Claude/)
    expect(screen.getByRole('link', { name: 'Open Anthropic API billing' })).toHaveAttribute(
      'href',
      'https://console.anthropic.com/settings/billing',
    )
  })
})
