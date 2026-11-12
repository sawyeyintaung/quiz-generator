import mammoth from 'mammoth'
import { FileReadError, type ParsedFile } from './types.ts'

export async function readDocx(file: File): Promise<ParsedFile> {
  let html: string
  try {
    html = (await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() })).value
  } catch {
    throw new FileReadError(
      "This Word file couldn't be opened. It may be damaged or not a .docx file.",
    )
  }
  // DOMParser builds an inert document (no scripts run), only used to read text and headings.
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const sections = [...doc.querySelectorAll('h1, h2, h3')]
    .map((h) => (h.textContent ?? '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map((title) => ({ title }))
  const blocks = [...doc.body.children].map((el) => {
    const t = (el.textContent ?? '').trim()
    return /^H[1-3]$/.test(el.tagName) && t ? `# ${t}` : t
  })
  return {
    name: file.name,
    kind: 'docx',
    text: blocks.filter(Boolean).join('\n\n'),
    sections,
  }
}
