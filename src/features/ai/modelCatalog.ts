import { useEffect, useSyncExternalStore } from 'react'
import { createAiClient } from './createClient.ts'
import { isRetired, providers } from './providers.ts'
import type { ModelOption, ProviderId } from './types.ts'

/**
 * The models each provider lets this key use, fetched once per page session and shared
 * by Settings and the Create page. Listing models is free: it uses no API credit.
 */
const cache: Partial<Record<ProviderId, ModelOption[]>> = {}
const inflight = new Map<ProviderId, Promise<ModelOption[]>>()
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((l) => l())
}

export function getCachedModels(provider: ProviderId): ModelOption[] | undefined {
  return cache[provider]
}

export function setCachedModels(provider: ProviderId, models: ModelOption[]) {
  cache[provider] = models.filter((m) => !isRetired(provider, m.id))
  notify()
}

/** Fetches (once) the models this key can use. Errors are left to the caller. */
export function loadModels(provider: ProviderId, apiKey: string, model: string) {
  const pending = inflight.get(provider)
  if (pending) return pending
  const promise = createAiClient(provider, apiKey, model)
    .then((client) => client.listModels())
    .then((list) => {
      setCachedModels(provider, list)
      return getCachedModels(provider) ?? []
    })
    .finally(() => inflight.delete(provider))
  inflight.set(provider, promise)
  return promise
}

/** The list to show: fetched models (or the defaults), always including the current choice. */
export function modelOptions(provider: ProviderId, current: string): ModelOption[] {
  const list = cache[provider] ?? providers[provider].fallbackModels
  return list.some((m) => m.id === current) ? list : [{ id: current, label: current }, ...list]
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Model options for a provider. With a key, fetches the real list in the background the
 * first time (falling back quietly to the defaults if that fails).
 */
export function useModelOptions(provider: ProviderId, apiKey: string | undefined, current: string) {
  const fetched = useSyncExternalStore(
    subscribe,
    () => cache[provider],
    () => undefined,
  )
  useEffect(() => {
    if (apiKey && !cache[provider]) {
      loadModels(provider, apiKey, current).catch(() => undefined)
    }
    // Only when the provider or key changes; the current model doesn't affect the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, apiKey])
  return { options: modelOptions(provider, current), loaded: Boolean(fetched) }
}

export function clearModelCacheForTests() {
  for (const key of Object.keys(cache)) delete cache[key as ProviderId]
  notify()
}
