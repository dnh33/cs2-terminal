import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { UtcClock } from '../UtcClock'

describe('UtcClock', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Fix system time exactly on a minute boundary so msUntilNextMinute === 60000.
    vi.setSystemTime(new Date('2026-05-05T12:34:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders HH:MM in UTC (no seconds)', () => {
    render(<UtcClock />)
    expect(screen.getByText('12:34')).toBeInTheDocument()
    // Should NOT include seconds
    expect(screen.queryByText(/12:34:\d{2}/)).toBeNull()
  })

  it('does not tick at 1-second intervals (still shows initial minute after 30s)', () => {
    render(<UtcClock />)
    expect(screen.getByText('12:34')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    // 30s in: still 12:34, not "12:34:30" or anything seconds-based
    expect(screen.getByText('12:34')).toBeInTheDocument()
  })

  it('ticks at minute boundaries', () => {
    render(<UtcClock />)
    expect(screen.getByText('12:34')).toBeInTheDocument()
    // Advance 60s — we're starting on the boundary, so first setTimeout fires at +60s → 12:35
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(screen.getByText('12:35')).toBeInTheDocument()

    // Advance another 60s — interval fires → 12:36
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(screen.getByText('12:36')).toBeInTheDocument()
  })
})
