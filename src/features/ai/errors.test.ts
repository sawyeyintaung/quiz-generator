import { describe, expect, it } from 'vitest'
import { toAiError } from './errors.ts'

const apiError = (status: number, message = '', code?: string) =>
  Object.assign(new Error(message), { status, code })

describe('toAiError', () => {
  it.each([
    [apiError(401, 'invalid x-api-key'), 'auth'],
    [apiError(400, 'API key not valid. Please pass a valid API key.'), 'auth'],
    [apiError(429, 'You exceeded your current quota', 'insufficient_quota'), 'quota'],
    [apiError(400, 'Your credit balance is too low'), 'quota'],
    [apiError(429, 'Rate limit reached'), 'rate_limit'],
    [
      apiError(
        429,
        'RESOURCE_EXHAUSTED: You exceeded your current quota, please check your plan and billing details.',
      ),
      'rate_limit',
    ],
    [apiError(404, 'model: foo'), 'model'],
    [apiError(529, 'Overloaded'), 'overloaded'],
    [new TypeError('Failed to fetch'), 'network'],
    [Object.assign(new Error('aborted'), { name: 'AbortError' }), 'aborted'],
    [new Error('weird'), 'unknown'],
  ])('maps %s to %s', (error, kind) => {
    expect(toAiError(error).kind).toBe(kind)
  })

  it('gives a friendly message', () => {
    expect(toAiError(apiError(401)).message).toMatch(/API key was rejected/)
  })
})
