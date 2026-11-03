import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { routes } from '../app/routes.tsx'
import { resetDraftForTests } from '../features/create/draft.ts'
import { clearSuggestionCacheForTests } from '../features/focus/suggest.ts'
import { setSuggestionClientForTests } from '../features/focus/useFocusSuggestions.ts'
import { setClientFactoryForTests } from '../features/generate/generationStore.ts'
import {
  resetSettingsForTests,
  setApiKey,
  updateSettings,
} from '../features/settings/settingsStore.ts'
import { fakeClient, mc } from '../test/fakeClient.ts'

const words = (n: number, w: string) => Array(n).fill(w).join(' ')

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
  clearSuggestionCacheForTests()
})
afterEach(() => {
  setClientFactoryForTests()
  setSuggestionClientForTests()
})

describe('Create page sources and focus suggestions', () => {
  it('uploads a Markdown file, suggests its sections, and quizzes on the picked one', async () => {
    setApiKey('anthropic', 'sk-ant-test')
    const { client, calls } = fakeClient({
      plan: { title: 'Mitosis', concepts: ['Prophase'] },
      streams: [
        [
          mc(1, 'What happens first in mitosis?', 'Prophase', [
            'Anaphase',
            'Telophase',
            'Metaphase',
          ]),
        ],
      ],
    })
    setClientFactoryForTests(async () => client)
    const user = userEvent.setup()
    renderAt('/')

    await user.click(screen.getByRole('button', { name: 'File' }))
    const md = `# Cell structure\n${words(200, 'membrane')}\n# Mitosis\n${words(200, 'prophase')}`
    await user.upload(
      screen.getByLabelText('Upload a PDF, Word or text file'),
      new File([md], 'biology.md', { type: 'text/markdown' }),
    )
    expect(await screen.findByText('📄 biology.md')).toBeInTheDocument()
    expect(screen.getByText(/from your document/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Mitosis/ }))
    expect(screen.getByLabelText(/Focus on/)).toHaveValue('Mitosis')
    expect(screen.getByRole('button', { name: /^Mitosis/ })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: /Generate quiz/ }))
    expect(
      await screen.findByRole('heading', { name: 'What happens first in mitosis?' }),
    ).toBeInTheDocument()
    expect(calls.json[0].prompt).toContain('<source type="study material">\n# Cell structure')
    expect(calls.json[0].prompt).toContain('<focus>Mitosis</focus>')
  })

  it('auto-suggests subtopics for a broad topic using the AI', async () => {
    setApiKey('anthropic', 'sk-ant-test')
    const { client, calls } = fakeClient({
      plan: {
        suggestions: [
          {
            title: 'Causes',
            description: 'Why it started',
            fromPage: null,
            toPage: null,
            estimatedQuestions: 8,
          },
          {
            title: 'Pacific War',
            description: 'Asia and the Pacific',
            fromPage: null,
            toPage: null,
            estimatedQuestions: 10,
          },
        ],
      },
      streams: [],
    })
    setSuggestionClientForTests(async () => client)
    const user = userEvent.setup()
    renderAt('/')
    await user.type(screen.getByLabelText('What do you want to be quizzed on?'), 'World War II')
    expect(
      await screen.findByRole('button', { name: /^Pacific War/ }, { timeout: 3000 }),
    ).toBeInTheDocument()
    expect(calls.json).toHaveLength(1)
    expect(calls.json[0].prompt).toContain('Suggest 4 to 8 subtopics')

    await user.click(screen.getByRole('button', { name: /^Causes/ }))
    await user.click(screen.getByRole('button', { name: /^Pacific War/ }))
    expect(screen.getByLabelText(/Focus on/)).toHaveValue('Causes; Pacific War')
    await user.click(screen.getByRole('button', { name: /^Whole source/ }))
    expect(screen.getByLabelText(/Focus on/)).toHaveValue('')
  })

  it('offers suggestions on request when auto-suggest is off', async () => {
    setApiKey('anthropic', 'sk-ant-test')
    updateSettings({ autoSuggest: false })
    const { client, calls } = fakeClient({ plan: { suggestions: [] }, streams: [] })
    setSuggestionClientForTests(async () => client)
    const user = userEvent.setup()
    renderAt('/')
    await user.type(screen.getByLabelText('What do you want to be quizzed on?'), 'Volcanoes')
    const button = await screen.findByRole('button', { name: /Suggest focus areas/ })
    expect(calls.json).toHaveLength(0)
    await user.click(button)
    // An already-narrow topic: the AI returns nothing, and nothing is shown.
    await screen.findByText('Finding focus areas…')
    await new Promise((r) => setTimeout(r, 1100))
    expect(calls.json).toHaveLength(1)
    expect(screen.queryByText(/Suggested focus areas/)).not.toBeInTheDocument()
  })

  it('validates links and explains providers that cannot read them', async () => {
    setApiKey('openai', 'sk-test')
    updateSettings({ provider: 'openai' })
    const user = userEvent.setup()
    renderAt('/')
    await user.click(screen.getByRole('button', { name: 'Link' }))
    await user.type(screen.getByLabelText('Web page address'), 'not a url')
    await user.click(screen.getByRole('button', { name: /Generate quiz/ }))
    expect(screen.getByRole('alert')).toHaveTextContent('starting with https://')
    await user.clear(screen.getByLabelText('Web page address'))
    await user.type(screen.getByLabelText('Web page address'), 'https://example.com/page')
    expect(screen.getByRole('alert')).toHaveTextContent("GPT can't read web pages")
  })
})
