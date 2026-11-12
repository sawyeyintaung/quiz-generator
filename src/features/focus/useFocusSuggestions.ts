import { useEffect, useMemo, useState } from 'react'
import { createAiClient } from '../ai/createClient.ts'
import type { Credentials } from '../generate/generationStore.ts'
import {
  aiSuggestions,
  canSuggest,
  structuralSuggestions,
  type FocusInput,
  type FocusSuggestion,
} from './suggest.ts'

export type SuggestionState =
  | { status: 'none' } // too small, no source, or not available in this mode
  | { status: 'available' } // AI suggestions can be requested by the user
  | { status: 'loading' }
  | { status: 'ready'; suggestions: FocusSuggestion[]; from: 'structure' | 'ai' }
  | { status: 'error' }

type Options = {
  /** Present when suggestions may come from the AI (API mode with a key). */
  credentials?: Credentials
  /** Fetch AI suggestions without the user asking. */
  auto: boolean
}

const TYPING_DELAY_MS = 900

// Tests can swap in a fake client.
let clientFactory = (c: Credentials) => createAiClient(c.provider, c.apiKey, c.model)
export function setSuggestionClientForTests(factory?: typeof clientFactory) {
  clientFactory = factory ?? ((c) => createAiClient(c.provider, c.apiKey, c.model))
}

/**
 * Focus-area suggestions for the current source. Uses the document's own
 * headings/bookmarks when it has them (free), otherwise asks the AI, which is
 * debounced while typing and cached per source.
 */
export function useFocusSuggestions(
  input: FocusInput | undefined,
  inputKey: string,
  { credentials, auto }: Options,
): { state: SuggestionState; request: () => void } {
  const structural = useMemo(
    () => (input && canSuggest(input) ? structuralSuggestions(input) : []),
    // inputKey identifies the source; `input` itself is rebuilt each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inputKey],
  )
  const eligible = Boolean(input && canSuggest(input))
  const aiAllowed = eligible && structural.length === 0 && Boolean(credentials)
  const [requestedKey, setRequestedKey] = useState<string>()
  const wantAi = aiAllowed && (auto || requestedKey === inputKey)
  const [result, setResult] = useState<{ key: string; state: SuggestionState }>()

  const credentialKey = credentials
    ? `${credentials.provider}:${credentials.model}:${credentials.apiKey.length}`
    : ''

  useEffect(() => {
    if (!wantAi || !input || !credentials) return
    const controller = new AbortController()
    const delay = input.kind === 'file' ? 0 : TYPING_DELAY_MS
    const timer = window.setTimeout(async () => {
      try {
        const client = await clientFactory(credentials)
        const suggestions = await aiSuggestions(client, input, controller.signal)
        if (!controller.signal.aborted) {
          setResult({ key: inputKey, state: { status: 'ready', suggestions, from: 'ai' } })
        }
      } catch {
        if (!controller.signal.aborted) setResult({ key: inputKey, state: { status: 'error' } })
      }
    }, delay)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
    // Re-run only when the source, the trigger or the credentials change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantAi, inputKey, credentialKey])

  let state: SuggestionState
  if (!eligible) state = { status: 'none' }
  else if (structural.length > 0)
    state = { status: 'ready', suggestions: structural, from: 'structure' }
  else if (!aiAllowed) state = { status: 'none' }
  else if (result?.key === inputKey) state = result.state
  else state = wantAi ? { status: 'loading' } : { status: 'available' }

  return { state, request: () => setRequestedKey(inputKey) }
}
