import { describe, it, expect } from 'vitest'
import { clampN, formatCronRow } from './cronRecent'

describe('clampN', () => {
  it('clamps to [1, 48]', () => {
    expect(clampN(0)).toBe(1)
    expect(clampN(1)).toBe(1)
    expect(clampN(24)).toBe(24)
    expect(clampN(48)).toBe(48)
    expect(clampN(168)).toBe(48)
    expect(clampN(NaN)).toBe(24) // default
    expect(clampN(undefined as unknown as number)).toBe(24)
  })
})

describe('formatCronRow', () => {
  it('computes duration_s correctly', () => {
    const row = {
      started_at: 1714989600,
      finished_at: 1714989762,
      succeeded: 33,
      failed: 0,
      error: null,
    }
    const out = formatCronRow(row)
    expect(out.duration_s).toBe(162)
    expect(out.error).toBeNull()
  })

  it('handles null finished_at (incomplete run)', () => {
    const row = {
      started_at: 1714989600,
      finished_at: null,
      succeeded: 0,
      failed: 0,
      error: 'timeout',
    }
    const out = formatCronRow(row)
    expect(out.duration_s).toBeNull()
    expect(out.error).toBe('timeout')
  })
})
