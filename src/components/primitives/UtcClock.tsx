import { useEffect, useState } from 'react'

/**
 * UTC clock that ticks once per minute (not per second).
 * Aligned to the next minute boundary so the displayed minute matches wall time.
 * Renders HH:MM (no seconds) — see synthesis §4 (perf: avoid whole-header re-renders).
 */
export function UtcClock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null

    // Align first tick to next minute boundary.
    const msUntilNextMinute = 60_000 - (Date.now() % 60_000)
    const timeoutId = setTimeout(() => {
      setNow(new Date())
      intervalId = setInterval(() => setNow(new Date()), 60_000)
    }, msUntilNextMinute)

    return () => {
      clearTimeout(timeoutId)
      if (intervalId !== null) clearInterval(intervalId)
    }
  }, [])

  // toUTCString → "Tue, 05 May 2026 12:34:10 GMT". Slice 17..22 → "12:34".
  return <span className="t-data text-ink-1">{now.toUTCString().slice(17, 22)}</span>
}
