import { useSyncExternalStore } from 'react'
import { providerIds, providers } from '../ai/providers.ts'
import type { ProviderId } from '../ai/types.ts'

/** 'api': call an AI provider with the user's key. 'paste': copy instructions into
 *  Claude Code / claude.ai / ChatGPT and paste the reply back (uses the user's subscription). */
export type GenerationMode = 'api' | 'paste'

export type Settings = {
  mode: GenerationMode
  provider: ProviderId
  /** Chosen model per provider. */
  models: Record<ProviderId, string>
  /** API key per provider (kept only in this browser). */
  keys: Partial<Record<ProviderId, string>>
  /** Keep keys after the tab closes (localStorage instead of sessionStorage). */
  rememberKeys: boolean
  /** Automatically ask the AI for focus-area suggestions (uses a little of the user's credit). */
  autoSuggest: boolean
}

const PREFS_KEY = 'qg.settings.v1'
const KEYS_KEY = 'qg.apiKeys.v1'

const defaultSettings: Settings = {
  mode: 'api',
  provider: 'anthropic',
  models: Object.fromEntries(providerIds.map((id) => [id, providers[id].defaultModel])) as Record<
    ProviderId,
    string
  >,
  keys: {},
  rememberKeys: false,
  autoSuggest: true,
}

// Storage can be unavailable (private mode, blocked site data); never let that break the app.
function read(storage: () => Storage, key: string): unknown {
  try {
    const raw = storage().getItem(key)
    return raw ? JSON.parse(raw) : undefined
  } catch {
    return undefined
  }
}

function write(storage: () => Storage, key: string, value: unknown | undefined) {
  try {
    if (value === undefined) storage().removeItem(key)
    else storage().setItem(key, JSON.stringify(value))
  } catch {
    // Ignore: settings then last only for this page view.
  }
}

const local = () => window.localStorage
const session = () => window.sessionStorage

function isProvider(value: unknown): value is ProviderId {
  return typeof value === 'string' && (providerIds as string[]).includes(value)
}

function cleanKeys(value: unknown): Settings['keys'] {
  if (typeof value !== 'object' || value === null) return {}
  const keys: Settings['keys'] = {}
  for (const id of providerIds) {
    const k = (value as Record<string, unknown>)[id]
    if (typeof k === 'string' && k.trim()) keys[id] = k.trim()
  }
  return keys
}

function load(): Settings {
  const prefs = read(local, PREFS_KEY) as Partial<Settings> | undefined
  const rememberKeys = prefs?.rememberKeys === true
  const models = { ...defaultSettings.models }
  for (const id of providerIds) {
    const m = prefs?.models?.[id]
    if (typeof m === 'string' && m) models[id] = m
  }
  return {
    mode: prefs?.mode === 'paste' ? 'paste' : 'api',
    provider: isProvider(prefs?.provider) ? prefs.provider : defaultSettings.provider,
    models,
    rememberKeys,
    autoSuggest: prefs?.autoSuggest !== false,
    keys: cleanKeys(read(rememberKeys ? local : session, KEYS_KEY)),
  }
}

function persist(s: Settings) {
  write(local, PREFS_KEY, {
    mode: s.mode,
    provider: s.provider,
    models: s.models,
    rememberKeys: s.rememberKeys,
    autoSuggest: s.autoSuggest,
  })
  const hasKeys = Object.keys(s.keys).length > 0
  // Keys live in exactly one place, and never in localStorage unless the user opted in.
  write(s.rememberKeys ? local : session, KEYS_KEY, hasKeys ? s.keys : undefined)
  write(s.rememberKeys ? session : local, KEYS_KEY, undefined)
}

let current: Settings | undefined
const listeners = new Set<() => void>()

export function getSettings(): Settings {
  current ??= load()
  return current
}

export function updateSettings(change: Partial<Settings> | ((s: Settings) => Partial<Settings>)) {
  const prev = getSettings()
  const patch = typeof change === 'function' ? change(prev) : change
  current = { ...prev, ...patch }
  persist(current)
  listeners.forEach((l) => l())
}

export function setApiKey(provider: ProviderId, key: string) {
  updateSettings((s) => {
    const keys = { ...s.keys }
    if (key.trim()) keys[provider] = key.trim()
    else delete keys[provider]
    return { keys }
  })
}

export function forgetAllKeys() {
  updateSettings({ keys: {} })
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings, getSettings)
}

/** The active provider's key and model, or undefined if no key is set. */
export function activeCredentials(s: Settings) {
  const apiKey = s.keys[s.provider]
  return apiKey ? { provider: s.provider, apiKey, model: s.models[s.provider] } : undefined
}

/** For tests: reset in-memory state so the next read comes from storage. */
export function resetSettingsForTests() {
  current = undefined
}
