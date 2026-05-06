import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DecisionLog } from '../DecisionLog'
import { DECISION_LOG_KEY } from '../../lib/useDecisionLog'

describe('DecisionLog', () => {
  beforeEach(() => { localStorage.clear() })

  it('renders empty state when no entries', () => {
    render(<DecisionLog caseId="x" caseName="X" snapshotAt={1} priceAtCommit={10} verdict={undefined} confidence={undefined} />)
    expect(screen.getByText(/no decisions/i)).toBeInTheDocument()
  })

  it('Commit button is disabled until a verdict is provided', () => {
    render(<DecisionLog caseId="x" caseName="X" snapshotAt={1} priceAtCommit={10} verdict={undefined} confidence={undefined} />)
    const btn = screen.getByRole('button', { name: /commit/i })
    expect(btn).toBeDisabled()
  })

  it('Commit button is enabled when a verdict is provided', () => {
    render(<DecisionLog caseId="x" caseName="X" snapshotAt={1} priceAtCommit={10} verdict="LONG" confidence={0.78} />)
    const btn = screen.getByRole('button', { name: /commit/i })
    expect(btn).toBeEnabled()
  })

  it('Commit writes an entry to localStorage and renders it', () => {
    render(<DecisionLog caseId="glove-case" caseName="Glove Case" snapshotAt={1715000000} priceAtCommit={247.5} verdict="LONG" confidence={0.78} />)
    fireEvent.click(screen.getByRole('button', { name: /commit/i }))
    // Confirm appears
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    expect(screen.getByText(/Glove Case/)).toBeInTheDocument()
    expect(screen.getByText(/LONG/)).toBeInTheDocument()
    const raw = localStorage.getItem(DECISION_LOG_KEY)
    expect(raw).toBeTruthy()
    expect(JSON.parse(raw!).entries.length).toBe(1)
  })

  it('renders entries reverse-chronological', () => {
    localStorage.setItem(DECISION_LOG_KEY, JSON.stringify({
      schemaVersion: 1,
      entries: [
        { id: 'b', caseId: 'b', caseName: 'B', verdict: 'AVOID', confidence: 0.6, priceAtCommit: 5, snapshotAt: 200, committedAt: 200, note: '' },
        { id: 'a', caseId: 'a', caseName: 'A', verdict: 'LONG', confidence: 0.7, priceAtCommit: 10, snapshotAt: 100, committedAt: 100, note: '' },
      ],
    }))
    render(<DecisionLog caseId="x" caseName="X" snapshotAt={1} priceAtCommit={10} verdict={undefined} confidence={undefined} />)
    const items = screen.getAllByRole('listitem')
    // Newest first (B's committedAt 200 > A's 100)
    expect(items[0].textContent).toContain('B')
    expect(items[1].textContent).toContain('A')
  })
})
