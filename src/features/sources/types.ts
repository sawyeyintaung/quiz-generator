/** A heading or bookmark found in a document; `page` is 1-based (PDF only). */
export type Section = { title: string; page?: number }

/** Text extracted in the browser from an uploaded file. Nothing is uploaded anywhere. */
export type ParsedFile = {
  name: string
  kind: 'pdf' | 'docx' | 'text'
  /** PDF only: text of each page, so a page range can be chosen later. */
  pages?: string[]
  /** Whole-document text (for PDF: all pages joined). */
  text: string
  sections: Section[]
}

export const MAX_FILE_BYTES = 10 * 1024 * 1024
/** How much extracted text is sent to the AI at most (~25k tokens). */
export const MAX_FILE_TEXT_CHARS = 100_000

export class FileReadError extends Error {}
