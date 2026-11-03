export const MAX_TOPIC_CHARS = 200
export const MAX_TEXT_CHARS = 30_000
export const MAX_FOCUS_CHARS = 150

/** Rough guide: about one distinct question per 70 words of study text. */
const WORDS_PER_QUESTION = 70

export function wordCount(text: string): number {
  const words = text.trim().match(/\S+/g)
  return words ? words.length : 0
}

/** How many unique questions a piece of study text can reasonably support. */
export function recommendedMaxQuestions(text: string): number {
  return Math.max(1, Math.floor(wordCount(text) / WORDS_PER_QUESTION))
}

/** Short label stored with the quiz (never the full source text). */
export function sourceLabel(text: string, max = 80): string {
  const oneLine = text.replace(/\s+/g, ' ').trim()
  return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine
}
