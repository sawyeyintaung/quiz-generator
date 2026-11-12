import { useEffect } from 'react'

/** Sets the browser tab title (also announced by screen readers on navigation). */
export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · Quiz Generator` : 'Quiz Generator'
  }, [title])
}
