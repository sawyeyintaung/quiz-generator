export type AiErrorKind =
  | 'auth'
  | 'quota'
  | 'rate_limit'
  | 'model'
  | 'overloaded'
  | 'network'
  | 'refusal'
  | 'truncated'
  | 'invalid_output'
  | 'empty_source'
  | 'source_exhausted'
  | 'url_unsupported'
  | 'url_failed'
  | 'aborted'
  | 'unknown'

const messages: Record<AiErrorKind, string> = {
  auth: 'Your API key was rejected. Check that it is correct and active in Settings.',
  quota:
    "Your API account has no remaining credit. API usage is billed separately from Claude, ChatGPT or Gemini subscriptions, so add credit on your provider's API billing page and try again.",
  rate_limit:
    "You've hit your provider's rate limit or usage quota. Wait a minute and try again. If it keeps happening, check your plan's limits with your provider.",
  model: 'This model is not available for your API key. Pick another model in Settings.',
  overloaded: 'The AI provider is busy or having problems. Try again in a minute.',
  network:
    'Could not reach the AI provider. Check your internet connection, and that no browser extension is blocking the request.',
  refusal: 'The AI declined to write questions for this content. Try a different topic or text.',
  truncated: 'The AI response was cut off before it finished. Try fewer questions.',
  invalid_output: 'The AI returned something we could not read. Please try again.',
  empty_source:
    "We couldn't find anything to write questions about. Try a broader topic, more text, or a different focus.",
  source_exhausted:
    "You've covered every idea in this source. Try a new source, a different focus, or replay your quizzes from History.",
  url_unsupported:
    "This AI provider can't read web pages. Switch to Claude or Gemini in Settings, or copy the page text and use Paste notes.",
  url_failed:
    "The AI couldn't read that web page (it may need a login, block bots, or not exist). Copy the page text and use Paste notes instead.",
  aborted: 'Generation was cancelled.',
  unknown: 'Something went wrong while talking to the AI provider.',
}

/** A provider-neutral error with a friendly, user-facing message. */
export class AiError extends Error {
  readonly kind: AiErrorKind
  readonly detail?: string

  constructor(kind: AiErrorKind, detail?: string) {
    super(messages[kind])
    this.name = 'AiError'
    this.kind = kind
    this.detail = detail
  }
}

function isAbort(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return error.name === 'AbortError' || error.name === 'APIUserAbortError'
}

/**
 * Maps errors from any provider SDK onto AiError. All three SDKs expose an HTTP
 * `status` on API errors; network failures surface as connection/TypeErrors.
 */
export function toAiError(error: unknown): AiError {
  if (error instanceof AiError) return error
  if (isAbort(error)) return new AiError('aborted')

  const e = error as { status?: unknown; code?: unknown; message?: unknown; name?: unknown }
  const status = typeof e.status === 'number' ? e.status : undefined
  const text = `${String(e.code ?? '')} ${String(e.message ?? '')}`.toLowerCase()
  const detail = typeof e.message === 'string' ? e.message : undefined

  if (status === 401 || status === 403) {
    // Google returns 400/403 for bad keys; OpenAI and Anthropic return 401.
    return new AiError('auth', detail)
  }
  if (status === 400 && /api[ _]?key/.test(text)) return new AiError('auth', detail)
  // Only clear "out of credit" signals. A plain 429 that mentions "quota" (e.g. Gemini's
  // per-minute free-tier limits) is a temporary rate limit, not an empty balance.
  if (status === 402 || /insufficient_quota|credit balance/.test(text)) {
    return new AiError('quota', detail)
  }
  if (status === 429) return new AiError('rate_limit', detail)
  if (status === 404 || /model.*(not found|does not exist|not supported)/.test(text)) {
    return new AiError('model', detail)
  }
  if (status !== undefined && status >= 500) return new AiError('overloaded', detail)
  if (
    status === undefined &&
    (e.name === 'APIConnectionError' ||
      e.name === 'APIConnectionTimeoutError' ||
      error instanceof TypeError)
  ) {
    return new AiError('network', detail)
  }
  return new AiError('unknown', detail)
}
