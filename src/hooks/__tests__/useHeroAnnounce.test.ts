import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useHeroAnnounce } from '../useHeroAnnounce'
import { announceConfig } from '../../components/hero-announce-config'

describe('useHeroAnnounce — material-change debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('announces when relative threshold crossed', () => {
    const { result, rerender } = renderHook(
      ({ vol }) => useHeroAnnounce({ dollarVolume24h: vol, biggestMover: { short_name: 'A', pct_change: 5 } as any }),
      { initialProps: { vol: 100_000 } },
    )
    rerender({ vol: 102_000 }) // 2% — above 1% threshold
    expect(result.current).toMatch(/HERO update/)
  })

  it('does not announce when relative threshold not crossed', () => {
    const { result, rerender } = renderHook(
      ({ vol }) => useHeroAnnounce({ dollarVolume24h: vol, biggestMover: { short_name: 'A', pct_change: 5 } as any }),
      { initialProps: { vol: 100_000 } },
    )
    const first = result.current
    // Pick a delta safely under both relative AND absolute thresholds.
    const tinyDelta = Math.min(
      100_000 * announceConfig.thresholdRelative * 0.5,
      announceConfig.thresholdAbsolute * 0.5,
    )
    rerender({ vol: 100_000 + tinyDelta })
    expect(result.current).toBe(first)
  })

  it('does not re-announce within debounce window even on threshold-cross', () => {
    const { result, rerender } = renderHook(
      ({ vol }) => useHeroAnnounce({ dollarVolume24h: vol, biggestMover: { short_name: 'A', pct_change: 5 } as any }),
      { initialProps: { vol: 100_000 } },
    )
    rerender({ vol: 102_000 })
    const first = result.current
    rerender({ vol: 104_000 }) // would cross again, but inside debounce window
    expect(result.current).toBe(first)
  })

  it('emits message with the expected shape', () => {
    const { result, rerender } = renderHook(
      ({ vol }) => useHeroAnnounce({ dollarVolume24h: vol, biggestMover: { short_name: 'A', pct_change: 5 } as any }),
      { initialProps: { vol: 100_000 } },
    )
    rerender({ vol: 102_000 })
    expect(result.current).toMatch(/24H DOLLAR VOLUME .+ BIGGEST MOVER A up 5%/)
  })

  it('exports a single source of truth for thresholds', () => {
    expect(announceConfig).toHaveProperty('debounceMs')
    expect(announceConfig).toHaveProperty('thresholdRelative')
    expect(announceConfig).toHaveProperty('thresholdAbsolute')
  })
})
