import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { CaseTable } from '../CaseTable'
import type { ItemFull } from '../CaseTable'

const fixture: ItemFull[] = [
  { id: 'glove-case', name: 'Glove Case', released: '2016-11-28', pool: 'rare', rare: 'Gloves', hasGloves: true, notable: 'gloves',
    price: { lowest: 247.50, median: 250, volume: 12 },
    metrics: { ageDays: 3285, ageYears: 9, spread: 2.5, spreadPct: 1, liquidity: 60, poolMul: 1.2, scarcity: 80, breakeven: 290 },
    history: [] },
]

describe('CaseTable mobile', () => {
  it('renders card-list at <md (rows have mobile-card data-attr)', () => {
    const { container } = render(
      <CaseTable
        items={fixture} selectedId={null} onSelect={() => {}}
        sort={{ key: 'price', dir: 'desc' }} setSort={vi.fn()}
        filter="all" setFilter={() => {}}
      />,
    )
    const card = container.querySelector('[data-mobile-card]')
    expect(card).toBeTruthy()
    expect(card!.className).toMatch(/md:hidden/)
  })

  it('renders the existing grid table at md+ (keeps grid)', () => {
    const { container } = render(
      <CaseTable
        items={fixture} selectedId={null} onSelect={() => {}}
        sort={{ key: 'price', dir: 'desc' }} setSort={vi.fn()}
        filter="all" setFilter={() => {}}
      />,
    )
    // Existing role=grid stays; column-header row is hidden on mobile
    const grid = container.querySelector('[role="grid"]')
    expect(grid).toBeTruthy()
    const columnHeaders = container.querySelector('[role="row"] [role="columnheader"]')?.closest('[role="row"]')
    expect(columnHeaders?.className).toMatch(/hidden md:grid/)
  })
})
