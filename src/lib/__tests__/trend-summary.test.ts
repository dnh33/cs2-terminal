import { describe, it, expect } from 'vitest'
import { summarizeTrend, captionFromHistory } from '../trend-summary'

type Point = { date: string; price: number }

describe('summarizeTrend', () => {
  it('reports rising trend over N days with breakeven cross', () => {
    const points: Point[] = [
      { date: '2026-04-01', price: 0.9 },
      { date: '2026-04-15', price: 1.05 },
      { date: '2026-05-01', price: 1.2 },
    ]
    const out = summarizeTrend(points, { breakEven: 1.0 })
    expect(out).toMatch(/ris/i)
    expect(out).toMatch(/breakeven/i)
    expect(out).toMatch(/30 days/i)
  })

  it('reports falling trend with no breakeven cross', () => {
    const points: Point[] = [
      { date: '2026-04-01', price: 1.5 },
      { date: '2026-05-01', price: 1.2 },
    ]
    const out = summarizeTrend(points, { breakEven: 1.0 })
    expect(out).toMatch(/fall/i)
    expect(out).not.toMatch(/breakeven/i)
  })

  it('reports flat trend within ±2% drift', () => {
    const points: Point[] = [
      { date: '2026-04-01', price: 1.00 },
      { date: '2026-05-01', price: 1.01 },
    ]
    expect(summarizeTrend(points, { breakEven: 1.0 })).toMatch(/flat/i)
  })

  it('returns "no history" for empty input', () => {
    expect(summarizeTrend([], { breakEven: 1.0 })).toBe('no history')
  })

  it('reports drawdown when peak-to-trough exceeds 10%', () => {
    const points: Point[] = [
      { date: '2026-04-01', price: 1.0 },
      { date: '2026-04-15', price: 1.5 },
      { date: '2026-05-01', price: 1.1 },
    ]
    expect(summarizeTrend(points, { breakEven: 1.0 })).toMatch(/drawdown/i)
  })
})

describe('captionFromHistory', () => {
  it('formats date-anchored caption with first-date', () => {
    const points: Point[] = [
      { date: '2026-04-04', price: 1.0 },
      { date: '2026-05-01', price: 1.0 },
    ]
    expect(captionFromHistory(points)).toBe('// SINCE 2026-04-04')
  })

  it('flags thin data when length < 14', () => {
    const points: Point[] = [
      { date: '2026-05-01', price: 1.0 },
      { date: '2026-05-02', price: 1.0 },
    ]
    expect(captionFromHistory(points)).toBe('// SINCE 2026-05-01 · thin data (2 pts)')
  })

  it('returns empty-history caption when no points', () => {
    expect(captionFromHistory([])).toBe('// NO HISTORY')
  })
})
