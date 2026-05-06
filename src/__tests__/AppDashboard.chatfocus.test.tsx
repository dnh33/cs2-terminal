import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

vi.mock('../hooks/useMarketData', () => ({
  useMarketData: () => ({
    items: [
      { id: 'glove-case', name: 'Glove Case', released: '2016-11-28', pool: 'rare', rare: 'Gloves', hasGloves: true, notable: 'gloves',
        price: { lowest: 247.50, median: 250, volume: 12 },
        metrics: { spreadPct: 1, ageYears: 9, breakeven: 290, liquidity: 60, scarcity: 80, poolMul: 1.2 }, history: [] },
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

describe('AppDashboard / focuses chat', () => {
  beforeEach(() => { window.history.replaceState({}, '', '/'); localStorage.clear() })

  it('focuses chat input on `/` keystroke (when no input is focused)', async () => {
    const Mod = await import('../App')
    render(<Mod.default />)
    await waitFor(() => expect(screen.getByPlaceholderText(/ask the analyst/i)).toBeInTheDocument())
    const input = screen.getByPlaceholderText(/ask the analyst/i) as HTMLInputElement
    expect(document.activeElement).not.toBe(input)
    fireEvent.keyDown(window, { key: '/' })
    expect(document.activeElement).toBe(input)
  })

  it('does NOT prevent / from being typed inside an already-focused input', async () => {
    const Mod = await import('../App')
    render(<Mod.default />)
    await waitFor(() => expect(screen.getByPlaceholderText(/ask the analyst/i)).toBeInTheDocument())
    const input = screen.getByPlaceholderText(/ask the analyst/i) as HTMLInputElement
    input.focus()
    const event = new KeyboardEvent('keydown', { key: '/', cancelable: true })
    window.dispatchEvent(event)
    // We expect preventDefault NOT called (the input should receive the literal /)
    expect(event.defaultPrevented).toBe(false)
  })
})
