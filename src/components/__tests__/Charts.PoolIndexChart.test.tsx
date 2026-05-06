import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

// P1-1 audit fix: hoisted spies for vi.mock factory. v5 unified addSeries API.
const { addSeriesMock } = vi.hoisted(() => ({
  addSeriesMock: vi.fn((..._args: unknown[]) => ({
    setData: vi.fn(),
    applyOptions: vi.fn(),
    createPriceLine: vi.fn(),
    priceToCoordinate: vi.fn(),
  })),
}))

vi.mock('lightweight-charts', () => ({
  AreaSeries: 'AreaSeries',
  LineSeries: 'LineSeries',
  CrosshairMode: { Normal: 0, Magnet: 1 },
  ColorType: { Solid: 'solid' },
  createChart: () => ({
    remove: vi.fn(),
    applyOptions: vi.fn(),
    addSeries: addSeriesMock,
    timeScale: () => ({ fitContent: vi.fn(), subscribeVisibleTimeRangeChange: vi.fn(), unsubscribeVisibleTimeRangeChange: vi.fn() }),
    subscribeCrosshairMove: vi.fn(),
    subscribeClick: vi.fn(),
    unsubscribeCrosshairMove: vi.fn(),
    unsubscribeClick: vi.fn(),
    resize: vi.fn(),
  }),
}))

import { PoolIndexChart } from '../Charts'

describe('PoolIndexChart', () => {
  it('adds 3 line series for DISC/RARE/ACTIVE', () => {
    addSeriesMock.mockClear()
    const poolIndex = {
      DISCONTINUED: [{ snapshot_at: 100, vwap: 50, contributors: 3 }, { snapshot_at: 200, vwap: 75, contributors: 4 }],
      RARE:         [{ snapshot_at: 100, vwap: 25, contributors: 3 }, { snapshot_at: 200, vwap: 26, contributors: 3 }],
      ACTIVE:       [{ snapshot_at: 100, vwap: 5,  contributors: 5 }, { snapshot_at: 200, vwap: 5.1, contributors: 5 }],
    }
    render(<PoolIndexChart poolIndex={poolIndex} days={30} />)
    expect(addSeriesMock).toHaveBeenCalledTimes(3)
    // All three calls pass LineSeries as the first arg.
    expect(addSeriesMock.mock.calls.every(c => c[0] === 'LineSeries')).toBe(true)
  })

  it('exposes aria-label with current index values', () => {
    const poolIndex = {
      DISCONTINUED: [{ snapshot_at: 100, vwap: 50, contributors: 3 }, { snapshot_at: 200, vwap: 75, contributors: 4 }],
      RARE:         [{ snapshot_at: 100, vwap: 25, contributors: 3 }],
      ACTIVE:       [{ snapshot_at: 100, vwap: 5,  contributors: 5 }],
    }
    const { getByRole } = render(<PoolIndexChart poolIndex={poolIndex} days={30} />)
    const img = getByRole('img')
    expect(img.getAttribute('aria-label')).toContain('30-day pool index')
    expect(img.getAttribute('aria-label')).toContain('DISC at 150.0')
  })

  it('renders empty-state placeholder when no pools have any points', () => {
    const empty = { DISCONTINUED: [], RARE: [], ACTIVE: [] }
    const { getByText } = render(<PoolIndexChart poolIndex={empty} days={7} />)
    expect(getByText(/INSUFFICIENT POOL DATA/i)).toBeTruthy()
  })
})
