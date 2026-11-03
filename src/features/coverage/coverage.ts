import { recommendedMaxQuestions } from '../generate/source.ts'
import type { GenerationRequest } from '../generate/types.ts'
import type { StoredSource } from '../history/db.ts'

export type Coverage = {
  covered: number
  /** Estimated distinct ideas in the source (undefined when nobody could estimate). */
  total?: number
  /** Estimated ideas not yet quizzed. */
  left?: number
  exhausted: boolean
}

/** The app's own estimate from the text it has (notes and files only): ~1 idea per 70 words. */
function localEstimate(request: StoredSource['request']): number | undefined {
  const src = request.source
  if (src.kind !== 'text' && src.kind !== 'file') return undefined
  return recommendedMaxQuestions(src.text)
}

/**
 * Combines the AI's estimate with the app's own. When they disagree a lot (more than 2×),
 * the smaller one is shown, so "left" is never wildly optimistic.
 */
export function computeCoverage(source: StoredSource): Coverage {
  const covered = source.covered.length
  const ai = source.totalIdeas && source.totalIdeas > 0 ? source.totalIdeas : undefined
  const local = localEstimate(source.request)
  let total = ai ?? local
  if (ai && local && Math.max(ai, local) / Math.min(ai, local) > 2) total = Math.min(ai, local)
  if (total !== undefined) total = Math.max(total, covered)
  const exhausted = source.exhausted || (total !== undefined && total - covered <= 0)
  return {
    covered,
    total,
    left: exhausted ? 0 : total !== undefined ? total - covered : undefined,
    exhausted,
  }
}

/** The request for the next batch: same source and settings, skipping what was covered. */
export function nextBatchRequest(source: StoredSource, coverage: Coverage): GenerationRequest {
  const count =
    coverage.left !== undefined
      ? Math.max(1, Math.min(source.request.count, coverage.left))
      : source.request.count
  return {
    ...source.request,
    count,
    sourceId: source.id,
    avoid: { concepts: source.covered, prompts: source.prompts },
  }
}
