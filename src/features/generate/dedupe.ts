import { correctAnswerText, type Question } from '../quiz/schema.ts'

const stopWords = new Set(
  'a an the of to in on at for and or is are was were be been by with as that this which what who whom whose when where why how does do did true false following'.split(
    ' ',
  ),
)

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function words(text: string): Set<string> {
  return new Set(
    normalize(text)
      .split(' ')
      .filter((w) => w && !stopWords.has(w)),
  )
}

function trigrams(text: string): Set<string> {
  const s = ` ${normalize(text)} `
  const grams = new Set<string>()
  for (let i = 0; i < s.length - 2; i++) grams.add(s.slice(i, i + 3))
  return grams
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1
  let shared = 0
  for (const x of a) if (b.has(x)) shared++
  return shared / (a.size + b.size - shared)
}

/** 0–1 similarity of two pieces of text (max of word and character-trigram overlap). */
export function similarity(a: string, b: string): number {
  return Math.max(jaccard(words(a), words(b)), jaccard(trigrams(a), trigrams(b)))
}

/** Text that captures what a question tests: the prompt plus its correct answer. */
function fingerprint(q: Question): string {
  return q.type === 'multiple_choice' ? `${q.prompt} ${correctAnswerText(q)}` : q.prompt
}

/**
 * True when `candidate` asks essentially the same thing as one of `existing`:
 * near-identical wording, or similar wording that leads to the same answer.
 */
export function isDuplicate(candidate: Question, existing: Question[]): boolean {
  const answer = normalize(correctAnswerText(candidate))
  return existing.some((q) => {
    const promptSim = similarity(candidate.prompt, q.prompt)
    if (promptSim >= 0.6) return true
    if (similarity(fingerprint(candidate), fingerprint(q)) >= 0.65) return true
    // Same specific answer (not just "True"/"False") with overlapping wording.
    const sameAnswer =
      candidate.type === 'multiple_choice' &&
      q.type === 'multiple_choice' &&
      normalize(correctAnswerText(q)) === answer
    return sameAnswer && promptSim >= 0.35
  })
}

/** Drops near-duplicate concept descriptions from a plan, keeping the first of each. */
export function uniqueConcepts(concepts: string[]): string[] {
  const kept: string[] = []
  for (const c of concepts.map((x) => x.trim()).filter(Boolean)) {
    if (!kept.some((k) => similarity(k, c) >= 0.7)) kept.push(c)
  }
  return kept
}
