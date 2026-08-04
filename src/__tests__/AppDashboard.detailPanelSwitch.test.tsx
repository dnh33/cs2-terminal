import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'

// Two cases with very different prices — switching between them should not
// make NumberFlip treat the new case's value as a "changed" price for the
// old case and animate.
vi.mock('../hooks/useMarketData', () => ({
  useMarketData: () => ({
    items: [
      { id: 'glove-case', name: 'Glove Case', released: '2016-11-28', pool: 'rare', rare: 'Gloves', hasGloves: true, notable: 'gloves',
        price: { lowest: 247.50, median: 250, volume: 12 },
        metrics: { spreadPct: 1, ageYears: 9, breakeven: 290, liquidity: 60, scarcity: 80, poolMul: 1.2 },
        history: [] },
      { id: 'fracture-case', name: 'Fracture Case', released: '2020-08-06', pool: 'active', rare: 'Knife', hasGloves: false, notable: '',
        price: { lowest: 0.81, median: 0.81, volume: 22669 },
        metrics: { spreadPct: 0, ageYears: 6, breakeven: 0.93, liquidity: 90, scarcity: 20, poolMul: 1 },
        history: [] },
    ],
    fetching: false, lastUpdated: 1, fetchError: null,
    stats: { last_snapshot_at: 1, cases_tracked: 2, total_cases: 2, total_volume_24h: 0, total_market_cap: 0, last_cron: null },
    fetchAll: vi.fn(), loadDemo: vi.fn(), loadRealHistory: vi.fn(),
    deepHistory: {}, loadDeepHistory: vi.fn(),
  }),
}))

vi.mock('../lib/api', async () => {
  const actual: any = await vi.importActual('../lib/api')
  return {
    ...actual,
    checkAuth: async () => ({ authenticated: true, auth_required: false }),
    logout: vi.fn(),
    fetchMovers: async () => ({ days: 7, movers: [] }),
    fetchCronRecent: vi.fn().mockResolvedValue({ runs: [] }),
  }
})

describe('AppDashboard detail-panel case switch (reported: numbers re-animate on opening a different case)', () => {
  beforeEach(() => {
    vi.resetModules()
    window.history.replaceState({}, '', '/')
    localStorage.clear()
  })

  it('does not leave a NumberFlip flash active in the detail panel after switching cases', async () => {
    // Test-level timeout bumped (default 5000ms): this test does two full
    // click -> settle cycles against the real App tree, and under heavy
    // full-suite parallel load (many AppDashboard.* files mounting the same
    // App concurrently) the cumulative wall-clock time can exceed the
    // default even though each individual waitFor's own condition resolves
    // well within ITS timeout — the outer test-level timeout was the one
    // actually firing.
    // Preselect Glove Case via URL (same trick AppDashboard.url.test.tsx
    // uses) instead of clicking it — halves the async settle work this
    // test needs before the part that actually matters: switching AWAY
    // from an already-selected case.
    window.history.replaceState({}, '', '/?case=glove-case')
    const Mod = await import('../App')
    const { container } = render(<Mod.default />)
    await waitFor(() => expect(screen.getAllByText(/GLOVE CASE/).length).toBeGreaterThan(0), { timeout: 10000 })
    await waitFor(() => expect(container.querySelector('[data-test="detail-panel"]')).not.toBeNull(), { timeout: 10000 })

    const fractureRow = screen.getAllByText('Fracture Case').map(n => n.closest('[role="row"]')).find(Boolean)
    await act(async () => { fractureRow!.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    await waitFor(() => expect(screen.getAllByText(/FRACTURE CASE/).length).toBeGreaterThan(0), { timeout: 10000 })

    let detailPanel: Element | null = null
    await waitFor(() => {
      detailPanel = container.querySelector('[data-test="detail-panel"]')
      expect(detailPanel).not.toBeNull()
    }, { timeout: 10000 })
    expect(detailPanel!.querySelectorAll('[data-flash]').length).toBe(0)
  }, 20000)
})
