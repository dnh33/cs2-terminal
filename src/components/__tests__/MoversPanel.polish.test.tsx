import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MoversPanel } from '../MoversPanel'

vi.mock('../../lib/api', () => ({
  fetchMovers: vi.fn(async () => [
    { id: 'glove-case', name: 'Glove Case', pool: 'rare', first_price: 220, last_price: 250, last_at: 1, last_volume: 12, pct_change: 13.6 },
    { id: 'recoil-case', name: 'Recoil Case', pool: 'active', first_price: 1.5, last_price: 1.2, last_at: 1, last_volume: 5000, pct_change: -20 },
  ]),
}))

describe('MoversPanel polish', () => {
  it('shows a volume column on each row', async () => {
    render(<MoversPanel onSelect={() => {}} />)
    await waitFor(() => expect(screen.getByText('Glove Case')).toBeInTheDocument())
    expect(screen.getAllByTestId('mover-row-volume').length).toBeGreaterThan(0)
  })

  it('shows numeric volume per row', async () => {
    render(<MoversPanel onSelect={() => {}} />)
    await waitFor(() => expect(screen.getByText('Glove Case')).toBeInTheDocument())
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('5,000')).toBeInTheDocument()
  })

  it('hides 24H window button when earliestSnapshotAge < 86400', async () => {
    render(<MoversPanel onSelect={() => {}} earliestSnapshotAge={3600} />)
    await waitFor(() => expect(screen.getByText('Glove Case')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /^24H$/ })).toBeNull()
    expect(screen.getByRole('button', { name: /^7D$/ })).toBeInTheDocument()
  })

  it('shows 24H window button when earliestSnapshotAge >= 86400', async () => {
    render(<MoversPanel onSelect={() => {}} earliestSnapshotAge={90000} />)
    await waitFor(() => expect(screen.getByText('Glove Case')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /^24H$/ })).toBeInTheDocument()
  })
})
