import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

// P1-1 audit fix: hoisted spies for vi.mock factory. v5 unified addSeries API.
const { createChartMock, addSeriesMock } = vi.hoisted(() => ({
  createChartMock: vi.fn(),
  addSeriesMock: vi.fn(() => ({
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
  createChart: (...args: unknown[]) => {
    createChartMock(...args)
    return {
      remove: vi.fn(),
      applyOptions: vi.fn(),
      addSeries: addSeriesMock,
      timeScale: () => ({ fitContent: vi.fn(), setVisibleRange: vi.fn(), subscribeVisibleTimeRangeChange: vi.fn(), unsubscribeVisibleTimeRangeChange: vi.fn() }),
      subscribeCrosshairMove: vi.fn(),
      subscribeClick: vi.fn(),
      unsubscribeCrosshairMove: vi.fn(),
      unsubscribeClick: vi.fn(),
      resize: vi.fn(),
    }
  },
}))

import { PriceChart } from '../charts/PriceChart'
import type { ItemFull } from '../CaseTable'

const makeItem = (overrides: Partial<ItemFull> = {}): ItemFull => ({
  id: 'glove',
  name: 'Glove Case',
  pool: 'discontinued',
  released: '2016-11-28',
  rare: 'Gloves',
  hasGloves: true,
  notable: '',
  price: { lowest: 247, median: 252, volume: 50 },
  metrics: { breakeven: 290, spread: 0.02, age_days: 3000 } as any,
  history: [
    { date: '2024-05-06', price: 240, source: 'real' },
    { date: '2024-05-07', price: 245, source: 'real' },
    { date: '2024-05-08', price: 247, source: 'real' },
  ],
  ...overrides,
})

describe('PriceChart (LWC)', () => {
  beforeEach(() => {
    createChartMock.mockClear()
    addSeriesMock.mockClear()
  })

  it('creates an LWC chart with a line series for non-empty history (Rule 9 — no gradient fills)', () => {
    render(<PriceChart item={makeItem()} />)
    expect(createChartMock).toHaveBeenCalledOnce()
    expect(addSeriesMock).toHaveBeenCalledWith('LineSeries', expect.any(Object))
  })

  it('renders fallback when history is empty', () => {
    const { getByText } = render(<PriceChart item={makeItem({ history: [] })} />)
    expect(getByText(/NO HISTORICAL DATA/i)).toBeTruthy()
    expect(createChartMock).not.toHaveBeenCalled()
  })

  it('exposes ARIA summary on wrapper (F18: trend-shape signal)', () => {
    const { getByRole } = render(<PriceChart item={makeItem()} />)
    const img = getByRole('img')
    const label = img.getAttribute('aria-label') ?? ''
    expect(label).toContain('Glove Case')
    // Post-F18 the aria-label carries trend shape, not raw point count.
    // History rises 240 → 247 (~3%) over 2 days; breakeven (290) never crossed.
    expect(label).toMatch(/ris|fall|flat/i)
    expect(label).toMatch(/days/i)
  })

  it('renders date-anchored caption (F8) with thin-data flag for < 14d span', () => {
    const { getByText } = render(<PriceChart item={makeItem()} />)
    expect(getByText(/\/\/ SINCE 2024-05-06/)).toBeTruthy()
    expect(getByText(/thin data \(3 pts\)/)).toBeTruthy()
  })
})
