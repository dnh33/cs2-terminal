import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MarketStats, type ItemWithPrice } from '../MarketStats'
import type { MoverRow } from '../../lib/api'

// F29 + F31 — components must drive colour through CSS custom properties, not
// hex literals or hardcoded rgba triplets. jsdom normalises `style="color:
// #4ade80"` to `color: rgb(74, 222, 128)`, so we assert on BOTH:
//   - the resolved rgb() form (catches the original hex)
//   - the presence of `var(--…)` after the fix
// This way the test fails before the patch and passes after.

const RGB_OFFENDERS = [
  'rgb(74, 222, 128)',   // #4ade80 — delta up (Tailwind green-400)
  'rgb(248, 113, 113)',  // #f87171 — delta dn (Tailwind red-400)
  'rgb(79, 209, 197)',   // #4fd1c5 — accent-data (Tailwind teal-400)
  'rgb(255, 116, 33)',   // #ff7421 — accent-sel (Phase 4.4)
]

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

describe('MarketStats — palette tokens (no hardcoded hex)', () => {
  it('positive mover: renders var(--delta-up), not the hex/rgb literal', () => {
    const { container } = render(
      <MarketStats items={makeItems()} topMover={makeMover(5)} />,
    )
    const html = container.innerHTML
    for (const rgb of RGB_OFFENDERS) {
      expect(html.toLowerCase()).not.toContain(rgb)
    }
    // Positive: the StatBlock accents and the mover colour must be CSS vars.
    expect(html).toContain('var(--delta-up)')
    expect(html).toContain('var(--accent-data)')
    expect(html).toContain('var(--accent-sel)')
  })

  it('negative mover: renders var(--delta-dn), not the hex/rgb literal', () => {
    const { container } = render(
      <MarketStats items={makeItems()} topMover={makeMover(-10)} />,
    )
    const html = container.innerHTML
    for (const rgb of RGB_OFFENDERS) {
      expect(html.toLowerCase()).not.toContain(rgb)
    }
    expect(html).toContain('var(--delta-dn)')
  })
})
