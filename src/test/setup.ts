import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => {
  cleanup()
})

// Confetti needs a real canvas; tests only care that the UI flow works.
vi.mock('../lib/celebrate.ts', () => ({ burstFrom: vi.fn(), celebrate: vi.fn() }))

// Tests never talk to real AI providers; individual tests supply fake clients.
vi.mock('../features/ai/createClient.ts', () => ({
  createAiClient: vi.fn(async () => {
    throw new Error('No real AI providers in tests')
  }),
}))
