import { useEffect, useRef, useState } from 'react'
import type { MoverRow } from '../lib/api'

interface Options {
  debounceMs: number
}

/**
 * Emit a screen-reader-friendly message string whenever the identity of the
 * top mover changes. Suppresses re-emissions within `debounceMs` of the last
 * announcement so rapid pct_change wobble on the same name stays quiet.
 *
 * Returns the current message (empty string before any emission, or when
 * `top` is null/undefined). Mount the return value into a <LiveRegion>.
 *
 * F19 wiring: paired with a polite LiveRegion adjacent to the Ticker.
 */
export function useTopMoverAnnounce(
  top: MoverRow | null | undefined,
  opts: Options,
): string {
  const [message, setMessage] = useState('')
  const lastName = useRef<string | null>(null)
  const lastEmit = useRef<number>(0)

  useEffect(() => {
    if (!top) return
    const now = Date.now()
    if (top.name === lastName.current) return
    if (now - lastEmit.current < opts.debounceMs) return

    const dir = top.pct_change >= 0 ? 'up' : 'down'
    const absPct = Math.round(Math.abs(top.pct_change))
    setMessage(`${top.name} now ${dir} ${absPct}% in 24 hours`)
    lastName.current = top.name
    lastEmit.current = now
  }, [top, opts.debounceMs])

  return message
}
