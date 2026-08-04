import { describe, it, expect } from 'vitest'
import { computePoolIndexSeries } from './movers'

const DAY = 86400
const DAY_A = 10 * DAY
const DAY_B = 11 * DAY

describe('computePoolIndexSeries', () => {
  it('returns 3 pool series for fixture rows, one point per DAY (not per exact timestamp)', () => {
    const rows = [
      // discontinued cases on two different days
      { case_id: 'glove',   pool: 'discontinued' as const, fetched_at: DAY_A + 100, lowest: 200, volume: 50 },
      { case_id: 'falchion',pool: 'discontinued' as const, fetched_at: DAY_A + 100, lowest: 100, volume: 30 },
      { case_id: 'opbf',    pool: 'discontinued' as const, fetched_at: DAY_A + 100, lowest: 80,  volume: 20 },
      { case_id: 'glove',   pool: 'discontinued' as const, fetched_at: DAY_B + 100, lowest: 220, volume: 40 },
      { case_id: 'falchion',pool: 'discontinued' as const, fetched_at: DAY_B + 100, lowest: 110, volume: 35 },
      { case_id: 'opbf',    pool: 'discontinued' as const, fetched_at: DAY_B + 100, lowest: 85,  volume: 25 },
      // rare cases
      { case_id: 'gamma',   pool: 'rare' as const,         fetched_at: DAY_A + 100, lowest: 50,  volume: 100 },
      { case_id: 'spectrum',pool: 'rare' as const,         fetched_at: DAY_A + 100, lowest: 40,  volume: 80 },
      { case_id: 'chroma',  pool: 'rare' as const,         fetched_at: DAY_A + 100, lowest: 30,  volume: 60 },
      // active cases
      { case_id: 'kilowatt',pool: 'active' as const,       fetched_at: DAY_A + 100, lowest: 5,   volume: 500 },
      { case_id: 'fever',   pool: 'active' as const,       fetched_at: DAY_A + 100, lowest: 4,   volume: 400 },
      { case_id: 'gallery', pool: 'active' as const,       fetched_at: DAY_A + 100, lowest: 3,   volume: 300 },
    ]

    const result = computePoolIndexSeries(rows)
    expect(result.DISCONTINUED).toHaveLength(2)
    expect(result.RARE).toHaveLength(1)
    expect(result.ACTIVE).toHaveLength(1)

    // VWAP for day A DISC: (200*50 + 100*30 + 80*20) / (50+30+20) = (10000+3000+1600)/100 = 146
    expect(result.DISCONTINUED[0]).toEqual({ snapshot_at: DAY_A, vwap: 146, contributors: 3 })
    // VWAP for day B DISC: (220*40 + 110*35 + 85*25) / (40+35+25) = (8800+3850+2125)/100 = 147.75
    expect(result.DISCONTINUED[1]).toEqual({ snapshot_at: DAY_B, vwap: 147.75, contributors: 3 })
  })

  it('collapses many intra-day timestamps into a single daily point (fixes chart noise)', () => {
    // Reproduces the real bug: cron runs hourly + 3-hourly + twice-daily, so
    // a 30-day window produced 20-24+ distinct exact timestamps per pool per
    // day (600-700+ raw points), making the chart unreadable. Day-bucketing
    // must collapse all same-day snapshots into one point per pool.
    const rows: { case_id: string; pool: 'active'; fetched_at: number; lowest: number; volume: number }[] = []
    for (let hour = 0; hour < 24; hour++) {
      rows.push({ case_id: 'kilowatt', pool: 'active', fetched_at: hour * 3600, lowest: 5, volume: 100 })
      rows.push({ case_id: 'fever',    pool: 'active', fetched_at: hour * 3600, lowest: 4, volume: 100 })
      rows.push({ case_id: 'gallery',  pool: 'active', fetched_at: hour * 3600, lowest: 3, volume: 100 })
    }
    const result = computePoolIndexSeries(rows)
    expect(result.ACTIVE).toHaveLength(1)
    expect(result.ACTIVE[0].snapshot_at).toBe(0)
  })

  it('dedupes contributors by case_id within a day so one case reporting repeatedly does not fake coverage', () => {
    // Same case reporting 3x within one day must count as ONE contributor,
    // not three — MIN_COVERAGE is meant to require ≥3 DISTINCT cases.
    const rows = [
      { case_id: 'a', pool: 'rare' as const, fetched_at: 100,  lowest: 10, volume: 10 },
      { case_id: 'a', pool: 'rare' as const, fetched_at: 3700, lowest: 12, volume: 10 },
      { case_id: 'a', pool: 'rare' as const, fetched_at: 7200, lowest: 14, volume: 10 },
      { case_id: 'b', pool: 'rare' as const, fetched_at: 100,  lowest: 20, volume: 10 },
    ]
    const result = computePoolIndexSeries(rows)
    // Only 2 distinct case_ids (a, b) → fails MIN_COVERAGE=3 despite 4 rows
    expect(result.RARE).toHaveLength(0)
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
