import { describe, it, expect } from 'vitest'
import { normalizePoolSeries } from './poolIndex'

describe('normalizePoolSeries', () => {
  it('normalizes to first point = 100', () => {
    const raw = [
      { snapshot_at: 100, vwap: 50, contributors: 3 },
      { snapshot_at: 200, vwap: 75, contributors: 4 },
      { snapshot_at: 300, vwap: 60, contributors: 5 },
    ]
    const out = normalizePoolSeries(raw)
    expect(out).toEqual([
      { snapshot_at: 100, index: 100 },
      { snapshot_at: 200, index: 150 },
      { snapshot_at: 300, index: 120 },
    ])
  })

  it('returns [] when input empty', () => {
    expect(normalizePoolSeries([])).toEqual([])
  })

  it('returns [] when first vwap is 0 (cannot normalize)', () => {
    const raw = [
      { snapshot_at: 100, vwap: 0, contributors: 3 },
      { snapshot_at: 200, vwap: 50, contributors: 3 },
    ]
    expect(normalizePoolSeries(raw)).toEqual([])
  })

  it('rounds to 2 decimal places for stable rendering', () => {
    const raw = [
      { snapshot_at: 100, vwap: 30, contributors: 3 },
      { snapshot_at: 200, vwap: 100, contributors: 3 },
    ]
    const out = normalizePoolSeries(raw)
    // 100/30 = 3.333... × 100 = 333.333... → rounded to 2 dp = 333.33
    expect(out[1].index).toBe(333.33)
  })
})
