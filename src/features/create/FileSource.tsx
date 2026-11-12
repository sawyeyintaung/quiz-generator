import { AnimatePresence, motion } from 'framer-motion'
import { useId, useRef, useState, type DragEvent } from 'react'
import { wordCount } from '../generate/source.ts'
import { readFile } from '../sources/readFile.ts'
import { FileReadError, type ParsedFile } from '../sources/types.ts'

type Props = {
  file?: ParsedFile
  pageRange?: [number, number]
  onFile: (file: ParsedFile | undefined) => void
  onPageRange: (range: [number, number] | undefined) => void
}

export function FileSource({ file, pageRange, onFile, onPageRange }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [dragging, setDragging] = useState(false)
  const ids = { from: useId(), to: useId() }

  async function choose(f: File) {
    setBusy(true)
    setError(undefined)
    try {
      onFile(await readFile(f))
    } catch (e) {
      setError(e instanceof FileReadError ? e.message : "This file couldn't be read.")
    } finally {
      setBusy(false)
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) void choose(f)
  }

  const pageCount = file?.pages?.length
  const [from, to] = pageRange ?? [1, pageCount ?? 1]
  const setRange = (a: number, b: number) => {
    if (!pageCount) return
    const lo = Math.min(Math.max(1, a || 1), pageCount)
    const hi = Math.min(Math.max(lo, b || lo), pageCount)
    onPageRange(lo === 1 && hi === pageCount ? undefined : [lo, hi])
  }

  return (
    <div>
      <input
        ref={input}
        type="file"
        accept=".pdf,.docx,.txt,.md,.markdown,application/pdf,text/plain,text/markdown"
        aria-label="Upload a PDF, Word or text file"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void choose(f)
          e.target.value = ''
        }}
      />

      {!file ? (
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          disabled={busy}
          className={`flex w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
            dragging ? 'border-brand bg-brand/10' : 'border-border bg-bg hover:border-brand/60'
          }`}
        >
          {busy ? (
            <span role="status" className="flex items-center gap-2 font-medium">
              <motion.span
                aria-hidden
                className="bg-brand block size-3 rounded-full"
                animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
              Reading your file…
            </span>
          ) : (
            <>
              <span className="font-semibold">Drop a file here or click to choose</span>
              <span className="text-muted text-xs">
                PDF, Word (.docx), text or Markdown · up to 10 MB · read only in your browser
              </span>
            </>
          )}
        </button>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-border bg-bg rounded-xl border p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-semibold">📄 {file.name}</p>
              <p className="text-muted text-xs">
                {pageCount ? `${pageCount} page${pageCount === 1 ? '' : 's'} · ` : ''}
                {wordCount(file.text).toLocaleString()} words
                {file.sections.length > 0 &&
                  ` · ${file.sections.length} heading${file.sections.length === 1 ? '' : 's'}`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                onFile(undefined)
                onPageRange(undefined)
              }}
              className="text-muted hover:text-text text-sm font-medium"
            >
              Remove
            </button>
          </div>

          {pageCount && pageCount > 1 && (
            <fieldset className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <legend className="sr-only">Page range</legend>
              <label htmlFor={ids.from}>Pages</label>
              <input
                id={ids.from}
                type="number"
                min={1}
                max={pageCount}
                value={from}
                onChange={(e) => setRange(Number(e.target.value), to)}
                className="border-border bg-surface focus:border-brand w-20 rounded-lg border-2 px-2 py-1 outline-none"
              />
              <label htmlFor={ids.to}>to</label>
              <input
                id={ids.to}
                type="number"
                min={1}
                max={pageCount}
                value={to}
                onChange={(e) => setRange(from, Number(e.target.value))}
                className="border-border bg-surface focus:border-brand w-20 rounded-lg border-2 px-2 py-1 outline-none"
              />
              <span className="text-muted">of {pageCount}</span>
              {pageRange && (
                <button
                  type="button"
                  onClick={() => onPageRange(undefined)}
                  className="text-brand ml-1 underline"
                >
                  All pages
                </button>
              )}
            </fieldset>
          )}
        </motion.div>
      )}

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-wrong mt-2 text-sm"
            role="alert"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
