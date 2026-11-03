import { describe, expect, it } from 'vitest'
import { markdownSections, readFile, textForRange } from './readFile.ts'
import { FileReadError, type ParsedFile } from './types.ts'

describe('readFile', () => {
  it('reads Markdown with its headings', async () => {
    const file = new File(
      ['# Cells\nCells are units.\n\n## Mitosis ##\nSplitting.\r\n'],
      'bio.md',
      {
        type: 'text/markdown',
      },
    )
    const parsed = await readFile(file)
    expect(parsed.kind).toBe('text')
    expect(parsed.text).not.toContain('\r')
    expect(parsed.sections).toEqual([{ title: 'Cells' }, { title: 'Mitosis' }])
  })

  it('rejects unsupported, empty and oversized files', async () => {
    await expect(readFile(new File(['x'], 'photo.png', { type: 'image/png' }))).rejects.toThrow(
      FileReadError,
    )
    await expect(readFile(new File(['   '], 'empty.txt'))).rejects.toThrow('no readable text')
    const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'big.txt')
    await expect(readFile(big)).rejects.toThrow('larger than 10 MB')
  })

  it('selects a PDF page range with page markers', () => {
    const pdf: ParsedFile = {
      name: 'a.pdf',
      kind: 'pdf',
      pages: ['one', 'two', 'three'],
      text: '',
      sections: [],
    }
    expect(textForRange(pdf, [2, 3])).toBe('[Page 2]\ntwo\n\n[Page 3]\nthree')
    expect(textForRange({ ...pdf, text: 'all' })).toBe('all')
  })

  it('finds markdown headings only at line starts', () => {
    expect(markdownSections('Intro #notaheading\n### Deep\n#nospace')).toEqual([{ title: 'Deep' }])
  })
})
