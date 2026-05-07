import { describe, it, expect } from 'vitest'
import { computeDelta, computeBreakeven, computeVerdict } from './reticleMath'
import type { PricePointForReticle } from './reticleMath'

describe('computeDelta', () => {
  it('positive delta for price increase', () => {
    expect(computeDelta(100, 120)).toBe(20)
  })
  it('negative delta for decrease', () => {
    expect(computeDelta(100, 80)).toBe(-20)
  })
  it('returns 0 for equal prices', () => {
    expect(computeDelta(100, 100)).toBe(0)
  })
  it('rounds to 1 decimal', () => {
    expect(computeDelta(100, 133.333)).toBe(33.3)
  })
  it('returns null when locked is 0 (avoid div-by-zero)', () => {
    expect(computeDelta(0, 100)).toBeNull()
  })
})

describe('computeBreakeven', () => {
  it('uses preferred metric when finite', () => {
    expect(computeBreakeven(247, 290)).toBe(290)
  })
  it('falls back to 15% Steam fee formula when metric is null', () => {
    expect(computeBreakeven(100, null)).toBe(117.65)
  })
  it('falls back when metric is 0 or NaN', () => {
    expect(computeBreakeven(100, 0)).toBe(117.65)
    expect(computeBreakeven(100, NaN)).toBe(117.65)
  })
})

describe('computeVerdict', () => {
  const makeHistory = (prices: number[], startTime = 100): PricePointForReticle[] =>
    prices.map((p, i) => ({ time: startTime + i, price: p }))

  it('HIT when price reaches target within window', () => {
    const history = makeHistory([100, 105, 110, 115, 108])
    const v = computeVerdict({
      lockA: { time: 100, price: 100 },
      lockB: { time: 104, price: 110 },
      history,
    })
    expect(v.verdict).toBe('HIT')
    expect(v.maxPrice).toBe(115)
    expect(v.minPrice).toBe(100)
  })

  it('MISS when price never reaches target', () => {
    const history = makeHistory([100, 102, 105, 107, 109])
    const v = computeVerdict({
      lockA: { time: 100, price: 100 },
      lockB: { time: 104, price: 110 },
      history,
    })
    expect(v.verdict).toBe('MISS')
    expect(v.maxPrice).toBe(109)
  })

  it('RICOCHET when target hit then price falls below lockA', () => {
    const history = makeHistory([100, 110, 115, 95, 98])
    const v = computeVerdict({
      lockA: { time: 100, price: 100 },
      lockB: { time: 104, price: 110 },
      history,
    })
    expect(v.verdict).toBe('RICOCHET')
    expect(v.maxPrice).toBe(115)
    expect(v.minPrice).toBe(95)
  })

  it('handles lockA after lockB (swaps internally)', () => {
    const history = makeHistory([100, 105, 110, 115, 108])
    const v1 = computeVerdict({
      lockA: { time: 104, price: 110 },
      lockB: { time: 100, price: 100 },
      history,
    })
    expect(v1.verdict).toBe('HIT')
  })

  it('returns INSUFFICIENT_DATA when window has zero history points', () => {
    const v = computeVerdict({
      lockA: { time: 100, price: 100 },
      lockB: { time: 104, price: 110 },
      history: [],
    })
    expect(v.verdict).toBe('INSUFFICIENT_DATA')
  })

  it('only walks points within [min(lockA.time,lockB.time), max(...)]', () => {
    const history: PricePointForReticle[] = [
      { time: 50, price: 200 },
      { time: 100, price: 100 },
      { time: 102, price: 105 },
      { time: 104, price: 110 },
      { time: 200, price: 50 },
    ]
    const v = computeVerdict({
      lockA: { time: 100, price: 100 },
      lockB: { time: 104, price: 110 },
      history,
    })
    expect(v.verdict).toBe('HIT')
    expect(v.maxPrice).toBe(110)
    expect(v.minPrice).toBe(100)
  })
})
