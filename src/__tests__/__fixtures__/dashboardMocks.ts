import { vi } from 'vitest'

/**
 * Hoisted dashboard test fixtures — used by AppDashboard.* test files that
 * render the full App tree. Keep stub shapes in ONE place so model-shape
 * changes in useMarketData / api.checkAuth ripple through one edit, not N.
 *
 * Existing test files (cmdk, url, chatfocus, drawer, reshape) keep their
 * own inline stubs for now; migration is out of scope for Plan 3.
 */
export function mockUseMarketDataWithGloveCase() {
  vi.mock('../../hooks/useMarketData', () => ({
    useMarketData: () => ({
      items: [
        {
          id: 'glove-case', name: 'Glove Case', released: '2016-11-28', pool: 'rare',
          rare: 'Gloves', hasGloves: true, notable: 'gloves',
          price: { lowest: 247.50, median: 250, volume: 12 },
          metrics: { ageDays: 3287, ageYears: 9, spread: 2.5, spreadPct: 1, breakeven: 290, liquidity: 60, scarcity: 80, poolMul: 1.2 },
          history: [],
        },
      ],
      fetching: false, lastUpdated: 1, fetchError: null,
      stats: { last_snapshot_at: 1, cases_tracked: 1, total_cases: 1, total_volume_24h: 0, total_market_cap: 0, last_cron: null },
      fetchAll: vi.fn(), loadDemo: vi.fn(), loadRealHistory: vi.fn(),
      deepHistory: {}, loadDeepHistory: vi.fn(),
    }),
  }))
}

export function mockAuth() {
  vi.mock('../../lib/api', async () => {
    const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api')
    return { ...actual, checkAuth: async () => ({ authenticated: true, auth_required: false }), logout: vi.fn() }
  })
}
