import * as pdfjs from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { FileReadError, type ParsedFile, type Section } from './types.ts'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

type OutlineItem = { title: string; dest: string | unknown[] | null; items: OutlineItem[] }

async function outlineSections(doc: PDFDocumentProxy): Promise<Section[]> {
  const outline = (await doc.getOutline().catch(() => null)) as OutlineItem[] | null
  if (!outline) return []
  const sections: Section[] = []
  // Top two levels are enough for "chapters" and "sections".
  const walk = async (items: OutlineItem[], depth: number) => {
    for (const item of items) {
      let page: number | undefined
      try {
        const dest = typeof item.dest === 'string' ? await doc.getDestination(item.dest) : item.dest
        const ref = Array.isArray(dest) ? dest[0] : undefined
        if (ref && typeof ref === 'object') page = (await doc.getPageIndex(ref as never)) + 1
        else if (typeof ref === 'number') page = ref + 1
      } catch {
        // Some bookmarks point nowhere; keep the title without a page.
      }
      const title = item.title.replace(/\s+/g, ' ').trim()
      if (title) sections.push({ title, page })
      if (depth < 1 && item.items?.length) await walk(item.items, depth + 1)
    }
  }
  await walk(outline, 0)
  return sections
}

export async function readPdf(file: File): Promise<ParsedFile> {
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  let doc: PDFDocumentProxy
  try {
    doc = await task.promise
  } catch (error) {
    const name = (error as { name?: string }).name
    throw new FileReadError(
      name === 'PasswordException'
        ? 'This PDF is password-protected. Remove the password and try again.'
        : "This PDF couldn't be opened. It may be damaged.",
    )
  }
  try {
    const pages: string[] = []
    for (let i = 1; i <= doc.numPages; i++) {
      const content = await (await doc.getPage(i)).getTextContent()
      let text = ''
      for (const item of content.items) {
        if ('str' in item) text += item.str + (item.hasEOL ? '\n' : '')
      }
      pages.push(
        text
          .replace(/[ \t]+\n/g, '\n')
          .replace(/\n{3,}/g, '\n\n')
          .trim(),
      )
    }
    return {
      name: file.name,
      kind: 'pdf',
      pages,
      text: pages.join('\n\n'),
      sections: await outlineSections(doc),
    }
  } finally {
    void task.destroy()
  }
}
