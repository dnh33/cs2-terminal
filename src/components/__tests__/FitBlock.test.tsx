import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FitBlock } from '../FitBlock'
import type { FitResult } from '../../lib/fitScore'

function fixtureOk(fit: number): FitResult {
  return {
    case_id: 'glove-case',
    fit,
    status: 'ok',
    confidence: 'high',
    components: {
      liquidity: { raw: 0, score: 62 },
      momentum: { raw: 0, score: 78 },
      supply_tightness: { raw: 0, score: 91 },
      content_quality: { raw: 0, score: 75 },
      unbox_ev_ratio: { raw: 0, score: 52 },
      crowding_risk: { raw: 0, score: 68 },
      catalyst: null,
    },
    weights: {}, weights_version: 'v1', algo_version: 'fit-1.0.0',
    inputs_hash: 'abc', as_of: 0, snapshot_at: 0, pool_size: 41,
  }
}

describe('FitBlock', () => {
  it('renders the FIT number prominently', () => {
    render(<FitBlock result={fixtureOk(73)} />)
    expect(screen.getByText('73')).toBeInTheDocument()
    expect(screen.getByText(/100/)).toBeInTheDocument()
  })

  it('renders all 5 active component labels (catalyst is reserved)', () => {
    render(<FitBlock result={fixtureOk(73)} />)
    expect(screen.getByText('LIQ')).toBeInTheDocument()
    expect(screen.getByText('MOM')).toBeInTheDocument()
    expect(screen.getByText('SUPPLY')).toBeInTheDocument()
    expect(screen.getByText('CONTENT')).toBeInTheDocument()
    expect(screen.getByText('UNBOX EV')).toBeInTheDocument()
    expect(screen.getByText('CROWDING')).toBeInTheDocument()
  })

  it('renders catalyst row with placeholder', () => {
    render(<FitBlock result={fixtureOk(73)} />)
    expect(screen.getByText('CATALYST')).toBeInTheDocument()
    // Placeholder dashes
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('renders insufficient_history state with --', () => {
    const r = fixtureOk(0)
    r.status = 'insufficient_history'
    render(<FitBlock result={r} />)
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(6)
  })

  it('hides FIT block entirely when stale_data', () => {
    const r = fixtureOk(0)
    r.status = 'stale_data'
    const { container } = render(<FitBlock result={r} />)
    expect(container.querySelector('[data-test="fit-block"]')).toBeNull()
  })
})
