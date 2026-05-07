import { describe, it, expect } from 'vitest'
import { clampN, formatCronRow, parseKind, handleCronRecent } from './cronRecent'

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

describe('parseKind', () => {
  it('returns "case" for null/undefined/empty/invalid', () => {
    expect(parseKind(null)).toBe('case')
    expect(parseKind('')).toBe('case')
    expect(parseKind('invalid')).toBe('case')
    expect(parseKind('garbage')).toBe('case')
  })

  it('returns "case" for explicit "case" (backward-compat)', () => {
    expect(parseKind('case')).toBe('case')
  })

  it('returns "item_high" for "item_high"', () => {
    expect(parseKind('item_high')).toBe('item_high')
  })

  it('returns "item_low" for "item_low"', () => {
    expect(parseKind('item_low')).toBe('item_low')
  })
})

describe('handleCronRecent kind filtering', () => {
  function makeEnv(rows: any[] = []) {
    const calls: { sql: string; bound: any[] }[] = []
    const env = {
      DB: {
        prepare: (sql: string) => ({
          bind: (...args: any[]) => ({
            all: async () => {
              calls.push({ sql, bound: args })
              return { results: rows }
            },
          }),
        }),
      },
    } as any
    return { env, calls }
  }

  it('default (no kind param) queries kind=case', async () => {
    const { env, calls } = makeEnv()
    const url = new URL('https://x/cron/recent?n=5')
    await handleCronRecent(url, env)
    expect(calls[0].bound[0]).toBe('case')
  })

  it('?kind=item_high queries kind=item_high', async () => {
    const { env, calls } = makeEnv()
    const url = new URL('https://x/cron/recent?n=5&kind=item_high')
    await handleCronRecent(url, env)
    expect(calls[0].bound[0]).toBe('item_high')
  })

  it('?kind=item_low queries kind=item_low', async () => {
    const { env, calls } = makeEnv()
    const url = new URL('https://x/cron/recent?n=5&kind=item_low')
    await handleCronRecent(url, env)
    expect(calls[0].bound[0]).toBe('item_low')
  })

  it('?kind=garbage falls back to case (no error)', async () => {
    const { env, calls } = makeEnv()
    const url = new URL('https://x/cron/recent?n=5&kind=garbage')
    await handleCronRecent(url, env)
    expect(calls[0].bound[0]).toBe('case')
  })
})
