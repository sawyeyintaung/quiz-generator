import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => {
  cleanup()
})

// Confetti needs a real canvas; tests only care that the UI flow works.
vi.mock('../lib/celebrate.ts', () => ({ burstFrom: vi.fn(), celebrate: vi.fn() }))
