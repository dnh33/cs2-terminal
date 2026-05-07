import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import React from 'react'

// P1-1 audit fix: vi.mock is hoisted above const declarations, so spies must
// also be hoisted via vi.hoisted() — otherwise ReferenceError at import time.
const { createChartMock, removeMock, applyOptionsMock, addSeriesMock } = vi.hoisted(() => ({
  createChartMock: vi.fn(),
  removeMock: vi.fn(),
  applyOptionsMock: vi.fn(),
  addSeriesMock: vi.fn(),
}))

// LWC v5 unified series API: chart.addSeries(SeriesType, opts)
vi.mock('lightweight-charts', () => ({
  // Series type tokens — opaque markers in tests; the runtime imports use the real ones.
  AreaSeries: 'AreaSeries',
  LineSeries: 'LineSeries',
  CrosshairMode: { Normal: 0, Magnet: 1 },
  ColorType: { Solid: 'solid' },
  createChart: (...args: unknown[]) => {
    createChartMock(...args)
    return {
      remove: removeMock,
      applyOptions: applyOptionsMock,
      addSeries: addSeriesMock,
      timeScale: () => ({ fitContent: vi.fn(), subscribeVisibleTimeRangeChange: vi.fn(), unsubscribeVisibleTimeRangeChange: vi.fn() }),
      subscribeCrosshairMove: vi.fn(),
      subscribeClick: vi.fn(),
      unsubscribeCrosshairMove: vi.fn(),
      unsubscribeClick: vi.fn(),
      resize: vi.fn(),
    }
  },
}))

import { LWChart, resolveToken } from '../LWChart'

beforeEach(() => {
  createChartMock.mockClear()
  removeMock.mockClear()
  applyOptionsMock.mockClear()
  addSeriesMock.mockClear()
  document.documentElement.removeAttribute('data-palette')
  document.documentElement.style.setProperty('--bg-1', '#0a0e14')
  document.documentElement.style.setProperty('--line', '#232932')
  document.documentElement.style.setProperty('--ink-1', '#c5cad1')
})

afterEach(() => {
  cleanup()
  document.documentElement.style.removeProperty('--bg-1')
  document.documentElement.style.removeProperty('--line')
  document.documentElement.style.removeProperty('--ink-1')
})

describe('resolveToken', () => {
  it('reads CSS custom property from documentElement', () => {
    expect(resolveToken('--bg-1')).toBe('#0a0e14')
    expect(resolveToken('--line')).toBe('#232932')
  })

  it('returns empty string for undeclared tokens', () => {
    expect(resolveToken('--does-not-exist')).toBe('')
  })
})

describe('LWChart', () => {
  it('calls createChart on mount with resolved hex colors', () => {
    render(<LWChart height={240} ariaLabel="test" />)
    expect(createChartMock).toHaveBeenCalledOnce()
    const [container, options] = createChartMock.mock.calls[0]
    expect(container).toBeInstanceOf(HTMLElement)
    expect(options.layout.background.color).toBe('#0a0e14')
    expect(options.layout.textColor).toBe('#c5cad1')
    expect(options.grid.horzLines.color).toBe('#232932')
  })

  it('calls chart.remove on unmount', () => {
    const { unmount } = render(<LWChart height={240} ariaLabel="test" />)
    unmount()
    expect(removeMock).toHaveBeenCalledOnce()
  })

  it('re-applies options when data-palette attribute changes', async () => {
    render(<LWChart height={240} ariaLabel="test" />)
    applyOptionsMock.mockClear()
    document.documentElement.style.setProperty('--bg-1', '#1a0a00')
    document.documentElement.setAttribute('data-palette', 'amber')
    // MutationObserver fires asynchronously
    await new Promise((r) => setTimeout(r, 10))
    expect(applyOptionsMock).toHaveBeenCalled()
    const lastCall = applyOptionsMock.mock.calls[applyOptionsMock.mock.calls.length - 1][0]
    expect(lastCall.layout.background.color).toBe('#1a0a00')
  })

  it('renders aria-label on wrapper', () => {
    const { getByLabelText } = render(<LWChart height={240} ariaLabel="Price chart for Glove Case" />)
    expect(getByLabelText('Price chart for Glove Case')).toBeTruthy()
  })
})
