import { describe, it, expect } from 'vitest'
import { computePoolIndexSeries } from './movers'

describe('computePoolIndexSeries', () => {
  it('returns 3 pool series for fixture rows', () => {
    const rows = [
      // discontinued cases at two snapshots
      { case_id: 'glove',   pool: 'discontinued' as const, fetched_at: 100, lowest: 200, volume: 50 },
      { case_id: 'falchion',pool: 'discontinued' as const, fetched_at: 100, lowest: 100, volume: 30 },
      { case_id: 'opbf',    pool: 'discontinued' as const, fetched_at: 100, lowest: 80,  volume: 20 },
      { case_id: 'glove',   pool: 'discontinued' as const, fetched_at: 200, lowest: 220, volume: 40 },
      { case_id: 'falchion',pool: 'discontinued' as const, fetched_at: 200, lowest: 110, volume: 35 },
      { case_id: 'opbf',    pool: 'discontinued' as const, fetched_at: 200, lowest: 85,  volume: 25 },
      // rare cases
      { case_id: 'gamma',   pool: 'rare' as const,         fetched_at: 100, lowest: 50,  volume: 100 },
      { case_id: 'spectrum',pool: 'rare' as const,         fetched_at: 100, lowest: 40,  volume: 80 },
      { case_id: 'chroma',  pool: 'rare' as const,         fetched_at: 100, lowest: 30,  volume: 60 },
      // active cases
      { case_id: 'kilowatt',pool: 'active' as const,       fetched_at: 100, lowest: 5,   volume: 500 },
      { case_id: 'fever',   pool: 'active' as const,       fetched_at: 100, lowest: 4,   volume: 400 },
      { case_id: 'gallery', pool: 'active' as const,       fetched_at: 100, lowest: 3,   volume: 300 },
    ]

    const result = computePoolIndexSeries(rows)
    expect(result.DISCONTINUED).toHaveLength(2)
    expect(result.RARE).toHaveLength(1)
    expect(result.ACTIVE).toHaveLength(1)

    // VWAP at t=100 for DISC: (200*50 + 100*30 + 80*20) / (50+30+20) = (10000+3000+1600)/100 = 146
    expect(result.DISCONTINUED[0]).toEqual({ snapshot_at: 100, vwap: 146, contributors: 3 })
    // VWAP at t=200 for DISC: (220*40 + 110*35 + 85*25) / (40+35+25) = (8800+3850+2125)/100 = 147.75
    expect(result.DISCONTINUED[1]).toEqual({ snapshot_at: 200, vwap: 147.75, contributors: 3 })
  })

  it('skips cases with null lowest from numerator AND denominator', () => {
    const rows = [
      { case_id: 'a', pool: 'rare' as const, fetched_at: 100, lowest: null, volume: 50 },
      { case_id: 'b', pool: 'rare' as const, fetched_at: 100, lowest: 10,   volume: 30 },
      { case_id: 'c', pool: 'rare' as const, fetched_at: 100, lowest: 20,   volume: 20 },
      { case_id: 'd', pool: 'rare' as const, fetched_at: 100, lowest: 30,   volume: 10 },
    ]
    const result = computePoolIndexSeries(rows)
    // Only b/c/d count: vwap = (10*30 + 20*20 + 30*10) / (30+20+10) = 1000/60 ≈ 16.67
    expect(result.RARE[0].vwap).toBeCloseTo(16.6666, 3)
    expect(result.RARE[0].contributors).toBe(3)
  })

  it('emits no point when contributors < 3 (min-coverage gate)', () => {
    const rows = [
      { case_id: 'a', pool: 'rare' as const, fetched_at: 100, lowest: 10, volume: 30 },
      { case_id: 'b', pool: 'rare' as const, fetched_at: 100, lowest: 20, volume: 20 },
    ]
    const result = computePoolIndexSeries(rows)
    expect(result.RARE).toHaveLength(0)
  })

  it('skips zero-volume cases from contributors count', () => {
    const rows = [
      { case_id: 'a', pool: 'rare' as const, fetched_at: 100, lowest: 10, volume: 0 },
      { case_id: 'b', pool: 'rare' as const, fetched_at: 100, lowest: 20, volume: 30 },
      { case_id: 'c', pool: 'rare' as const, fetched_at: 100, lowest: 30, volume: 20 },
      { case_id: 'd', pool: 'rare' as const, fetched_at: 100, lowest: 40, volume: 10 },
    ]
    const result = computePoolIndexSeries(rows)
    // a contributes 0 to denominator → contributors=3 (b/c/d)
    expect(result.RARE[0].contributors).toBe(3)
  })

  it('treats null volume as zero contributor (does not propagate NaN)', () => {
    const rows = [
      // null volume → must be skipped before arithmetic, otherwise NaN propagates
      { case_id: 'a', pool: 'rare' as const, fetched_at: 100, lowest: 10, volume: null },
      { case_id: 'b', pool: 'rare' as const, fetched_at: 100, lowest: 20, volume: 30 },
      { case_id: 'c', pool: 'rare' as const, fetched_at: 100, lowest: 30, volume: 20 },
      { case_id: 'd', pool: 'rare' as const, fetched_at: 100, lowest: 40, volume: 10 },
    ]
    const result = computePoolIndexSeries(rows)
    expect(result.RARE).toHaveLength(1)
    // vwap = (20*30 + 30*20 + 40*10) / (30+20+10) = (600+600+400)/60 = 1600/60 ≈ 26.6666
    expect(Number.isNaN(result.RARE[0].vwap)).toBe(false)
    expect(result.RARE[0].vwap).toBeCloseTo(26.6666, 3)
    expect(result.RARE[0].contributors).toBe(3)
  })
})
