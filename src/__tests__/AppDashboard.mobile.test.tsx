import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('../hooks/useMarketData', () => ({
  useMarketData: () => ({
    items: [
      { id: 'glove-case', name: 'Glove Case', released: '2016-11-28', pool: 'rare', rare: 'Gloves', hasGloves: true, notable: 'gloves',
        price: { lowest: 247.50, median: 250, volume: 12 },
        metrics: { spreadPct: 1, ageYears: 9, breakeven: 290, liquidity: 60, scarcity: 80, poolMul: 1.2 },
        history: [] },
    ],
    fetching: false, lastUpdated: 1, fetchError: null,
    stats: { last_snapshot_at: 1, cases_tracked: 1, total_cases: 1, total_volume_24h: 0, total_market_cap: 0, last_cron: null },
    fetchAll: vi.fn(), loadDemo: vi.fn(), loadRealHistory: vi.fn(),
  }),
}))

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api')
  return { ...actual, checkAuth: async () => ({ authenticated: true, auth_required: false }), logout: vi.fn() }
})

describe('AppDashboard responsive Tailwind classes (CSS-presence test)', () => {
  // NOTE: jsdom does NOT execute Tailwind's media-query breakpoints —
  // both grid-cols-1 and md:grid-cols-... appear in the className string
  // simultaneously. These tests verify the responsive class strings are
  // EMITTED, not that the layout actually flips at <md. True layout
  // verification requires a real browser (Playwright manual smoke pass
  // in Plan 1 verification gate).

  beforeEach(() => {
    window.history.replaceState({}, '', '/')
    localStorage.clear()
  })

  it('CaseTable + DetailPanel grid renders responsive Tailwind classes', async () => {
    const Mod = await import('../App')
    const { container } = render(<Mod.default />)
    // Wait a tick for AppGate to resolve auth
    await new Promise((r) => setTimeout(r, 0))
    const grid = container.querySelector('[data-test="table-detail-grid"]')
    expect(grid).not.toBeNull()
    expect(grid!.className).toMatch(/grid-cols-1/)
    expect(grid!.className).toMatch(/md:grid-cols-\[1\.4fr_1fr\]/)
  })

  it('Chart row renders responsive Tailwind classes', async () => {
    const Mod = await import('../App')
    const { container } = render(<Mod.default />)
    await new Promise((r) => setTimeout(r, 0))
    const chartGrid = container.querySelector('[data-test="chart-row"]')
    expect(chartGrid).not.toBeNull()
    expect(chartGrid!.className).toMatch(/grid-cols-1/)
    expect(chartGrid!.className).toMatch(/md:grid-cols-2/)
  })
})
