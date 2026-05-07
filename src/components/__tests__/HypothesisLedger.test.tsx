import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within, fireEvent, act } from '@testing-library/react'
import { HypothesisLedger } from '../HypothesisLedger'
import { HYPOTHESIS_LEDGER_KEY, type Hypothesis } from '../../lib/useHypothesisLedger'

const PROPS = {
  caseId: 'glove',
  caseName: 'Glove Case',
  priceAtCommit: 268.4,
  snapshotAt: 1778155544,
}

describe('HypothesisLedger', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders empty state with copy and the COMMIT button', () => {
    render(<HypothesisLedger {...PROPS} />)
    expect(screen.getByText(/no hypotheses committed yet/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /commit hypothesis/i })).toBeInTheDocument()
  })

  it('expands form on COMMIT click and is initially CONFIRM-disabled', () => {
    render(<HypothesisLedger {...PROPS} />)
    fireEvent.click(screen.getByRole('button', { name: /commit hypothesis/i }))
    const confirm = screen.getByRole('button', { name: /confirm/i })
    expect(confirm).toBeDisabled()
  })

  it('CONFIRM becomes enabled when all fields valid', () => {
    render(<HypothesisLedger {...PROPS} />)
    fireEvent.click(screen.getByRole('button', { name: /commit hypothesis/i }))
    fireEvent.change(screen.getByLabelText(/target price/i), { target: { value: '280' } })
    fireEvent.change(screen.getByLabelText(/target date/i), { target: { value: '2099-12-31' } })
    fireEvent.change(screen.getByLabelText(/confidence/i), { target: { value: '65' } })
    expect(screen.getByRole('button', { name: /confirm/i })).not.toBeDisabled()
  })

  it('CONFIRM commits and closes the form', () => {
    render(<HypothesisLedger {...PROPS} />)
    fireEvent.click(screen.getByRole('button', { name: /commit hypothesis/i }))
    fireEvent.change(screen.getByLabelText(/target price/i), { target: { value: '280' } })
    fireEvent.change(screen.getByLabelText(/target date/i), { target: { value: '2099-12-31' } })
    fireEvent.change(screen.getByLabelText(/confidence/i), { target: { value: '65' } })
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    expect(screen.queryByRole('button', { name: /confirm/i })).not.toBeInTheDocument()
    expect(screen.getByText(/280/)).toBeInTheDocument()
    expect(screen.getByText(/2099-12-31/)).toBeInTheDocument()
  })

  it('CANCEL closes form without committing', () => {
    render(<HypothesisLedger {...PROPS} />)
    fireEvent.click(screen.getByRole('button', { name: /commit hypothesis/i }))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByRole('button', { name: /confirm/i })).not.toBeInTheDocument()
    expect(screen.getByText(/no hypotheses committed yet/i)).toBeInTheDocument()
  })

  it('30d shorthand expands on blur to absolute UTC date', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-07T12:00:00Z'))
    render(<HypothesisLedger {...PROPS} />)
    fireEvent.click(screen.getByRole('button', { name: /commit hypothesis/i }))
    const dateInput = screen.getByLabelText(/target date/i) as HTMLInputElement
    fireEvent.change(dateInput, { target: { value: '30d' } })
    fireEvent.blur(dateInput)
    expect(dateInput.value).toBe('2026-06-06')
    vi.useRealTimers()
  })

  it('4w shorthand expands on blur (28 days)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-07T12:00:00Z'))
    render(<HypothesisLedger {...PROPS} />)
    fireEvent.click(screen.getByRole('button', { name: /commit hypothesis/i }))
    const dateInput = screen.getByLabelText(/target date/i) as HTMLInputElement
    fireEvent.change(dateInput, { target: { value: '4w' } })
    fireEvent.blur(dateInput)
    expect(dateInput.value).toBe('2026-06-04')
    vi.useRealTimers()
  })

  it('2m shorthand expands on blur (60 days)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-07T12:00:00Z'))
    render(<HypothesisLedger {...PROPS} />)
    fireEvent.click(screen.getByRole('button', { name: /commit hypothesis/i }))
    const dateInput = screen.getByLabelText(/target date/i) as HTMLInputElement
    fireEvent.change(dateInput, { target: { value: '2m' } })
    fireEvent.blur(dateInput)
    expect(dateInput.value).toBe('2026-07-06')
    vi.useRealTimers()
  })

  it('accepts tomorrow UTC as target date — CONFIRM enabled', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-07T12:00:00Z'))
    render(<HypothesisLedger {...PROPS} />)
    fireEvent.click(screen.getByRole('button', { name: /commit hypothesis/i }))
    fireEvent.change(screen.getByLabelText(/target price/i), { target: { value: '280' } })
    fireEvent.change(screen.getByLabelText(/target date/i), { target: { value: '2026-05-08' } })
    fireEvent.change(screen.getByLabelText(/confidence/i), { target: { value: '65' } })
    expect(screen.getByRole('button', { name: /confirm/i })).not.toBeDisabled()
    vi.useRealTimers()
  })

  it('rejects past targetDate (today UTC or earlier) — CONFIRM stays disabled', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-07T12:00:00Z'))
    render(<HypothesisLedger {...PROPS} />)
    fireEvent.click(screen.getByRole('button', { name: /commit hypothesis/i }))
    fireEvent.change(screen.getByLabelText(/target price/i), { target: { value: '280' } })
    fireEvent.change(screen.getByLabelText(/target date/i), { target: { value: '2026-05-07' } })
    fireEvent.change(screen.getByLabelText(/confidence/i), { target: { value: '65' } })
    expect(screen.getByRole('button', { name: /confirm/i })).toBeDisabled()
    vi.useRealTimers()
  })

  it('comparator toggle switches between ≤ and ≥', () => {
    render(<HypothesisLedger {...PROPS} />)
    fireEvent.click(screen.getByRole('button', { name: /commit hypothesis/i }))
    const lte = screen.getByRole('button', { name: '≤' })
    const gte = screen.getByRole('button', { name: '≥' })
    fireEvent.click(gte)
    fireEvent.change(screen.getByLabelText(/target price/i), { target: { value: '280' } })
    fireEvent.change(screen.getByLabelText(/target date/i), { target: { value: '2099-12-31' } })
    fireEvent.change(screen.getByLabelText(/confidence/i), { target: { value: '65' } })
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    expect(screen.getByText('≥')).toBeInTheDocument()
  })

  it('does NOT render caseName in per-case view (case context implicit)', () => {
    localStorage.setItem(HYPOTHESIS_LEDGER_KEY, JSON.stringify({
      schemaVersion: 1,
      entries: [{
        id: 'x', caseId: 'glove', caseName: 'GLOVE_DENORM_NAME',
        comparator: 'gte', targetPrice: 280, targetDate: '2099-12-31',
        confidence: 65, priceAtCommit: 268, snapshotAt: 0,
        committedAt: Date.now(), note: '', resolution: null,
      } satisfies Hypothesis],
    }))
    render(<HypothesisLedger {...PROPS} />)
    expect(screen.queryByText(/GLOVE_DENORM_NAME/)).not.toBeInTheDocument()
  })

  it('shows PENDING outcome chip for unresolved entries', () => {
    localStorage.setItem(HYPOTHESIS_LEDGER_KEY, JSON.stringify({
      schemaVersion: 1,
      entries: [{
        id: 'x', caseId: 'glove', caseName: 'Glove',
        comparator: 'gte', targetPrice: 280, targetDate: '2099-12-31',
        confidence: 65, priceAtCommit: 268, snapshotAt: 0,
        committedAt: Date.now(), note: '', resolution: null,
      }],
    }))
    render(<HypothesisLedger {...PROPS} />)
    expect(screen.getByText(/PENDING/)).toBeInTheDocument()
  })

  it('shows HIT/MISS/STALE outcome based on resolution', () => {
    localStorage.setItem(HYPOTHESIS_LEDGER_KEY, JSON.stringify({
      schemaVersion: 1,
      entries: [
        { id: 'a', caseId: 'glove', caseName: 'G', comparator: 'gte', targetPrice: 1, targetDate: '2026-01-01', confidence: 50, priceAtCommit: 1, snapshotAt: 0, committedAt: 0, note: '', resolution: { outcome: 'HIT', resolvedAt: Date.now() - 1_000_000, resolverVersion: 1, observed: { min: 1, max: 5, count: 1 } } },
        { id: 'b', caseId: 'glove', caseName: 'G', comparator: 'gte', targetPrice: 99, targetDate: '2026-01-01', confidence: 50, priceAtCommit: 1, snapshotAt: 0, committedAt: 0, note: '', resolution: { outcome: 'MISS', resolvedAt: Date.now() - 1_000_000, resolverVersion: 1, observed: { min: 1, max: 5, count: 1 } } },
        { id: 'c', caseId: 'glove', caseName: 'G', comparator: 'gte', targetPrice: 1, targetDate: '2026-01-01', confidence: 50, priceAtCommit: 1, snapshotAt: 0, committedAt: 0, note: '', resolution: { outcome: 'STALE', resolvedAt: Date.now() - 1_000_000, resolverVersion: 1, observed: null } },
      ],
    }))
    render(<HypothesisLedger {...PROPS} />)
    expect(screen.getByText(/HIT/)).toBeInTheDocument()
    expect(screen.getByText(/MISS/)).toBeInTheDocument()
    expect(screen.getByText(/STALE/)).toBeInTheDocument()
  })

  it('only renders ledger entries matching this case', () => {
    localStorage.setItem(HYPOTHESIS_LEDGER_KEY, JSON.stringify({
      schemaVersion: 1,
      entries: [
        { id: 'a', caseId: 'glove', caseName: 'G', comparator: 'gte', targetPrice: 280, targetDate: '2099-12-31', confidence: 50, priceAtCommit: 268, snapshotAt: 0, committedAt: 0, note: '', resolution: null },
        { id: 'b', caseId: 'recoil', caseName: 'R', comparator: 'lte', targetPrice: 8, targetDate: '2099-12-31', confidence: 50, priceAtCommit: 9, snapshotAt: 0, committedAt: 0, note: '', resolution: null },
      ],
    }))
    render(<HypothesisLedger {...PROPS} />)
    expect(screen.getByText(/280/)).toBeInTheDocument()
    expect(screen.queryByText(/\$8\.00/)).not.toBeInTheDocument()
  })
})
