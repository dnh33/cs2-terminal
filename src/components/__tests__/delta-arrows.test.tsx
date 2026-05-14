import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MarketStats, type ItemWithPrice } from '../MarketStats'
import type { MoverRow } from '../../lib/api'

// F16 — colour-only delta direction fails colour-blind / palette-blind users.
// Arrows (▲/▼) are sole load-bearing direction signal in AMBER/GREEN palettes.

function makeItems(): ItemWithPrice[] {
  return [
    {
      id: 'a',
      name: 'Alpha Case',
      released: '2020-01-01',
      pool: 'discontinued',
      rare: 'Knife',
      hasGloves: false,
      notable: 'n/a',
      price: { lowest: 10, median: 11, highest: 12, volume: 100, ts: 0 } as any,
    },
    {
      id: 'b',
      name: 'Bravo Case',
      released: '2024-01-01',
      pool: 'active',
      rare: 'Knife',
      hasGloves: false,
      notable: 'n/a',
      price: { lowest: 5, median: 5.5, highest: 6, volume: 200, ts: 0 } as any,
    },
  ]
}

function makeMover(pct: number): MoverRow {
  return {
    id: 'a',
    name: 'Alpha Case',
    pool: 'discontinued',
    first_price: 8,
    last_price: pct >= 0 ? 10 : 6,
    last_at: 0,
    pct_change: pct,
  }
}

describe('MarketStats — Δ-direction arrows (F16)', () => {
  it('positive mover: renders ▲ glyph alongside the pct_change number', () => {
    const { container } = render(
      <MarketStats items={makeItems()} topMover={makeMover(5)} />,
    )
    expect(container.textContent).toMatch(/▲/)
  })

  it('negative mover: renders ▼ glyph alongside the pct_change number', () => {
    const { container } = render(
      <MarketStats items={makeItems()} topMover={makeMover(-10)} />,
    )
    expect(container.textContent).toMatch(/▼/)
  })
})
