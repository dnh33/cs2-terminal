import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

vi.mock('../hooks/useMarketData', () => ({
  useMarketData: () => ({
    items: [
      { id: 'glove-case', name: 'Glove Case', released: '2016-11-28', pool: 'rare', rare: 'Gloves', hasGloves: true, notable: 'gloves',
        price: { lowest: 247.50, median: 250, volume: 12 },
        metrics: { spreadPct: 1, ageYears: 9, breakeven: 290, liquidity: 60, scarcity: 80, poolMul: 1.2 }, history: [] },
      { id: 'recoil-case', name: 'Recoil Case', released: '2022-07-01', pool: 'active', rare: 'Knife', hasGloves: false, notable: 'none',
        price: { lowest: 1.20, median: 1.30, volume: 5000 },
        metrics: { spreadPct: 8, ageYears: 2, breakeven: 1.41, liquidity: 95, scarcity: 30, poolMul: 0.8 }, history: [] },
    ],
    fetching: false, lastUpdated: 1, fetchError: null,
    stats: { last_snapshot_at: 1, cases_tracked: 2, total_cases: 2, total_volume_24h: 0, total_market_cap: 0, last_cron: null },
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

describe('AppDashboard ⌘K palette wiring', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
    window.history.replaceState({}, '', '/')
    localStorage.clear()
  })

  it('opens CmdK on ⌘K keystroke', async () => {
    const Mod = await import('../App')
    render(<Mod.default />)
    await waitFor(() => expect(screen.getAllByText('Glove Case').length).toBeGreaterThan(0))
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    expect(screen.getByPlaceholderText(/Aim/i)).toBeInTheDocument()
  })

  it('CmdK has all items: cases + panels + actions + toggle', async () => {
    const Mod = await import('../App')
    render(<Mod.default />)
    await waitFor(() => expect(screen.getAllByText('Glove Case').length).toBeGreaterThan(0))
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    expect(screen.getByText('Run Market Scan')).toBeInTheDocument()
    expect(screen.getByText('Sign Out')).toBeInTheDocument()
    expect(screen.getByText(/Cycle Palette Mode/)).toBeInTheDocument()
  })

  it('Selecting a case via CmdK updates URL', async () => {
    const Mod = await import('../App')
    render(<Mod.default />)
    await waitFor(() => expect(screen.getAllByText('Glove Case').length).toBeGreaterThan(0))
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    // First option (alphabetical: Glove before Recoil) is selected; Enter activates
    fireEvent.keyDown(window, { key: 'Enter' })
    await waitFor(() => expect(window.location.search).toBe('?case=glove-case'))
  })

  it('Header ⌘K hint button opens the palette on click', async () => {
    const Mod = await import('../App')
    render(<Mod.default />)
    await waitFor(() => expect(screen.getAllByText('Glove Case').length).toBeGreaterThan(0))
    const hintBtns = screen.getAllByRole('button', { name: /command palette/i })
    expect(hintBtns.length).toBeGreaterThan(0)
    fireEvent.click(hintBtns[0])
    expect(screen.getByPlaceholderText(/Aim/i)).toBeInTheDocument()
  })
})
