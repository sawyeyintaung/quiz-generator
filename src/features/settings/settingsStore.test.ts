import { beforeEach, describe, expect, it } from 'vitest'
import {
  activeCredentials,
  forgetAllKeys,
  getSettings,
  resetSettingsForTests,
  setApiKey,
  updateSettings,
} from './settingsStore.ts'

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  resetSettingsForTests()
})

describe('settings store', () => {
  it('replaces a saved model the provider has retired', () => {
    localStorage.setItem(
      'qg.settings.v1',
      JSON.stringify({ models: { google: 'gemini-2.5-flash' } }),
    )
    resetSettingsForTests()
    expect(getSettings().models.google).toBe('gemini-3.8-flash')
  })

  it('starts in copy & paste mode (no API key needed)', () => {
    expect(getSettings().mode).toBe('paste')
    updateSettings({ mode: 'api' })
    resetSettingsForTests()
    expect(getSettings().mode).toBe('api') // a chosen mode is remembered
  })

  it('keeps keys in sessionStorage by default, never localStorage', () => {
    setApiKey('anthropic', '  sk-ant-test  ')
    expect(sessionStorage.getItem('qg.apiKeys.v1')).toContain('sk-ant-test')
    expect(localStorage.getItem('qg.apiKeys.v1')).toBeNull()
    expect(localStorage.getItem('qg.settings.v1')).not.toContain('sk-ant')
    expect(activeCredentials(getSettings())).toEqual({
      provider: 'anthropic',
      apiKey: 'sk-ant-test',
      model: 'claude-haiku-5-5',
    })
  })

  it('moves keys to localStorage only when "remember" is on, and back when off', () => {
    setApiKey('openai', 'sk-1')
    updateSettings({ rememberKeys: true })
    expect(localStorage.getItem('qg.apiKeys.v1')).toContain('sk-1')
    expect(sessionStorage.getItem('qg.apiKeys.v1')).toBeNull()

    resetSettingsForTests()
    expect(getSettings().keys.openai).toBe('sk-1')

    updateSettings({ rememberKeys: false })
    expect(localStorage.getItem('qg.apiKeys.v1')).toBeNull()
    expect(sessionStorage.getItem('qg.apiKeys.v1')).toContain('sk-1')
  })

  it('forgets all keys', () => {
    setApiKey('google', 'AIza-1')
    forgetAllKeys()
    expect(getSettings().keys).toEqual({})
    expect(sessionStorage.getItem('qg.apiKeys.v1')).toBeNull()
  })

  it('has no credentials without a key for the active provider', () => {
    setApiKey('openai', 'sk-1')
    expect(activeCredentials(getSettings())).toBeUndefined() // provider is still anthropic
    updateSettings({ provider: 'openai' })
    expect(activeCredentials(getSettings())?.apiKey).toBe('sk-1')
  })
})
