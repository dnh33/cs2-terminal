import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { DetailPanel } from '../DetailPanel'
import type { ItemFull } from '../CaseTable'

// NOTE: jsdom does NOT execute Tailwind's media-query breakpoints —
// both `hidden md:block` and `md:hidden` appear in the rendered tree
// simultaneously. These tests verify the responsive class strings are
// EMITTED per P0-5 audit fix, not that the layout actually flips at <md.

const item: ItemFull = {
  id: 'glove-case', name: 'Glove Case', released: '2016-11-28', pool: 'rare',
  rare: 'Gloves', hasGloves: true, notable: 'gloves',
  price: { lowest: 247.50, median: 250, volume: 12 },
  metrics: { ageDays: 3287, ageYears: 9, spread: 2.5, spreadPct: 1, breakeven: 290, liquidity: 60, scarcity: 80, poolMul: 1.2 },
  history: [],
}

describe('DetailPanel mobile drawer wrapping', () => {
  it('emits a desktop-only inline wrapper with `hidden md:block`', () => {
    const { container } = render(
      <DetailPanel
        item={item} onAnalyze={() => {}} analysis={null} analyzing={false} error={null}
      />,
    )
    const desktop = container.querySelector('[data-test="detail-desktop"]')
    expect(desktop).not.toBeNull()
    expect(desktop!.className).toMatch(/hidden/)
    expect(desktop!.className).toMatch(/md:block/)
  })

  it('emits a mobile-only Drawer wrapper with `md:hidden`', () => {
    const { container } = render(
      <DetailPanel
        item={item} onAnalyze={() => {}} analysis={null} analyzing={false} error={null}
      />,
    )
    const mobile = container.querySelector('[data-test="detail-mobile"]')
    expect(mobile).not.toBeNull()
    expect(mobile!.className).toMatch(/md:hidden/)
  })

  it('mobile Drawer renders role="dialog" with aria-label "Case detail" when item is present', () => {
    const { container } = render(
      <DetailPanel
        item={item} onAnalyze={() => {}} analysis={null} analyzing={false} error={null}
      />,
    )
    const mobile = container.querySelector('[data-test="detail-mobile"]')!
    expect(mobile.querySelector('[role="dialog"][aria-label="Case detail"]')).not.toBeNull()
  })

  it('mobile Drawer does NOT render dialog when item is undefined', () => {
    const { container } = render(
      <DetailPanel
        item={undefined} onAnalyze={() => {}} analysis={null} analyzing={false} error={null}
      />,
    )
    // When item is undefined, DetailPanel renders the empty placeholder —
    // no Drawer mounted, so no dialog.
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })
})
