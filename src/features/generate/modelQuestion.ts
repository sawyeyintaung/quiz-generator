import { questionSchema, type Question } from '../quiz/schema.ts'
import type { GenerationRequest } from './types.ts'

/** Validates one model-written question and shuffles multiple-choice options. */
export function toQuestion(
  raw: Record<string, unknown>,
  id: string,
  req: GenerationRequest,
  random: () => number,
): Question | undefined {
  const result = questionSchema.safeParse({ ...raw, id })
  if (!result.success) return undefined
  const q = result.data
  if (!req.types.includes(q.type)) return undefined
  if (q.type === 'true_false') return q
  // Options must be distinct, and the correct answer's position should not be predictable.
  const options = q.options.map((o) => o.trim())
  if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) return undefined
  const order = shuffle([0, 1, 2, 3], random)
  return {
    ...q,
    options: order.map((i) => options[i]),
    correctIndex: order.indexOf(q.correctIndex),
  }
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
