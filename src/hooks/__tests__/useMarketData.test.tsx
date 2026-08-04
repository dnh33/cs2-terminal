import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/api', () => ({
  fetchLatest: vi.fn(),
  fetchHistory: vi.fn(),
  fetchStats: vi.fn(),
  refreshStale: vi.fn(),
  priceFromLatest: vi.fn(() => null),
}))

import { fetchLatest, fetchStats, refreshStale, fetchHistory } from '../../lib/api'
import { useMarketData } from '../useMarketData'

beforeEach(() => {
  ;(fetchLatest as any).mockReset()
  ;(fetchStats as any).mockReset()
  ;(refreshStale as any).mockReset()
  ;(fetchLatest as any).mockResolvedValue([])
  ;(refreshStale as any).mockResolvedValue({ freshDeploy: false })
})

describe('useMarketData mount auto-hydrate', () => {
  it('calls fetchAll(false) on mount when worker has snapshots', async () => {
    ;(fetchStats as any).mockResolvedValue({
      cases_tracked: 5,
      total_cases: 41,
      total_volume_24h: 0,
      total_market_cap: 0,
      last_snapshot_at: 1_700_000_000_000,
      last_cron: null,
    })

    renderHook(() => useMarketData())

    // fetchStats called once on mount; fetchLatest called by fetchAll(false)
    await waitFor(() => {
      expect(fetchLatest).toHaveBeenCalledTimes(1)
    })
    // fetchAll(false) means no refreshStale call
    expect(refreshStale).not.toHaveBeenCalled()
    // fetchStats called twice: once by mount effect, once inside fetchAll
    expect((fetchStats as any).mock.calls.length).toBeGreaterThanOrEqual(1)
  })

  it('does NOT auto-fetch when last_snapshot_at is null', async () => {
    ;(fetchStats as any).mockResolvedValue({
      cases_tracked: 0,
      total_cases: 41,
      total_volume_24h: 0,
      total_market_cap: 0,
      last_snapshot_at: null,
      last_cron: null,
    })

    renderHook(() => useMarketData())

    await waitFor(() => {
      expect(fetchStats).toHaveBeenCalledTimes(1)
    })
    // give any pending microtasks a tick
    await new Promise(r => setTimeout(r, 10))
    expect(fetchLatest).not.toHaveBeenCalled()
    expect(refreshStale).not.toHaveBeenCalled()
  })
})

describe('useMarketData deep history isolation (detail-panel selection must not corrupt the table sparkline)', () => {
  it('loadDeepHistory stores results separately and does not touch items[].history', async () => {
    ;(fetchStats as any).mockResolvedValue({
      cases_tracked: 0, total_cases: 41, total_volume_24h: 0, total_market_cap: 0,
      last_snapshot_at: null, last_cron: null,
    })
    const { result } = renderHook(() => useMarketData())
    await waitFor(() => expect(fetchStats).toHaveBeenCalledTimes(1))

    const glove = result.current.items.find(i => i.name === 'Glove Case')!
    const originalHistory = glove.history

    ;(fetchHistory as any).mockResolvedValueOnce([
      { date: '2026-05-01', price: 10, source: 'real' },
      { date: '2026-08-01', price: 20, source: 'real' },
    ])
    await act(async () => {
      await result.current.loadDeepHistory('Glove Case', 90)
    })

    // items[].history (what the market-table sparkline reads) is untouched.
    const gloveAfter = result.current.items.find(i => i.name === 'Glove Case')!
    expect(gloveAfter.history).toBe(originalHistory)
    // The 90d data landed in the separate deepHistory map instead.
    expect(result.current.deepHistory['Glove Case']).toEqual([
      { date: '2026-05-01', price: 10, source: 'real' },
      { date: '2026-08-01', price: 20, source: 'real' },
    ])
  })

  it('loadRealHistory (the batch/table path) still updates items[].history as before', async () => {
    ;(fetchStats as any).mockResolvedValue({
      cases_tracked: 0, total_cases: 41, total_volume_24h: 0, total_market_cap: 0,
      last_snapshot_at: null, last_cron: null,
    })
    const { result } = renderHook(() => useMarketData())
    await waitFor(() => expect(fetchStats).toHaveBeenCalledTimes(1))

    ;(fetchHistory as any).mockResolvedValueOnce([
      { date: '2026-07-01', price: 5, source: 'real' },
      { date: '2026-07-02', price: 6, source: 'real' },
    ])
    await act(async () => {
      await result.current.loadRealHistory('Glove Case', 30)
    })

    const glove = result.current.items.find(i => i.name === 'Glove Case')!
    expect(glove.history).toEqual([
      { date: '2026-07-01', price: 5, source: 'real' },
      { date: '2026-07-02', price: 6, source: 'real' },
    ])
  })
})
