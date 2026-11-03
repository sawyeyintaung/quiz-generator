import type { ZodType } from 'zod'
import { AiError } from './errors.ts'

/** Removes a surrounding Markdown code fence, which some models add around JSON. */
export function stripCodeFence(text: string): string {
  const match = text.trim().match(/^```[a-zA-Z]*\s*\n([\s\S]*?)\n?```$/)
  return match ? match[1] : text.trim()
}

export function parseJsonAs<T>(text: string, schema: ZodType<T>): T {
  let value: unknown
  try {
    value = JSON.parse(stripCodeFence(text))
  } catch {
    throw new AiError('invalid_output', 'Response was not valid JSON')
  }
  const result = schema.safeParse(value)
  if (!result.success) throw new AiError('invalid_output', result.error.message)
  return result.data
}

/**
 * Splits a text stream into complete lines as chunks arrive (for JSON Lines output).
 * Call `push` for each chunk and `flush` at the end.
 */
export class LineBuffer {
  private buffer = ''

  push(chunk: string): string[] {
    this.buffer += chunk
    const parts = this.buffer.split('\n')
    this.buffer = parts.pop() ?? ''
    return parts.map((l) => l.trim()).filter(Boolean)
  }

  flush(): string[] {
    const rest = this.buffer.trim()
    this.buffer = ''
    return rest ? [rest] : []
  }
}
