import type { ModelOption, ProviderId, ProviderInfo } from './types.ts'

export const providers: Record<ProviderId, ProviderInfo> = {
  anthropic: {
    id: 'anthropic',
    name: 'Claude',
    company: 'Anthropic',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    billingUrl: 'https://console.anthropic.com/settings/billing',
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
    billingUrl: 'https://platform.openai.com/settings/organization/billing',
    keyPlaceholder: 'sk-...',
    defaultModel: 'gpt-5-mini',
    fallbackModels: [{ id: 'gpt-5-mini', label: 'gpt-5-mini' }],
  },
  google: {
    id: 'google',
    name: 'Gemini',
    company: 'Google',
    keyUrl: 'https://aistudio.google.com/apikey',
    billingUrl: 'https://aistudio.google.com/usage',
    keyPlaceholder: 'AIza...',
    defaultModel: 'gemini-3.8-flash',
    fallbackModels: [{ id: 'gemini-3.8-flash', label: 'gemini-3.8-flash' }],
  },
}

export const providerIds = Object.keys(providers) as ProviderId[]

/**
 * Models the providers have retired (at least for new users). A saved choice of one of
 * these is replaced by the provider's default, and they are never picked automatically.
 */
export const retiredModels: Record<ProviderId, string[]> = {
  anthropic: [],
  openai: [],
  google: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'],
}

export const isRetired = (provider: ProviderId, model: string) =>
  retiredModels[provider].includes(model)

/**
 * Chooses a sensible default from the models a key can actually use:
 * the preferred model if listed, otherwise the newest-looking fast/cheap one.
 */
export function pickDefaultModel(provider: ProviderId, models: ModelOption[]): string | undefined {
  const ids = models.map((m) => m.id).filter((id) => !isRetired(provider, id))
  const preferred = providers[provider].defaultModel
  const cheap: Record<ProviderId, RegExp> = {
    anthropic: /haiku/,
    openai: /mini/,
    google: /flash(?!.*(lite|image|tts|live|audio))/,
  }
  const matching = ids.filter((id) => cheap[provider].test(id))
  // Prefer stable releases over previews/experiments when there is a choice.
  const stable = matching.filter((id) => !/preview|exp/.test(id))
  const candidates = (stable.length ? stable : matching).sort(compareVersionsDesc)
  const newest = candidates[0]
  // Use our preferred model unless the key offers a newer fast model.
  if (ids.includes(preferred) && (!newest || compareVersionsDesc(newest, preferred) >= 0)) {
    return preferred
  }
  return newest ?? ids[0]
}

/** If a provider's error names a replacement model ("use models/x"), returns it. */
export function suggestedReplacement(detail: string | undefined): string | undefined {
  return detail?.match(/use (?:models\/)?([a-z0-9][a-z0-9.-]*[a-z0-9])\b/i)?.[1]
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
