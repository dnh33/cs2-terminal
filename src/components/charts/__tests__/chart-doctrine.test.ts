import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'

// Capture addSeries(ctor, options) calls by mocking lightweight-charts'
// createChart factory. This matches the pattern used by the existing
// Charts.PriceChart / Charts.PoolIndexChart tests (mocking at the LWC
// boundary, not the LWChart primitive).

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
    timeScale: () => ({
      fitContent: vi.fn(),
      setVisibleRange: vi.fn(),
      subscribeVisibleTimeRangeChange: vi.fn(),
      unsubscribeVisibleTimeRangeChange: vi.fn(),
    }),
    subscribeCrosshairMove: vi.fn(),
    subscribeClick: vi.fn(),
    unsubscribeCrosshairMove: vi.fn(),
    unsubscribeClick: vi.fn(),
    resize: vi.fn(),
  }),
}))

import { PriceChart } from '../PriceChart'
import { PoolIndexChart } from '../PoolIndexChart'
import type { ItemFull } from '../../CaseTable'

const makeItem = (overrides: Partial<ItemFull> = {}): ItemFull => ({
  id: 'glove',
  name: 'Glove Case',
  pool: 'discontinued',
  released: '2016-11-28',
  rare: 'Gloves',
  hasGloves: true,
  notable: '',
  price: { lowest: 247, median: 252, volume: 50 },
  metrics: { breakeven: 290, spread: 0.02, age_days: 3000 } as unknown as ItemFull['metrics'],
  history: [
    { date: '2024-05-06', price: 240, source: 'real' },
    { date: '2024-05-07', price: 245, source: 'real' },
  ],
  ...overrides,
})

describe('chart doctrine — Rule 9 (lines 1.5px, zero gradient fills)', () => {
  beforeEach(() => {
    addSeriesMock.mockClear()
  })

  it('PriceChart uses a Line-family series with lineWidth 1.5 (no AreaSeries)', () => {
    render(React.createElement(PriceChart, { item: makeItem() }))
    expect(addSeriesMock).toHaveBeenCalled()
    const [seriesCtor, options] = addSeriesMock.mock.calls[0]
    expect(String(seriesCtor).toLowerCase()).toContain('line')
    expect((options as { lineWidth?: number }).lineWidth).toBe(1.5)
    // Gradient form is forbidden by Rule 9 — no topColor/bottomColor allowed.
    expect((options as Record<string, unknown>).topColor).toBeUndefined()
    expect((options as Record<string, unknown>).bottomColor).toBeUndefined()
  })

  it('PoolIndexChart sets lineWidth 1.5 on ALL three series (DISC, RARE, ACTIVE)', () => {
    const poolIndex = {
      DISCONTINUED: [
        { snapshot_at: 100, vwap: 50, contributors: 3 },
        { snapshot_at: 200, vwap: 75, contributors: 4 },
      ],
      RARE: [
        { snapshot_at: 100, vwap: 25, contributors: 3 },
        { snapshot_at: 200, vwap: 26, contributors: 3 },
      ],
      ACTIVE: [
        { snapshot_at: 100, vwap: 5, contributors: 5 },
        { snapshot_at: 200, vwap: 5.1, contributors: 5 },
      ],
    }
    render(React.createElement(PoolIndexChart, { poolIndex, days: 30 }))
    expect(addSeriesMock).toHaveBeenCalledTimes(3)
    for (const call of addSeriesMock.mock.calls) {
      const options = call[1] as { lineWidth?: number }
      expect(options.lineWidth).toBe(1.5)
    }
  })
})
