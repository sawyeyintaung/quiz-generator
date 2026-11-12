import { FileReadError, MAX_FILE_BYTES, type ParsedFile, type Section } from './types.ts'

const lower = (name: string) => name.toLowerCase()

export function fileKind(file: File): ParsedFile['kind'] | undefined {
  const n = lower(file.name)
  if (n.endsWith('.pdf') || file.type === 'application/pdf') return 'pdf'
  if (n.endsWith('.docx')) return 'docx'
  if (/\.(txt|md|markdown)$/.test(n) || file.type.startsWith('text/')) return 'text'
  return undefined
}

/** Markdown-style headings ("# Title") from plain text. */
export function markdownSections(text: string): Section[] {
  return text
    .split('\n')
    .map((line) => line.match(/^#{1,3}\s+(.+?)\s*#*\s*$/)?.[1])
    .filter((t): t is string => Boolean(t))
    .map((title) => ({ title }))
}

/** Reads a PDF, DOCX, TXT or Markdown file entirely in the browser. */
export async function readFile(file: File): Promise<ParsedFile> {
  const kind = fileKind(file)
  if (!kind) throw new FileReadError('Please choose a PDF, Word (.docx), text or Markdown file.')
  if (file.size > MAX_FILE_BYTES) throw new FileReadError('This file is larger than 10 MB.')

  let parsed: ParsedFile
  if (kind === 'pdf') {
    parsed = await (await import('./readPdf.ts')).readPdf(file)
  } else if (kind === 'docx') {
    parsed = await (await import('./readDocx.ts')).readDocx(file)
  } else {
    const text = (await file.text()).replace(/\r\n?/g, '\n')
    parsed = { name: file.name, kind, text, sections: markdownSections(text) }
  }

  if (!parsed.text.trim()) {
    throw new FileReadError(
      kind === 'pdf'
        ? 'This PDF has no selectable text (it may be a scanned image). Try a different file or paste the text.'
        : 'This file has no readable text.',
    )
  }
  return parsed
}

/** The text to quiz on: a PDF page range (1-based, inclusive) or the whole document. */
export function textForRange(file: ParsedFile, range?: [number, number]): string {
  if (!file.pages || !range) return file.text
  const [from, to] = range
  return file.pages
    .slice(from - 1, to)
    .map((t, i) => `[Page ${from + i}]\n${t}`)
    .join('\n\n')
}
