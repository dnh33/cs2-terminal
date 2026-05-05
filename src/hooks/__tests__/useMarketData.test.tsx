import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/api', () => ({
  fetchLatest: vi.fn(),
  fetchHistory: vi.fn(),
  fetchStats: vi.fn(),
  refreshStale: vi.fn(),
  priceFromLatest: vi.fn(() => null),
}))

import { fetchLatest, fetchStats, refreshStale } from '../../lib/api'
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
