import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MarketStats } from '../MarketStats'
import type { ItemWithPrice } from '../MarketStats'
import type { MoverRow } from '../../lib/api'

const noPrice: ItemWithPrice = {
  id: 'x', name: 'X', pool: 'active', released: '2020-01-01',
  rare: 'Knife', hasGloves: false, notable: '', price: null,
}

const priced: ItemWithPrice = {
  id: 'glove', name: 'Glove Case', pool: 'rare', released: '2016-11-28',
  rare: 'Gloves', hasGloves: true, notable: 'gloves',
  price: { lowest: 250, median: 260, volume: 100 },
}

const topMover: MoverRow = {
  id: 'spectrum', name: 'Spectrum Case', pool: 'active',
  first_price: 1.50, last_price: 1.80, last_at: Math.floor(Date.now() / 1000),
  pct_change: 20.0,
}

describe('MarketStats skeleton state', () => {
  it('renders skeleton cards when no items have prices yet', () => {
    const { container } = render(<MarketStats items={[noPrice]} />)
    const region = screen.getByLabelText(/loading market stats/i)
    expect(region).toHaveAttribute('aria-busy', 'true')
    // Plan 1: 4 stat cards (1 dominant + 3 satellites) × 3 skeleton lines = 12
    const placeholders = container.querySelectorAll('[aria-hidden="true"]')
    expect(placeholders.length).toBeGreaterThanOrEqual(12)
  })
})

describe('MarketStats HERO STRIP (Phase 4.5 Plan 1)', () => {
  it('renders 24H DOLLAR VOLUME as the dominant block (NOT DAILY MARKET CAP)', () => {
    const { container } = render(<MarketStats items={[priced]} topMover={topMover} />)
    expect(screen.queryByText(/DAILY MARKET CAP/)).toBeNull()
    expect(screen.getByText(/24H DOLLAR VOLUME/)).toBeTruthy()
    expect(container.querySelector('[data-test="hero-dominant"]')).not.toBeNull()
  })

  it('renders BIGGEST MOVER 24H satellite with the top mover name and pct_change', () => {
    const { container } = render(<MarketStats items={[priced]} topMover={topMover} />)
    expect(screen.getByText(/BIGGEST MOVER 24H/)).toBeTruthy()
    expect(screen.getByText(/Spectrum Case/)).toBeTruthy()
    expect(container.textContent).toMatch(/\+20\.0%/)
  })

  it('does NOT render HIGHEST PRICE or 24H VOLUME (units) blocks', () => {
    render(<MarketStats items={[priced]} topMover={topMover} />)
    expect(screen.queryByText(/HIGHEST PRICE/)).toBeNull()
    // Old units-volume label was just "24H VOLUME" with sub "units sold". The
    // new label is "24H DOLLAR VOLUME" — the regex matches "24H VOLUME" only
    // when it's the FULL text content, not when it's a substring of the new
    // label. Use exact-text matcher.
    expect(screen.queryByText('24H VOLUME')).toBeNull()
  })

  it('renders Δ24h placeholder slot under the dominant block', () => {
    const { container } = render(<MarketStats items={[priced]} topMover={topMover} />)
    const dominant = container.querySelector('[data-test="hero-dominant"]')
    expect(dominant).not.toBeNull()
    expect(dominant!.textContent).toMatch(/Δ24H · —/)
  })

  it('renders BIGGEST MOVER skeleton when topMover is undefined (loading)', () => {
    const { container } = render(<MarketStats items={[priced]} topMover={undefined} />)
    expect(screen.getByText(/BIGGEST MOVER 24H/)).toBeTruthy()
    expect(container.textContent).not.toMatch(/Spectrum Case/)
  })

  it('renders BIGGEST MOVER em-dash placeholder when topMover is null (fetched empty)', () => {
    const { container } = render(<MarketStats items={[priced]} topMover={null} />)
    expect(screen.getByText(/BIGGEST MOVER 24H/)).toBeTruthy()
    expect(container.textContent).toMatch(/—/)
  })

  it('renders TRACKED/DB and DISC/ACTIVE satellites (preserved from prior shape)', () => {
    render(<MarketStats items={[priced]} topMover={topMover} />)
    expect(screen.getByText(/CASES TRACKED/)).toBeTruthy()
    expect(screen.getByText(/DISC \/ ACTIVE/)).toBeTruthy()
  })
})
