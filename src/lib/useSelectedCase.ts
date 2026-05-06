import { useCallback, useEffect, useState } from 'react'

const PARAM = 'case'

function readFromUrl(): string | null {
  if (typeof window === 'undefined') return null
  const v = new URLSearchParams(window.location.search).get(PARAM)
  return v && v.length > 0 ? v : null
}

/**
 * Lightweight URL-state hook for the selected case ID.
 * - Mirrors `?case=<id>` ↔ React state.
 * - On mount: reads URL.
 * - setSelectedCase(id) → pushState(`?case=<id>`).
 * - setSelectedCase(null) → pushState with the param removed.
 * - popstate (browser back/forward) updates state.
 *
 * Intentionally NOT a router — we only manage one search param. Filter,
 * sort, and palette state stay in React/localStorage. URL state for the
 * SELECTED case alone is the smallest scope that gives shareable URLs +
 * refresh-survives-selection.
 */
export function useSelectedCase(): [string | null, (id: string | null) => void] {
  const [id, setId] = useState<string | null>(() => readFromUrl())

  useEffect(() => {
    function onPopState() {
      setId(readFromUrl())
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const setSelectedCase = useCallback((next: string | null) => {
    const params = new URLSearchParams(window.location.search)
    if (next) params.set(PARAM, next)
    else params.delete(PARAM)
    const search = params.toString()
    const url = window.location.pathname + (search ? `?${search}` : '') + window.location.hash
    window.history.pushState({}, '', url)
    setId(next)
  }, [])

  return [id, setSelectedCase]
}
