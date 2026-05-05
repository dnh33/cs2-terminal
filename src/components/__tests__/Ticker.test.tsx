import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Ticker, type TickerRow } from '../Ticker'

const rows: TickerRow[] = [
  { shortName: 'AK Redline', price: 12.34, pool: 'active' },
  { shortName: 'M4 Howl',   price: 99.99, pool: 'rare' },
]

describe('Ticker', () => {
  it('returns null when rows are empty', () => {
    const { container } = render(<Ticker rows={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('applies pause-on-hover via group + group-hover animation-play-state', () => {
    const { container } = render(<Ticker rows={rows} />)
    const outer = container.querySelector('[role="region"]')
    expect(outer).not.toBeNull()
    expect(outer!.className).toMatch(/\bgroup\b/)
    const inner = outer!.querySelector('div')
    expect(inner).not.toBeNull()
    expect(inner!.className).toMatch(/group-hover:\[animation-play-state:paused\]/)
  })

  it('includes motion-reduce fallback classes', () => {
    const { container } = render(<Ticker rows={rows} />)
    const inner = container.querySelector('[role="region"] > div')
    expect(inner).not.toBeNull()
    expect(inner!.className).toMatch(/motion-reduce:animate-none/)
    expect(inner!.className).toMatch(/motion-reduce:overflow-x-auto/)
  })

  it('uses the --ticker-duration-bound animation utility', () => {
    const { container } = render(<Ticker rows={rows} />)
    const inner = container.querySelector('[role="region"] > div')
    expect(inner!.className).toMatch(/animate-ticker-drift/)
  })

  it('omits Δ% column when pctChange is undefined', () => {
    const { container } = render(<Ticker rows={rows} />)
    expect(container.textContent).not.toMatch(/▲|▼/)
  })

  it('renders Δ% with up glyph when pctChange is positive', () => {
    const withChange: TickerRow[] = [{ ...rows[0], pctChange: 4.2 }]
    const { container } = render(<Ticker rows={withChange} />)
    expect(container.textContent).toMatch(/▲/)
    expect(container.textContent).toMatch(/4\.2%/)
  })

  it('renders Δ% with down glyph when pctChange is negative', () => {
    const withChange: TickerRow[] = [{ ...rows[0], pctChange: -3.1 }]
    const { container } = render(<Ticker rows={withChange} />)
    expect(container.textContent).toMatch(/▼/)
    expect(container.textContent).toMatch(/3\.1%/)
  })
})
