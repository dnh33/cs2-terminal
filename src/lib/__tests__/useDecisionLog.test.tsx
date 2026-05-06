import { describe, it, expect, beforeEach } from 'vitest'
import { render, act, screen } from '@testing-library/react'
import { useDecisionLog, DECISION_LOG_KEY } from '../useDecisionLog'

function Probe() {
  const { entries, commit } = useDecisionLog()
  return (
    <div>
      <span data-testid="count">{entries.length}</span>
      <button onClick={() => commit({
        caseId: 'glove-case', caseName: 'Glove Case',
        verdict: 'LONG', confidence: 0.78, priceAtCommit: 247.50,
        snapshotAt: 1715000000, note: 'test note',
      })}>commit</button>
      <ul>{entries.map(e => <li key={e.id}>{e.caseName}:{e.verdict}</li>)}</ul>
    </div>
  )
}

describe('useDecisionLog', () => {
  beforeEach(() => { localStorage.clear() })

  it('starts with empty entries', () => {
    render(<Probe />)
    expect(screen.getByTestId('count').textContent).toBe('0')
  })

  it('commit appends a new entry', () => {
    render(<Probe />)
    act(() => { screen.getByText('commit').click() })
    expect(screen.getByTestId('count').textContent).toBe('1')
    expect(screen.getByText('Glove Case:LONG')).toBeInTheDocument()
  })

  it('commit persists to localStorage', () => {
    render(<Probe />)
    act(() => { screen.getByText('commit').click() })
    const raw = localStorage.getItem(DECISION_LOG_KEY)
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw!)
    expect(parsed.entries.length).toBe(1)
    expect(parsed.entries[0].verdict).toBe('LONG')
    expect(parsed.entries[0].id).toMatch(/^[0-9a-f-]{36}$/i)
  })

  it('hydrates from localStorage on mount', () => {
    localStorage.setItem(DECISION_LOG_KEY, JSON.stringify({
      schemaVersion: 1,
      entries: [{
        id: '00000000-0000-4000-8000-000000000000',
        caseId: 'x', caseName: 'X', verdict: 'AVOID', confidence: 0.5,
        priceAtCommit: 1, snapshotAt: 0, committedAt: 0, note: '',
      }],
    }))
    render(<Probe />)
    expect(screen.getByTestId('count').textContent).toBe('1')
    expect(screen.getByText('X:AVOID')).toBeInTheDocument()
  })

  it('handles disabled storage gracefully', () => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = () => { throw new Error('quota') }
    try {
      render(<Probe />)
      act(() => { screen.getByText('commit').click() })
      // Storage write fails silently — but in-memory state still updates.
      expect(screen.getByTestId('count').textContent).toBe('1')
    } finally {
      Storage.prototype.setItem = original
    }
  })
})
