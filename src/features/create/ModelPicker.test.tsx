import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../../app/routes.tsx'
import { createAiClient } from '../ai/createClient.ts'
import { clearModelCacheForTests } from '../ai/modelCatalog.ts'
import { setClientFactoryForTests } from '../generate/generationStore.ts'
import {
  getSettings,
  resetSettingsForTests,
  setApiKey,
  updateSettings,
} from '../settings/settingsStore.ts'
import { resetDraftForTests } from './draft.ts'
import { fakeClient, mc } from '../../test/fakeClient.ts'

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  resetSettingsForTests()
  resetDraftForTests()
  clearModelCacheForTests()
  updateSettings({ mode: 'api' })
})
afterEach(() => setClientFactoryForTests())

describe('model menu on the Create page', () => {
  it('lists the models the key can use and generates with the one picked', async () => {
    setApiKey('anthropic', 'sk-ant-test')
    const listing = fakeClient({
      plan: {},
      streams: [],
      models: [
        { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5' },
        { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5' },
        { id: 'claude-opus-5-5', label: 'Claude Opus 5.5' },
      ],
    })
    vi.mocked(createAiClient).mockResolvedValueOnce(listing.client)

    const generator = fakeClient({
      plan: { title: 'Volcanoes', concepts: ['Lava'] },
      streams: [
        [mc(1, 'What is magma called at the surface?', 'Lava', ['Ash', 'Basalt', 'Pumice'])],
      ],
    })
    const usedModels: string[] = []
    setClientFactoryForTests(async (c) => {
      usedModels.push(c.model)
      return generator.client
    })

    const user = userEvent.setup()
    render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/'] })} />)
    const menu = await screen.findByRole('combobox', { name: 'Model' })
    expect(menu).toHaveValue('claude-haiku-5-5')
    // The key's real model list arrives in the background.
    await within(menu).findByRole('option', { name: 'Claude Opus 5.5' })

    await user.selectOptions(menu, 'claude-opus-5-5')
    expect(getSettings().models.anthropic).toBe('claude-opus-5-5')

    await user.type(screen.getByLabelText('What do you want to be quizzed on?'), 'Volcanoes')
    await user.click(screen.getByRole('button', { name: /Generate quiz/ }))
    expect(await screen.findByRole('heading', { name: /magma called/ })).toBeInTheDocument()
    expect(usedModels).toEqual(['claude-opus-5-5'])
  })

  it('falls back to the default list if the model list cannot be fetched', async () => {
    setApiKey('anthropic', 'sk-ant-test')
    render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/'] })} />)
    const menu = await screen.findByRole('combobox', { name: 'Model' })
    expect(
      within(menu)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual([
      'Claude Haiku 5.5 (fast, low cost)',
      'Claude Sonnet 5.5',
      'Claude Opus 5.5 (most capable)',
    ])
  })

  it('is not shown in copy & paste mode', async () => {
    setApiKey('anthropic', 'sk-ant-test')
    updateSettings({ mode: 'paste' })
    render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/'] })} />)
    await screen.findByRole('button', { name: /Get instructions/ })
    expect(screen.queryByRole('combobox', { name: 'Model' })).not.toBeInTheDocument()
  })
})
