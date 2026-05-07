import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'

// Mock useMarketData so we don't hit the worker.
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
  const actual: any = await vi.importActual('../lib/api')
  return {
    ...actual,
    checkAuth: async () => ({ authenticated: true, auth_required: false }),
    logout: vi.fn(),
    fetchMovers: async () => ({ days: 7, movers: [] }),
    fetchCronRecent: vi.fn().mockResolvedValue({ runs: [] }),
  }
})

describe('AppDashboard URL state', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/')
    localStorage.clear()
  })

  it('selects the case from ?case= on load', async () => {
    window.history.replaceState({}, '', '/?case=glove-case')
    const Mod = await import('../App')
    render(<Mod.default />)
    await waitFor(() => expect(screen.queryByText(/SELECT A CASE/i)).not.toBeInTheDocument())
    // The DetailPanel header includes the case name in uppercase
    // Per P2-T27, DetailPanel renders both desktop + mobile wrappers in jsdom,
    // so the case name appears in both copies.
    expect(screen.getAllByText(/GLOVE CASE/).length).toBeGreaterThan(0)
  })

  it('updates URL when a case is selected', async () => {
    const Mod = await import('../App')
    render(<Mod.default />)
    await waitFor(() => expect(screen.getAllByText('Glove Case').length).toBeGreaterThan(0))
    // Click the case row (the row label includes the case name)
    const row = screen.getAllByText('Glove Case').map(n => n.closest('[role="row"]')).find(Boolean)
    expect(row).toBeTruthy()
    // Wrap the synchronous click in act() — it triggers a setState chain
    // (selection → URL push → re-render → real-history fetch effect) that
    // would otherwise emit React's "not wrapped in act" warning during the
    // useEffect's commit phase. waitFor below catches the URL update.
    await act(async () => {
      row!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await waitFor(() => expect(window.location.search).toBe('?case=glove-case'))
  })
})
