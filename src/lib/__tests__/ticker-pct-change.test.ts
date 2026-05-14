import { describe, it, expect } from 'vitest'
import { buildPctChangeMap } from '../ticker-pct-change'

// NOTE: real MoverRow keys are `name` + `pct_change` (no `short_name`).
// The map keys by `name` so callers look up using the raw item name
// before applying Ticker's shortName transformation.
type Mover = { name: string; pct_change: number }

describe('buildPctChangeMap', () => {
  it('produces a Map keyed by name', () => {
    const movers: Mover[] = [
      { name: 'A', pct_change: 5 },
      { name: 'B', pct_change: -2.5 },
    ]
    const map = buildPctChangeMap(movers as any)
    expect(map.get('A')).toBe(5)
    expect(map.get('B')).toBe(-2.5)
  })

  it('returns empty map for empty input', () => {
    expect(buildPctChangeMap([]).size).toBe(0)
  })

  it('keeps the LATEST entry when name duplicates', () => {
    const movers: Mover[] = [
      { name: 'A', pct_change: 5 },
      { name: 'A', pct_change: 7 },
    ]
    expect(buildPctChangeMap(movers as any).get('A')).toBe(7)
  })
})
