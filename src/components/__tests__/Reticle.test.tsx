import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { RefObject } from 'react'
import { Reticle } from '../Reticle'
import type { LWChartRef } from '../primitives/LWChart'
import type { ItemFull } from '../CaseTable'

const makeItem = (): ItemFull => ({
  id: 'glove',
  name: 'Glove Case',
  pool: 'discontinued',
  released: '2016-11-28',
  rare: 'Gloves',
  hasGloves: true,
  notable: '',
  price: { lowest: 247, median: 252, volume: 50 },
  metrics: {
    ageDays: 3000,
    ageYears: 8,
    spread: 5,
    spreadPct: 2,
    liquidity: 50,
    poolMul: 1,
    scarcity: 80,
    breakeven: 290,
  },
  history: [
    { date: '2024-01-01', price: 200, source: 'real' },
    { date: '2024-02-01', price: 250, source: 'real' },
    { date: '2024-03-01', price: 247, source: 'real' },
  ],
})

const makeChartRef = (): RefObject<LWChartRef | null> => {
  const ref = { current: null as LWChartRef | null }
  ref.current = {
    getChart: () => null, // jsdom — no real chart
    setMainSeries: () => {},
    getMainSeries: () => null,
  }
  return ref as RefObject<LWChartRef | null>
}

describe('Reticle', () => {
  it('renders nothing when state is IDLE', () => {
    const { container } = render(<Reticle item={makeItem()} chartRef={makeChartRef()} peers={[]} />)
    expect(container.querySelector('[data-reticle-readout]')).toBeNull()
    expect(container.querySelector('[data-reticle-overlay]')).toBeNull()
  })

  it('renders [● TARGET] indicator when toggled to TRACKING', () => {
    render(<Reticle item={makeItem()} chartRef={makeChartRef()} peers={[]} />)
    fireEvent.keyDown(window, { key: 'r' })
    expect(screen.getByText(/TARGET/i)).toBeTruthy()
  })

  it('Esc returns to IDLE from TRACKING', () => {
    render(<Reticle item={makeItem()} chartRef={makeChartRef()} peers={[]} />)
    fireEvent.keyDown(window, { key: 'r' })
    expect(screen.queryByText(/TARGET/i)).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByText(/TARGET/i)).toBeFalsy()
  })

  it('does not toggle when typing in input', () => {
    const { container } = render(
      <div>
        <input data-testid="some-input" />
        <Reticle item={makeItem()} chartRef={makeChartRef()} peers={[]} />
      </div>,
    )
    const input = container.querySelector('input')!
    input.focus()
    fireEvent.keyDown(input, { key: 'r' })
    expect(screen.queryByText(/TARGET/i)).toBeFalsy()
  })

  it('uppercase R does not trigger', () => {
    render(<Reticle item={makeItem()} chartRef={makeChartRef()} peers={[]} />)
    fireEvent.keyDown(window, { key: 'R' })
    expect(screen.queryByText(/TARGET/i)).toBeFalsy()
  })
})
