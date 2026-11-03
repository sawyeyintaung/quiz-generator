import type { ModelOption, ProviderId, ProviderInfo } from './types.ts'

export const providers: Record<ProviderId, ProviderInfo> = {
  anthropic: {
    id: 'anthropic',
    name: 'Claude',
    company: 'Anthropic',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    keyPlaceholder: 'sk-ant-...',
    defaultModel: 'claude-haiku-5-5',
    fallbackModels: [
      { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (fast, low cost)' },
      { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5' },
      { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (most capable)' },
    ],
  },
  openai: {
    id: 'openai',
    name: 'GPT',
    company: 'OpenAI',
    keyUrl: 'https://platform.openai.com/api-keys',
    keyPlaceholder: 'sk-...',
    defaultModel: 'gpt-5-mini',
    fallbackModels: [{ id: 'gpt-5-mini', label: 'gpt-5-mini' }],
  },
  google: {
    id: 'google',
    name: 'Gemini',
    company: 'Google',
    keyUrl: 'https://aistudio.google.com/apikey',
    keyPlaceholder: 'AIza...',
    defaultModel: 'gemini-2.5-flash',
    fallbackModels: [{ id: 'gemini-2.5-flash', label: 'gemini-2.5-flash' }],
  },
}

export const providerIds = Object.keys(providers) as ProviderId[]

/**
 * Chooses a sensible default from the models a key can actually use:
 * the preferred model if listed, otherwise the newest-looking fast/cheap one.
 */
export function pickDefaultModel(provider: ProviderId, models: ModelOption[]): string | undefined {
  const ids = models.map((m) => m.id)
  const preferred = providers[provider].defaultModel
  if (ids.includes(preferred)) return preferred
  const cheap: Record<ProviderId, RegExp> = {
    anthropic: /haiku/,
    openai: /mini/,
    google: /flash(?!.*(lite|image|tts|live|audio))/,
  }
  const candidates = ids.filter((id) => cheap[provider].test(id)).sort(compareVersionsDesc)
  return candidates[0] ?? ids[0]
}

/** Sorts ids so higher embedded version numbers come first (e.g. "x-3-0" before "x-2-5"). */
function compareVersionsDesc(a: string, b: string): number {
  const nums = (s: string) => (s.match(/\d+/g) ?? []).map(Number)
  const [na, nb] = [nums(a), nums(b)]
  for (let i = 0; i < Math.max(na.length, nb.length); i++) {
    const diff = (nb[i] ?? -1) - (na[i] ?? -1)
    if (diff !== 0) return diff
  }
  return a.localeCompare(b)
}
