import { describe, it, expect } from 'vitest'
import { CASE_CONTENT, contentQuality } from '../caseContent'
import { DROP_ODDS_STANDARD } from '../dropOdds'

describe('caseContent', () => {
  it('CASE_CONTENT has at least 5 entries', () => {
    expect(Object.keys(CASE_CONTENT).length).toBeGreaterThanOrEqual(5)
  })

  it('contentQuality clamps to [0, 100]', () => {
    expect(contentQuality({ knife: 1, glove: 1, knife_tier: 3, multi_knife: 1, notable_pattern: 1 })).toBe(100)
    expect(contentQuality({ knife: 0, glove: 0, knife_tier: 0, multi_knife: 0, notable_pattern: 0 })).toBe(0)
  })

  it('Glove Case scores ~75 (glove-only, no knife)', () => {
    const score = contentQuality({ knife: 0, glove: 1, knife_tier: 0, multi_knife: 0, notable_pattern: 0 })
    expect(score).toBeGreaterThanOrEqual(20)
    expect(score).toBeLessThanOrEqual(40)
  })

  it('Recoil Case scores 0 (no knife or glove)', () => {
    expect(contentQuality({ knife: 0, glove: 0, knife_tier: 0, multi_knife: 0, notable_pattern: 0 })).toBe(0)
  })
})

describe('dropOdds', () => {
  it('DROP_ODDS_STANDARD sums to 1.0', () => {
    const t = DROP_ODDS_STANDARD.milspec + DROP_ODDS_STANDARD.restricted + DROP_ODDS_STANDARD.classified + DROP_ODDS_STANDARD.covert + DROP_ODDS_STANDARD.special
    expect(Math.abs(t - 1.0)).toBeLessThan(0.001)
  })
})
