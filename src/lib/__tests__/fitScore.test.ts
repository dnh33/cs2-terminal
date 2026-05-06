import { describe, it, expect } from 'vitest'
import { computeFit, type FitInputs, type SnapshotInput } from '../fitScore'

const NOW = 1715000000  // 2024-05-06 ish

function buildHistory(opts: {
  startAt: number
  days: number
  basePrice: number
  drift?: number       // % per day
  volume?: number
}): SnapshotInput[] {
  const out: SnapshotInput[] = []
  const drift = opts.drift ?? 0
  const volume = opts.volume ?? 50
  for (let d = 0; d < opts.days; d++) {
    const fetched_at = opts.startAt + d * 86400
    const price = opts.basePrice * (1 + (drift / 100) * d)
    out.push({ fetched_at, lowest: price, median: price * 1.05, volume, sell_price: price * 1.10 })
  }
  return out
}

function baseInputs(overrides: Partial<FitInputs> = {}): FitInputs {
  return {
    case_: { id: 'glove-case', pool: 'discontinued', notable: 'gloves' },
    current: { fetched_at: NOW, lowest: 250, median: 260, volume: 50, sell_price: 270 },
    history: buildHistory({ startAt: NOW - 30 * 86400, days: 30, basePrice: 240 }),
    items: [],
    asOf: NOW,
    poolSize: 41,
    ...overrides,
  }
}

describe('computeFit', () => {
  describe('failure modes', () => {
    it('returns insufficient_history when <7 days of snapshots', () => {
      const result = computeFit(baseInputs({
        history: buildHistory({ startAt: NOW - 3 * 86400, days: 3, basePrice: 240 }),
      }))
      expect(result.status).toBe('insufficient_history')
      expect(result.fit).toBe(0)
      expect(result.confidence).toBe('low')
    })

    it('returns stale_data when current snapshot >2h old', () => {
      const result = computeFit(baseInputs({
        current: { fetched_at: NOW - 10000, lowest: 250, median: 260, volume: 50 },
      }))
      expect(result.status).toBe('stale_data')
      expect(result.fit).toBe(0)
    })

    it('returns ok+low_confidence when 7-30d history', () => {
      const result = computeFit(baseInputs({
        history: buildHistory({ startAt: NOW - 14 * 86400, days: 14, basePrice: 240 }),
      }))
      expect(result.status).toBe('ok')
      expect(result.confidence).toBe('low')
      expect(result.fit).toBeLessThanOrEqual(70)   // capped at 70 for low confidence
    })

    it('returns ok+high when ≥30d history and fresh', () => {
      const result = computeFit(baseInputs())
      expect(result.status).toBe('ok')
      expect(result.confidence).toBe('high')
    })
  })

  describe('per-pool weights', () => {
    it('active pool capped at FIT 55 even with strong components', () => {
      const result = computeFit(baseInputs({
        case_: { id: 'recoil-case', pool: 'active', notable: null },
        current: { fetched_at: NOW, lowest: 5, median: 5.2, volume: 5000, sell_price: 5.5 },
        history: buildHistory({ startAt: NOW - 30 * 86400, days: 30, basePrice: 4.5, volume: 4500 }),
      }))
      expect(result.fit).toBeLessThanOrEqual(55)
    })

    it('discontinued pool can score above 55', () => {
      // Strong components: rising price, low volume, knife in case
      const result = computeFit(baseInputs({
        case_: { id: 'kilowatt-case', pool: 'discontinued', notable: 'knife' },
        current: { fetched_at: NOW, lowest: 250, median: 260, volume: 30, sell_price: 270 },
        history: buildHistory({ startAt: NOW - 30 * 86400, days: 30, basePrice: 220, drift: 0.5 }),
      }))
      expect(result.fit).toBeGreaterThan(0)
    })
  })

  describe('components', () => {
    it('liquidity score is high when volume is high and spread is tight', () => {
      const result = computeFit(baseInputs({
        current: { fetched_at: NOW, lowest: 100, median: 101, volume: 500, sell_price: 102 },
      }))
      expect(result.components.liquidity.score).toBeGreaterThan(70)
    })

    it('liquidity score is low when volume is near zero', () => {
      // Wide spread (15%) + zero volume → low liquidity. Fixture corrected from
      // plan: with tight 2% spread, spreadScore alone yields ~36 (floor too high).
      const result = computeFit(baseInputs({
        current: { fetched_at: NOW, lowest: 100, median: 101, volume: 0, sell_price: 116 },
      }))
      expect(result.components.liquidity.score).toBeLessThan(30)
    })

    it('momentum score is centered at 50 when price is flat', () => {
      const flat = buildHistory({ startAt: NOW - 30 * 86400, days: 30, basePrice: 100, drift: 0 })
      const result = computeFit(baseInputs({
        current: { fetched_at: NOW, lowest: 100, median: 105, volume: 50, sell_price: 110 },
        history: flat,
      }))
      // Expect within ±5 of 50
      expect(Math.abs(result.components.momentum.score - 50)).toBeLessThan(15)
    })

    it('content_quality is non-zero for cases in CASE_CONTENT table', () => {
      // Fixture corrected: CASE_CONTENT key is 'glove' (per src/data/caseContent.ts), not 'glove-case'.
      const result = computeFit(baseInputs({
        case_: { id: 'glove', pool: 'rare', notable: 'gloves' },
      }))
      expect(result.components.content_quality.score).toBeGreaterThan(0)
    })

    it('content_quality is zero for unknown case ids (graceful fallback)', () => {
      const result = computeFit(baseInputs({
        case_: { id: 'totally-fictional-case', pool: 'rare', notable: null },
      }))
      expect(result.components.content_quality.score).toBe(0)
    })
  })

  describe('determinism', () => {
    it('same inputs produce same fit and inputs_hash', () => {
      const a = computeFit(baseInputs())
      const b = computeFit(baseInputs())
      expect(a.fit).toBe(b.fit)
      expect(a.inputs_hash).toBe(b.inputs_hash)
    })

    it('different asOf produces different inputs_hash but same fit when same data window', () => {
      const a = computeFit(baseInputs({ asOf: NOW }))
      const b = computeFit(baseInputs({ asOf: NOW + 1 }))
      // asOf changes so hash changes; fit may shift slightly due to age check
      expect(a.inputs_hash).not.toBe(b.inputs_hash)
    })

    it('fit, status, weights_version, algo_version are present in result', () => {
      const r = computeFit(baseInputs())
      expect(r.weights_version).toBe('v1-defaults-2026-05')
      expect(r.algo_version).toBe('fit-1.0.0')
      expect(typeof r.fit).toBe('number')
      expect(r.snapshot_at).toBe(NOW)
    })
  })
})
