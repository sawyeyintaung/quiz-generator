import { describe, expect, it } from 'vitest'
import { pickDefaultModel } from './providers.ts'

const m = (...ids: string[]) => ids.map((id) => ({ id, label: id }))

describe('pickDefaultModel', () => {
  it('uses the preferred model when the key can use it', () => {
    expect(pickDefaultModel('anthropic', m('claude-opus-5-5', 'claude-haiku-5-5'))).toBe(
      'claude-haiku-5-5',
    )
  })

  it('otherwise picks the newest fast model', () => {
    expect(pickDefaultModel('openai', m('gpt-4o', 'gpt-4.1-mini', 'gpt-6-mini', 'gpt-6'))).toBe(
      'gpt-6-mini',
    )
    expect(
      pickDefaultModel(
        'google',
        m('gemini-3.0-pro', 'gemini-3.0-flash', 'gemini-3.0-flash-lite', 'gemini-2.0-flash'),
      ),
    ).toBe('gemini-3.0-flash')
  })

  it('falls back to the first model, or undefined for an empty list', () => {
    expect(pickDefaultModel('openai', m('o9'))).toBe('o9')
    expect(pickDefaultModel('openai', [])).toBeUndefined()
  })
})
