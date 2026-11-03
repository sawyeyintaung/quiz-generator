import { useSyncExternalStore } from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'
export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'qg.theme'
const darkQuery = () => window.matchMedia?.('(prefers-color-scheme: dark)')

function readPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system'
  }
}

let preference: ThemePreference = typeof window === 'undefined' ? 'system' : readPreference()
const listeners = new Set<() => void>()

export function resolvedTheme(pref = preference): Theme {
  if (pref !== 'system') return pref
  return darkQuery()?.matches ? 'dark' : 'light'
}

/** Applies the theme to <html>: CSS tokens, native form controls and the browser UI colour. */
export function applyTheme() {
  const root = document.documentElement
  const theme = resolvedTheme()
  if (preference === 'system') root.removeAttribute('data-theme')
  else root.dataset.theme = preference
  root.style.colorScheme = theme
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#0f0f1a' : '#5a36f0')
}

export function setThemePreference(next: ThemePreference) {
  preference = next
  try {
    if (next === 'system') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // Storage blocked: the choice lasts for this visit only.
  }
  applyTheme()
  listeners.forEach((l) => l())
}

/** Call once at startup, before the first render, so there is no flash of the wrong theme. */
export function initTheme() {
  preference = readPreference()
  applyTheme()
  // Follow the device while the preference is "system".
  darkQuery()?.addEventListener?.('change', () => {
    if (preference === 'system') {
      applyTheme()
      listeners.forEach((l) => l())
    }
  })
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Current preference and the theme actually shown. */
export function useTheme(): { preference: ThemePreference; theme: Theme } {
  const pref = useSyncExternalStore(
    subscribe,
    () => preference,
    () => 'system' as const,
  )
  const theme = useSyncExternalStore(
    subscribe,
    () => resolvedTheme(),
    () => 'light' as const,
  )
  return { preference: pref, theme }
}
