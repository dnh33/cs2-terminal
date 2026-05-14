import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useTopMoverAnnounce } from '../../hooks/useTopMoverAnnounce'

describe('useTopMoverAnnounce (announce-on-change, debounced)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('emits announcement when top mover changes', () => {
    const { result, rerender } = renderHook(
      ({ top }) => useTopMoverAnnounce(top, { debounceMs: 10_000 }),
      { initialProps: { top: { name: 'A', pct_change: 5 } as any } },
    )
    expect(result.current).toMatch(/A now up 5%/)
    // Advance past debounce window before changing identity.
    vi.advanceTimersByTime(11_000)
    rerender({ top: { name: 'B', pct_change: -3 } as any })
    expect(result.current).toMatch(/B now down 3%/)
  })

  it('does not re-emit on same top mover within debounce window', () => {
    const { result, rerender } = renderHook(
      ({ top }) => useTopMoverAnnounce(top, { debounceMs: 10_000 }),
      { initialProps: { top: { name: 'A', pct_change: 5 } as any } },
    )
    rerender({ top: { name: 'A', pct_change: 6 } as any })
    expect(result.current).toMatch(/A now up 5%/) // first emission only
  })

  it('emits empty string when input is null', () => {
    const { result } = renderHook(() => useTopMoverAnnounce(null, { debounceMs: 10_000 }))
    expect(result.current).toBe('')
  })
})
