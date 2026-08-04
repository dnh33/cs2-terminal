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

  it('filter pills meet ≥24px tap target (WCAG 2.5.8)', () => {
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
    const pill = screen.getByRole('button', { name: /^DISCONTINUED$/ })
    expect(pill.className).toMatch(/min-h-\[28px\]/)
    expect(pill.className).toMatch(/inline-flex/)
  })

  it('renders 8 skeleton rows when loading and no items', () => {
    const { container } = render(
      <CaseTable
        items={[]}
        selectedId={null}
        onSelect={noop}
        sort={{ key: 'price', dir: 'desc' }}
        setSort={noop as any}
        filter="all"
        setFilter={noop}
        loading
      />
    )
    const placeholders = container.querySelectorAll('[aria-hidden="true"]')
    expect(placeholders.length).toBeGreaterThanOrEqual(8)
    const busy = container.querySelector('[aria-busy="true"]')
    expect(busy).not.toBeNull()
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

describe('CaseTable desktop grid pool badge spacing', () => {
  const noop = () => {}
  it('pool badge does not stretch to fill its grid cell (leaves a gap before LOWEST)', () => {
    const { container } = render(
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
    // Desktop grid row's PoolBadge — grid items stretch to fill their cell by
    // default (CSS Grid justify-items: stretch), which left the badge's
    // right edge touching LOWEST's left edge with zero gap. justify-self-start
    // keeps the badge at its natural content width.
    // .hidden.md:grid matches both the header row and the data row — the
    // header comes first in document order, so scope to the data row (the
    // one that actually contains a price) rather than querySelector's
    // first match.
    const grids = Array.from(container.querySelectorAll('.hidden.md\\:grid'))
    const dataRow = grids.find(g => /\$/.test(g.textContent || ''))
    expect(dataRow).not.toBeUndefined()
    // Grid children in order: idx, name, pool, lowest, median, spread, volume, age, trend.
    const badge = dataRow!.children[2]
    expect(badge).not.toBeNull()
    expect(badge!.textContent).toBe('DISC')
    expect(badge!.className).toMatch(/justify-self-start/)
  })
})
