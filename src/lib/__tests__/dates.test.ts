import { describe, it, expect, vi, afterEach } from 'vitest'
import { todayLocal, formatShortDate } from '../dates'

describe('todayLocal', () => {
  afterEach(() => vi.useRealTimers())

  it('returns YYYY-MM-DD in local timezone', () => {
    vi.setSystemTime(new Date(2026, 4, 31, 23, 30)) // May 31 2026, 23:30 LOCAL
    expect(todayLocal()).toBe('2026-05-31')
  })

  it('does NOT roll over to next day in UTC when local is still on prior day', () => {
    // Set local time to 2026-05-31 23:30 — this is the bug todayLocal prevents.
    // toISOString() at this moment in UTC-7 would be 2026-06-01T06:30:00Z.
    // todayLocal() must return 2026-05-31 (local), NOT 2026-06-01 (UTC).
    vi.setSystemTime(new Date(2026, 4, 31, 23, 30))
    const local = todayLocal()
    expect(local).toBe('2026-05-31')
  })

  it('zero-pads single-digit months and days', () => {
    vi.setSystemTime(new Date(2026, 0, 5)) // January 5 2026
    expect(todayLocal()).toBe('2026-01-05')
  })
})

describe('formatShortDate', () => {
  afterEach(() => vi.useRealTimers())

  it('formats current-year date as "Mon D"', () => {
    vi.setSystemTime(new Date(2026, 0, 1))
    expect(formatShortDate('2026-05-31')).toBe('May 31')
  })

  it('appends 2-digit year for cross-year dates', () => {
    vi.setSystemTime(new Date(2026, 0, 1))
    expect(formatShortDate('2027-08-15')).toBe('Aug 15 27')
  })

  it('handles malformed input gracefully', () => {
    expect(formatShortDate('not-a-date')).toBe('not-a-date')
  })
})
