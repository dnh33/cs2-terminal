import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/api', () => ({
  fetchMovers: vi.fn(),
}))

import { fetchMovers } from '../../lib/api'
import { MoversPanel } from '../MoversPanel'
import { PriceChart, PoolDistribution, VolumePriceScatter } from '../Charts'
import type { ItemFull } from '../CaseTable'

const movers = [
  { id: 'glove', name: 'Glove Case', pool: 'discontinued' as const, first_price: 10, last_price: 13.24, last_at: 0, pct_change: 32.4 },
  { id: 'chroma', name: 'Chroma Case', pool: 'rare' as const, first_price: 5, last_price: 4.5, last_at: 0, pct_change: -10 },
]

beforeEach(() => {
  ;(fetchMovers as any).mockReset()
  ;(fetchMovers as any).mockResolvedValue(movers)
})

describe('MoversPanel a11y + keyboard', () => {
  it('mover rows are keyboard-focusable and activate on Enter', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<MoversPanel onSelect={onSelect} />)
    const row = await screen.findByRole('row', { name: /glove case/i })
    row.focus()
    expect(row).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledWith('glove')
  })

  it('renders both gainers and losers sections via shared component', async () => {
    render(<MoversPanel onSelect={() => {}} />)
    await waitFor(() => screen.getByRole('row', { name: /glove case/i }))
    expect(screen.getByRole('row', { name: /chroma case/i })).toBeInTheDocument()
  })

  it('window pills meet ≥24px tap target (WCAG 2.5.8)', async () => {
    render(<MoversPanel onSelect={() => {}} />)
    await waitFor(() => screen.getByRole('row', { name: /glove case/i }))
    const pill = screen.getByRole('button', { name: /^7D$/ })
    expect(pill.className).toMatch(/min-h-\[24px\]/)
    expect(pill.className).toMatch(/inline-flex/)
  })

  it('renders Banner with role=alert when fetch fails', async () => {
    ;(fetchMovers as any).mockReset()
    ;(fetchMovers as any).mockRejectedValue(new Error('network down'))
    render(<MoversPanel onSelect={() => {}} />)
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/network down/)
  })

  it('row aria-label encodes direction and price', async () => {
    render(<MoversPanel onSelect={() => {}} />)
    const up = await screen.findByRole('row', { name: /glove case, up 32\.4 percent/i })
    expect(up).toBeInTheDocument()
    const down = screen.getByRole('row', { name: /chroma case, down 10\.0 percent/i })
    expect(down).toBeInTheDocument()
  })
})

const item: ItemFull = {
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
  history: [{ date: '2024-01-01', price: 12, source: 'real' as const }],
}

describe('Charts a11y', () => {
  it('PriceChart wraps in role=img with aria-label summary', () => {
    const { container } = render(<PriceChart item={item} />)
    const img = container.querySelector('[role="img"]')
    expect(img).not.toBeNull()
    expect(img!.getAttribute('aria-label')).toMatch(/price/i)
  })

  it('PoolDistribution wraps in role=img with aria-label summary', () => {
    const { container } = render(<PoolDistribution items={[item]} />)
    const img = container.querySelector('[role="img"]')
    expect(img).not.toBeNull()
    expect(img!.getAttribute('aria-label')).toMatch(/pool/i)
  })

  it('VolumePriceScatter wraps in role=img and renders without ReferenceError', () => {
    const { container } = render(
      <VolumePriceScatter items={[item]} onSelect={() => {}} selectedId={null} />,
    )
    const img = container.querySelector('[role="img"]')
    expect(img).not.toBeNull()
    expect(img!.getAttribute('aria-label')).toMatch(/cases plotted|volume/i)
  })
})
