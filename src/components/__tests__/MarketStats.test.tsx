import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MarketStats } from '../MarketStats'
import type { ItemWithPrice } from '../MarketStats'

const noPrice: ItemWithPrice = {
  id: 'x', name: 'X', pool: 'active', released: '2020-01-01',
  rare: 'Knife', hasGloves: false, notable: '', price: null,
}

describe('MarketStats skeleton state', () => {
  it('renders skeleton stat cards when no items have prices yet', () => {
    const { container } = render(<MarketStats items={[noPrice]} />)
    const region = screen.getByLabelText(/loading market stats/i)
    expect(region).toHaveAttribute('aria-busy', 'true')
    // 5 stat cards × 3 skeleton lines each = 15 placeholders
    const placeholders = container.querySelectorAll('[aria-hidden="true"]')
    expect(placeholders.length).toBeGreaterThanOrEqual(15)
  })
})
