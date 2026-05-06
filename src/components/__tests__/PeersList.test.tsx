import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PeersList } from '../PeersList'
import type { FitResult } from '../../lib/fitScore'

function fit(id: string, scores: number[]): FitResult {
  return {
    case_id: id, fit: scores[0], status: 'ok', confidence: 'high',
    components: {
      liquidity:        { raw: 0, score: scores[0] },
      momentum:         { raw: 0, score: scores[1] },
      supply_tightness: { raw: 0, score: scores[2] },
      content_quality:  { raw: 0, score: scores[3] },
      unbox_ev_ratio:   { raw: 0, score: scores[4] },
      crowding_risk:    { raw: 0, score: scores[5] ?? 50 },
      catalyst: null,
    },
    weights: {}, weights_version: 'v1', algo_version: 'fit-1.0.0',
    inputs_hash: id, as_of: 0, snapshot_at: 0, pool_size: 41,
  }
}

describe('PeersList', () => {
  it('renders 3 nearest peers by component-distance', () => {
    const target = fit('case-a', [60, 70, 80, 75, 50, 30])
    const others = [
      { id: 'case-b', name: 'B', result: fit('case-b', [62, 71, 79, 76, 51, 30]) },  // very close
      { id: 'case-c', name: 'C', result: fit('case-c', [10, 90, 20, 5, 95, 50]) },   // far
      { id: 'case-d', name: 'D', result: fit('case-d', [58, 68, 82, 73, 48, 30]) },  // close
      { id: 'case-e', name: 'E', result: fit('case-e', [99, 1, 99, 1, 99, 1]) },     // far
      { id: 'case-f', name: 'F', result: fit('case-f', [61, 69, 81, 76, 49, 30]) },  // close
    ]
    render(<PeersList target={target} candidates={others} onSelect={() => {}} />)
    expect(screen.getByText('B')).toBeInTheDocument()
    expect(screen.getByText('D')).toBeInTheDocument()
    expect(screen.getByText('F')).toBeInTheDocument()
    expect(screen.queryByText('C')).not.toBeInTheDocument()
    expect(screen.queryByText('E')).not.toBeInTheDocument()
  })

  it('calls onSelect with peer caseId on click', () => {
    const onSelect = vi.fn()
    const target = fit('a', [60, 70, 80, 75, 50])
    const others = [{ id: 'b', name: 'Beta', result: fit('b', [62, 71, 79, 76, 51]) }]
    render(<PeersList target={target} candidates={others} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('Beta'))
    expect(onSelect).toHaveBeenCalledWith('b')
  })

  it('renders "no peers yet" if candidate list is empty', () => {
    const target = fit('a', [60, 70, 80, 75, 50])
    render(<PeersList target={target} candidates={[]} onSelect={() => {}} />)
    expect(screen.getByText(/no peers/i)).toBeInTheDocument()
  })

  it('does not list the target itself among peers', () => {
    const target = fit('a', [60, 70, 80, 75, 50])
    const others = [{ id: 'a', name: 'Self', result: target }]
    render(<PeersList target={target} candidates={others} onSelect={() => {}} />)
    expect(screen.queryByText('Self')).not.toBeInTheDocument()
  })
})
