// src/lib/dates.ts

/** Returns today's date in local timezone as YYYY-MM-DD.
 *  Critical: NOT new Date().toISOString() (that's UTC and rolls over wrong
 *  for users in non-UTC timezones — see Phase 4 Plan 2 spec §4 timezone
 *  semantics LOCK). */
export function todayLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Format YYYY-MM-DD to short display. Current year: "May 31". Cross-year: "May 31 27". */
export function formatShortDate(eventDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(eventDate)
  if (!m) return eventDate
  const [, y, mo, day] = m
  const date = new Date(Number(y), Number(mo) - 1, Number(day))
  if (Number.isNaN(date.getTime())) return eventDate
  const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
  const base = formatter.format(date)
  const currentYear = new Date().getFullYear()
  if (date.getFullYear() === currentYear) return base
  return `${base} ${String(date.getFullYear()).slice(-2)}`
}
