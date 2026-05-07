import { describe, it, expect } from 'vitest'
import { resolveHypothesis } from '../resolveHypothesis'
import type { Hypothesis } from '../useHypothesisLedger'
import type { PricePoint } from '../metrics'

const base: Hypothesis = {
  id: 'h1',
  caseId: 'glove',
  caseName: 'Glove Case',
  comparator: 'gte',
  targetPrice: 280,
  targetDate: '2026-06-15',
  confidence: 65,
  priceAtCommit: 270,
  snapshotAt: 0,
  committedAt: 0,
  note: '',
  resolution: null,
}

function pp(date: string, price: number): PricePoint {
  return { date, price, source: 'real' }
}

describe('resolveHypothesis', () => {
  it('STALE when no rows match targetDate', () => {
    const r = resolveHypothesis(base, [pp('2026-06-14', 285), pp('2026-06-16', 285)])
    expect(r.outcome).toBe('STALE')
    expect(r.observed).toBeNull()
    expect(r.resolverVersion).toBe(1)
  })

  it('STALE when history is empty', () => {
    const r = resolveHypothesis(base, [])
    expect(r.outcome).toBe('STALE')
  })

  it('gte HIT when max ≥ target', () => {
    const r = resolveHypothesis(base, [
      pp('2026-06-15', 270),
      pp('2026-06-15', 285),
      pp('2026-06-15', 275),
    ])
    expect(r.outcome).toBe('HIT')
    expect(r.observed).toEqual({ min: 270, max: 285, count: 3 })
  })

  it('gte MISS when max < target', () => {
    const r = resolveHypothesis(base, [
      pp('2026-06-15', 250),
      pp('2026-06-15', 279),
    ])
    expect(r.outcome).toBe('MISS')
    expect(r.observed).toEqual({ min: 250, max: 279, count: 2 })
  })

  it('gte HIT on equality (inclusive)', () => {
    const r = resolveHypothesis(base, [pp('2026-06-15', 280)])
    expect(r.outcome).toBe('HIT')
  })

  it('lte HIT when min ≤ target', () => {
    const h: Hypothesis = { ...base, comparator: 'lte', targetPrice: 8 }
    const r = resolveHypothesis(h, [pp('2026-06-15', 7.42), pp('2026-06-15', 8.91)])
    expect(r.outcome).toBe('HIT')
  })

  it('lte MISS when min > target', () => {
    const h: Hypothesis = { ...base, comparator: 'lte', targetPrice: 8 }
    const r = resolveHypothesis(h, [pp('2026-06-15', 8.10), pp('2026-06-15', 8.91)])
    expect(r.outcome).toBe('MISS')
  })

  it('lte HIT on equality (inclusive)', () => {
    const h: Hypothesis = { ...base, comparator: 'lte', targetPrice: 8 }
    const r = resolveHypothesis(h, [pp('2026-06-15', 8)])
    expect(r.outcome).toBe('HIT')
  })

  it('only counts rows where date === targetDate', () => {
    const r = resolveHypothesis(base, [
      pp('2026-06-14', 999),
      pp('2026-06-15', 270),
      pp('2026-06-16', 999),
    ])
    expect(r.observed?.count).toBe(1)
  })

  it('comparator symmetry property: gte HIT iff lte would HIT on inverse target', () => {
    // For any (target, observed) pair, if max>=target (gte HIT), then min<=target (lte HIT) when observed contains both
    const points = [pp('2026-06-15', 270), pp('2026-06-15', 285)]
    const gteH: Hypothesis = { ...base, comparator: 'gte', targetPrice: 280 }
    const lteH: Hypothesis = { ...base, comparator: 'lte', targetPrice: 280 }
    const gteR = resolveHypothesis(gteH, points)
    const lteR = resolveHypothesis(lteH, points)
    // 280 falls between min=270 and max=285 → gte HIT and lte HIT
    expect(gteR.outcome).toBe('HIT')
    expect(lteR.outcome).toBe('HIT')
  })

  it('resolverVersion is always 1', () => {
    const r1 = resolveHypothesis(base, [pp('2026-06-15', 285)])
    const r2 = resolveHypothesis(base, [])
    expect(r1.resolverVersion).toBe(1)
    expect(r2.resolverVersion).toBe(1)
  })

  it('resolvedAt is a recent timestamp', () => {
    const before = Date.now()
    const r = resolveHypothesis(base, [pp('2026-06-15', 285)])
    const after = Date.now()
    expect(r.resolvedAt).toBeGreaterThanOrEqual(before)
    expect(r.resolvedAt).toBeLessThanOrEqual(after)
  })
})
