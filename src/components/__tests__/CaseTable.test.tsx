import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { CaseTable } from '../CaseTable'
import type { ItemFull } from '../CaseTable'

const baseItem: ItemFull = {
  id: 'glove',
  name: 'Glove Case',
  pool: 'discontinued',
  released: '2016-11-28',
  rare: 'Knife',
  hasGloves: true,
  notable: '',
  price: { lowest: 13.24, median: 14.9, volume: 4210 },
  metrics: {
    ageDays: 3066, ageYears: 8.4,
    spread: 1.66, spreadPct: 12.5,
    liquidity: 82, poolMul: 0.68, scarcity: 71, breakeven: 15.57,
  },
  history: [],
}

describe('CaseTable a11y + keyboard', () => {
  const noop = () => {}
  it('rows are keyboard-focusable and activate on Enter', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(
      <CaseTable
        items={[baseItem]}
        selectedId={null}
        onSelect={onSelect}
        sort={{ key: 'price', dir: 'desc' }}
        setSort={noop as any}
        filter="all"
        setFilter={noop}
      />
    )
    const row = screen.getByRole('row', { name: /glove case/i })
    row.focus()
    expect(row).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledWith('glove')
  })

  it('sort headers are <button> with aria-sort', () => {
    render(
      <CaseTable
        items={[baseItem]}
        selectedId={null}
        onSelect={noop}
        sort={{ key: 'price', dir: 'desc' }}
        setSort={noop as any}
        filter="all"
        setFilter={noop}
      />
    )
    const lowest = screen.getByRole('button', { name: /lowest/i })
    expect(lowest).toHaveAttribute('aria-sort', 'descending')
    const name = screen.getByRole('button', { name: /^case/i })
    expect(name).toHaveAttribute('aria-sort', 'none')
  })
})
