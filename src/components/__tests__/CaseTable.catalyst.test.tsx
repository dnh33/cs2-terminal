import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { CaseTable } from '../CaseTable'
import type { ItemFull } from '../CaseTable'

// Fixture copied verbatim from src/components/__tests__/CaseTable.test.tsx (Step 4.1.5).
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

const noop = () => {}
const defaultProps = {
  selectedId: null,
  onSelect: noop,
  sort: { key: 'price' as const, dir: 'desc' as const },
  setSort: noop as any,
  filter: 'all' as const,
  setFilter: noop,
}

beforeEach(() => { localStorage.clear() })
afterEach(() => { localStorage.clear(); vi.useRealTimers() })

describe('CaseTable catalyst chip', () => {
  it('chip hidden when no upcoming catalysts for row', () => {
    render(<CaseTable items={[baseItem]} {...defaultProps} />)
    expect(screen.queryByText(/catalyst/i)).not.toBeInTheDocument()
  })

  it('chip shows count + nearest-date when ≥1 upcoming (mobile + desktop = 2 instances)', () => {
    vi.setSystemTime(new Date(2026, 0, 1))
    localStorage.setItem('cs-catalysts:v1', JSON.stringify({ schemaVersion: 1, entries: [
      { id: '1', caseId: 'glove', label: 'IEM', eventDate: '2026-05-31', createdAt: 1 },
      { id: '2', caseId: 'glove', label: 'Drop', eventDate: '2026-06-15', createdAt: 2 },
    ]}))
    render(<CaseTable items={[baseItem]} {...defaultProps} />)
    // Both layouts render in jsdom — chip should appear twice (once mobile, once desktop).
    const chips = screen.getAllByText(/2 catalysts · May 31/i)
    expect(chips.length).toBe(2)
  })

  it('today boundary: catalyst dated today shows in upcoming', () => {
    vi.setSystemTime(new Date(2026, 4, 31))
    localStorage.setItem('cs-catalysts:v1', JSON.stringify({ schemaVersion: 1, entries: [
      { id: '1', caseId: 'glove', label: 'Today', eventDate: '2026-05-31', createdAt: 1 },
    ]}))
    render(<CaseTable items={[baseItem]} {...defaultProps} />)
    expect(screen.getAllByText(/1 catalyst · May 31/i).length).toBeGreaterThanOrEqual(1)
  })

  it('past catalysts excluded from chip count', () => {
    vi.setSystemTime(new Date(2026, 5, 1)) // June 1 2026
    localStorage.setItem('cs-catalysts:v1', JSON.stringify({ schemaVersion: 1, entries: [
      { id: '1', caseId: 'glove', label: 'Old', eventDate: '2026-01-01', createdAt: 1 },
    ]}))
    render(<CaseTable items={[baseItem]} {...defaultProps} />)
    expect(screen.queryByText(/catalyst/i)).not.toBeInTheDocument()
  })

  it('singular vs plural: 1 catalyst vs 2 catalysts', () => {
    vi.setSystemTime(new Date(2026, 0, 1))
    localStorage.setItem('cs-catalysts:v1', JSON.stringify({ schemaVersion: 1, entries: [
      { id: '1', caseId: 'glove', label: 'IEM', eventDate: '2026-05-31', createdAt: 1 },
    ]}))
    render(<CaseTable items={[baseItem]} {...defaultProps} />)
    expect(screen.getAllByText(/1 catalyst · May 31/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText(/catalysts/i)).not.toBeInTheDocument()
  })

  it('ARIA-label extended with catalyst count + next-date', () => {
    vi.setSystemTime(new Date(2026, 0, 1))
    localStorage.setItem('cs-catalysts:v1', JSON.stringify({ schemaVersion: 1, entries: [
      { id: '1', caseId: 'glove', label: 'IEM', eventDate: '2026-05-31', createdAt: 1 },
    ]}))
    render(<CaseTable items={[baseItem]} {...defaultProps} />)
    const row = screen.getByRole('row', { name: /glove case/i })
    expect(row.getAttribute('aria-label')).toMatch(/1 upcoming catalyst, next May 31/i)
  })

  it('ARIA-label NOT extended when zero upcoming', () => {
    render(<CaseTable items={[baseItem]} {...defaultProps} />)
    const row = screen.getByRole('row', { name: /glove case/i })
    expect(row.getAttribute('aria-label')).not.toMatch(/upcoming catalyst/i)
  })
})
