import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../app/routes.tsx'
import { resetDraftForTests } from '../features/create/draft.ts'
import { setClientFactoryForTests } from '../features/generate/generationStore.ts'
import { db } from '../features/history/db.ts'
import {
  resetSettingsForTests,
  setApiKey,
  updateSettings,
} from '../features/settings/settingsStore.ts'
import { fakeClient, mc } from '../test/fakeClient.ts'

// Distinct questions (similar wording would be removed as duplicates).
const prompts = [
  'What is molten rock called once it reaches the surface?',
  'Which gas makes up most volcanic emissions?',
  'What forms when a volcano collapses into its emptied magma chamber?',
  'Which ocean is ringed by the most active volcanoes?',
]
const q = (n: number, concept: number) =>
  mc(concept, prompts[n - 1], `Answer ${n}`, [`Wrong ${n}a`, `Wrong ${n}b`, `Wrong ${n}c`])

async function answerAll(user: ReturnType<typeof userEvent.setup>, count: number) {
  for (let i = 1; i <= count; i++) {
    await user.click(await screen.findByRole('button', { name: /Answer \d+$/ }))
    await user.click(await screen.findByRole('button', { name: /next question|see results/i }))
  }
}

beforeEach(async () => {
  localStorage.clear()
  sessionStorage.clear()
  resetSettingsForTests()
  resetDraftForTests()
  await db.quizzes.clear()
  await db.attempts.clear()
  await db.sources.clear()
})
afterEach(() => setClientFactoryForTests())

describe('questions left in a source', () => {
  it('API mode: shows what is left, continues without repeats, then reports full coverage', async () => {
    updateSettings({ mode: 'api' })
    setApiKey('anthropic', 'sk-ant-test')
    const { client, calls } = fakeClient({
      plan: {},
      jsonReplies: [
        { title: 'Volcanoes', totalIdeas: 4, concepts: ['Lava', 'Magma'] },
        { title: 'Volcanoes 2', totalIdeas: 4, concepts: ['Ash', 'Calderas'] },
        { title: 'Volcanoes 3', totalIdeas: 4, concepts: [] },
      ],
      streams: [[`${q(1, 1)}\n${q(2, 2)}`], [`${q(3, 1)}\n${q(4, 2)}`]],
    })
    setClientFactoryForTests(async () => client)

    const user = userEvent.setup()
    const router = createMemoryRouter(routes, { initialEntries: ['/'] })
    render(<RouterProvider router={router} />)
    await user.type(screen.getByLabelText('What do you want to be quizzed on?'), 'Volcanoes')
    await user.click(screen.getByRole('radio', { name: '5' }))
    await user.click(screen.getByRole('button', { name: /Generate quiz/ }))
    await answerAll(user, 2)

    expect(await screen.findByText('Covered 2 of about 4 ideas · about 2 left')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next 2 questions (no repeats)' }))

    // The next plan is told what was covered, and the next write step what was asked.
    await waitFor(() => expect(calls.json).toHaveLength(2))
    expect(calls.json[1].prompt).toContain('- Lava')
    expect(calls.json[1].prompt).toContain('- Magma')
    expect(calls.json[1].prompt).toContain('up to 2 questions')
    await waitFor(() => expect(calls.stream).toHaveLength(2))
    expect(calls.stream[1].prompt).toContain(`- ${prompts[0]}`)

    await answerAll(user, 2)
    expect(await screen.findByText('Covered all 4 ideas in this source')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Next \d+ question/ })).not.toBeInTheDocument()

    // History shows the same line on each quiz from this source.
    await user.click(screen.getByRole('link', { name: 'History' }))
    await waitFor(() =>
      expect(screen.getAllByText('Covered all 4 ideas in this source')).toHaveLength(2),
    )
  })

  it('API mode: the AI reporting nothing new left marks the source as covered', async () => {
    updateSettings({ mode: 'api' })
    setApiKey('anthropic', 'sk-ant-test')
    const { client } = fakeClient({
      plan: {},
      jsonReplies: [
        { title: 'Volcanoes', totalIdeas: 10, concepts: ['Lava', 'Magma'] },
        { title: 'Volcanoes 2', totalIdeas: 10, concepts: [] },
      ],
      streams: [[`${q(1, 1)}\n${q(2, 2)}`]],
    })
    setClientFactoryForTests(async () => client)

    const user = userEvent.setup()
    render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/'] })} />)
    await user.type(screen.getByLabelText('What do you want to be quizzed on?'), 'Volcanoes')
    await user.click(screen.getByRole('radio', { name: '5' }))
    await user.click(screen.getByRole('button', { name: /Generate quiz/ }))
    await answerAll(user, 2)
    await user.click(await screen.findByRole('button', { name: 'Next 5 questions (no repeats)' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("You've covered every idea")
    await waitFor(async () => expect((await db.sources.toArray())[0].exhausted).toBe(true))
  })

  it('copy & paste mode: reads the count from the reply and lists covered ideas next time', async () => {
    const writeText = vi.spyOn(navigator.clipboard, 'writeText')
    const user = userEvent.setup()
    const router = createMemoryRouter(routes, { initialEntries: ['/'] })
    render(<RouterProvider router={router} />)
    await user.type(screen.getByLabelText('What do you want to be quizzed on?'), 'Volcanoes')
    await user.click(screen.getByRole('radio', { name: '5' }))
    await user.click(screen.getByRole('button', { name: /Get instructions/ }))

    const label = (json: string, concept: string) =>
      JSON.stringify({ ...JSON.parse(json), concept })
    const reply = `\`\`\`json\n{"title": "Volcanoes", "totalIdeas": 12, "questions": [${label(q(1, 1), 'Lava')}, ${label(q(2, 2), 'Magma')}]}\n\`\`\``
    await user.click(await screen.findByLabelText('Paste the reply here'))
    await user.paste(reply)
    await user.click(screen.getByRole('button', { name: /Start quiz/ }))
    await answerAll(user, 2)

    expect(
      await screen.findByText('Covered 2 of about 12 ideas · about 10 left'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next 5 questions (no repeats)' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/paste'))
    await user.click(await screen.findByRole('button', { name: 'Copy instructions' }))
    const instructions = writeText.mock.calls.at(-1)?.[0] ?? ''
    expect(instructions).toContain('already covered these ideas')
    expect(instructions).toContain('- Lava')
    expect(instructions).toContain('- Magma')
  })
})
