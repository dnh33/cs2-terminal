import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CatalystJournal } from '../CatalystJournal'

beforeEach(() => { localStorage.clear() })
afterEach(() => { localStorage.clear(); vi.useRealTimers() })

function renderForCase(caseId = 'glove') {
  return render(<CatalystJournal caseId={caseId} caseName="Glove Case" />)
}

describe('CatalystJournal', () => {
  it('renders empty state when no entries', () => {
    renderForCase()
    expect(screen.getByText(/NO CATALYSTS COMMITTED/i)).toBeInTheDocument()
  })

  it('empty state has data-test root', () => {
    const { container } = renderForCase()
    expect(container.querySelector('[data-test="catalyst-journal-section"]')).not.toBeNull()
  })

  it('UPCOMING tab is default after entries exist', () => {
    vi.setSystemTime(new Date(2026, 0, 1))
    localStorage.setItem('cs-catalysts:v1', JSON.stringify({ schemaVersion: 1, entries: [
      { id: '1', caseId: 'glove', label: 'A', eventDate: '2026-05-31', createdAt: 1 },
    ]}))
    renderForCase()
    const upcomingTab = screen.getByRole('tab', { name: /^UPCOMING/i })
    expect(upcomingTab).toHaveAttribute('aria-selected', 'true')
  })

  it('clicking PAST tab switches selection', () => {
    vi.setSystemTime(new Date(2026, 0, 1))
    localStorage.setItem('cs-catalysts:v1', JSON.stringify({ schemaVersion: 1, entries: [
      { id: '1', caseId: 'glove', label: 'A', eventDate: '2026-05-31', createdAt: 1 },
    ]}))
    renderForCase()
    fireEvent.click(screen.getByRole('tab', { name: /^PAST/i }))
    expect(screen.getByRole('tab', { name: /^PAST/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('ADD form opens on + ADD click', () => {
    renderForCase()
    fireEvent.click(screen.getByRole('button', { name: /^\+ ADD$/i }))
    expect(screen.getByLabelText(/LABEL/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/DATE/i)).toBeInTheDocument()
  })

  it('ADD form blocks empty label', () => {
    renderForCase()
    fireEvent.click(screen.getByRole('button', { name: /^\+ ADD$/i }))
    fireEvent.change(screen.getByLabelText(/DATE/i), { target: { value: '2099-05-31' } })
    fireEvent.click(screen.getByRole('button', { name: /^✓ COMMIT$/i }))
    expect(screen.getByText(/LABEL REQUIRED/i)).toBeInTheDocument()
  })

  it('ADD form blocks invalid date', () => {
    renderForCase()
    fireEvent.click(screen.getByRole('button', { name: /^\+ ADD$/i }))
    fireEvent.change(screen.getByLabelText(/LABEL/i), { target: { value: 'IEM' } })
    fireEvent.change(screen.getByLabelText(/DATE/i), { target: { value: 'bad-date' } })
    fireEvent.click(screen.getByRole('button', { name: /^✓ COMMIT$/i }))
    expect(screen.getByText(/INVALID DATE/i)).toBeInTheDocument()
  })

  it('valid commit creates entry in UPCOMING', () => {
    vi.setSystemTime(new Date(2026, 0, 1))
    renderForCase()
    fireEvent.click(screen.getByRole('button', { name: /^\+ ADD$/i }))
    fireEvent.change(screen.getByLabelText(/LABEL/i), { target: { value: 'IEM Katowice' } })
    fireEvent.change(screen.getByLabelText(/DATE/i), { target: { value: '2026-05-31' } })
    fireEvent.click(screen.getByRole('button', { name: /^✓ COMMIT$/i }))
    expect(screen.getByText('IEM Katowice')).toBeInTheDocument()
  })

  it('backfill auto-switches to PAST tab', () => {
    vi.setSystemTime(new Date(2026, 5, 1))
    renderForCase()
    fireEvent.click(screen.getByRole('button', { name: /^\+ ADD$/i }))
    fireEvent.change(screen.getByLabelText(/LABEL/i), { target: { value: 'Last week event' } })
    fireEvent.change(screen.getByLabelText(/DATE/i), { target: { value: '2026-05-25' } })
    fireEvent.click(screen.getByRole('button', { name: /^✓ COMMIT$/i }))
    expect(screen.getByRole('tab', { name: /^PAST/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Last week event')).toBeInTheDocument()
  })

  it('UPCOMING includes today (eventDate === today)', () => {
    vi.setSystemTime(new Date(2026, 4, 31))
    renderForCase()
    fireEvent.click(screen.getByRole('button', { name: /^\+ ADD$/i }))
    fireEvent.change(screen.getByLabelText(/LABEL/i), { target: { value: 'Today event' } })
    fireEvent.change(screen.getByLabelText(/DATE/i), { target: { value: '2026-05-31' } })
    fireEvent.click(screen.getByRole('button', { name: /^✓ COMMIT$/i }))
    expect(screen.getByText('Today event')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /^UPCOMING/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('UPCOMING entries sorted ascending by eventDate', () => {
    vi.setSystemTime(new Date(2026, 0, 1))
    renderForCase()
    fireEvent.click(screen.getByRole('button', { name: /^\+ ADD$/i }))
    fireEvent.change(screen.getByLabelText(/LABEL/i), { target: { value: 'Later' } })
    fireEvent.change(screen.getByLabelText(/DATE/i), { target: { value: '2026-08-01' } })
    fireEvent.click(screen.getByRole('button', { name: /^✓ COMMIT$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^\+ ADD$/i }))
    fireEvent.change(screen.getByLabelText(/LABEL/i), { target: { value: 'Earlier' } })
    fireEvent.change(screen.getByLabelText(/DATE/i), { target: { value: '2026-05-31' } })
    fireEvent.click(screen.getByRole('button', { name: /^✓ COMMIT$/i }))
    const labels = screen.getAllByText(/^Earlier$|^Later$/).map(n => n.textContent)
    expect(labels).toEqual(['Earlier', 'Later'])
  })

  it('PAST entries sorted descending by eventDate (most recent first)', () => {
    vi.setSystemTime(new Date(2026, 11, 1))
    localStorage.setItem('cs-catalysts:v1', JSON.stringify({ schemaVersion: 1, entries: [
      { id: '1', caseId: 'glove', label: 'Old',     eventDate: '2026-01-01', createdAt: 1 },
      { id: '2', caseId: 'glove', label: 'Recent',  eventDate: '2026-08-01', createdAt: 2 },
    ]}))
    renderForCase()
    fireEvent.click(screen.getByRole('tab', { name: /^PAST/i }))
    const labels = screen.getAllByText(/^Old$|^Recent$/).map(n => n.textContent)
    expect(labels).toEqual(['Recent', 'Old'])
  })

  it('delete button removes entry; aria-live REMOVED line appears', () => {
    vi.setSystemTime(new Date(2026, 0, 1))
    renderForCase()
    fireEvent.click(screen.getByRole('button', { name: /^\+ ADD$/i }))
    fireEvent.change(screen.getByLabelText(/LABEL/i), { target: { value: 'Doomed' } })
    fireEvent.change(screen.getByLabelText(/DATE/i), { target: { value: '2026-05-31' } })
    fireEvent.click(screen.getByRole('button', { name: /^✓ COMMIT$/i }))
    fireEvent.click(screen.getByRole('button', { name: /Remove Doomed/i }))
    expect(screen.queryByText('Doomed')).not.toBeInTheDocument()
    expect(screen.getByText(/REMOVED/i)).toBeInTheDocument()
  })

  it('only entries for current caseId are shown', () => {
    vi.setSystemTime(new Date(2026, 0, 1))
    localStorage.setItem('cs-catalysts:v1', JSON.stringify({ schemaVersion: 1, entries: [
      { id: '1', caseId: 'glove', label: 'For glove', eventDate: '2099-01-01', createdAt: 1 },
      { id: '2', caseId: 'kilo',  label: 'For kilo',  eventDate: '2099-01-01', createdAt: 2 },
    ]}))
    renderForCase('glove')
    expect(screen.getByText('For glove')).toBeInTheDocument()
    expect(screen.queryByText('For kilo')).not.toBeInTheDocument()
  })

  it('UPCOMING tab count badge reflects upcoming count', () => {
    vi.setSystemTime(new Date(2026, 0, 1))
    localStorage.setItem('cs-catalysts:v1', JSON.stringify({ schemaVersion: 1, entries: [
      { id: '1', caseId: 'glove', label: 'A', eventDate: '2026-05-31', createdAt: 1 },
      { id: '2', caseId: 'glove', label: 'B', eventDate: '2026-06-15', createdAt: 2 },
    ]}))
    renderForCase()
    expect(screen.getByRole('tab', { name: /^UPCOMING \(2\)/i })).toBeInTheDocument()
  })

  it('PAST tab count badge reflects past count', () => {
    vi.setSystemTime(new Date(2026, 11, 1))
    localStorage.setItem('cs-catalysts:v1', JSON.stringify({ schemaVersion: 1, entries: [
      { id: '1', caseId: 'glove', label: 'A', eventDate: '2026-01-01', createdAt: 1 },
      { id: '2', caseId: 'glove', label: 'B', eventDate: '2026-02-01', createdAt: 2 },
      { id: '3', caseId: 'glove', label: 'C', eventDate: '2026-03-01', createdAt: 3 },
    ]}))
    renderForCase()
    expect(screen.getByRole('tab', { name: /^PAST \(3\)/i })).toBeInTheDocument()
  })

  it('full-render branch also has data-test root', () => {
    vi.setSystemTime(new Date(2026, 0, 1))
    localStorage.setItem('cs-catalysts:v1', JSON.stringify({ schemaVersion: 1, entries: [
      { id: '1', caseId: 'glove', label: 'A', eventDate: '2026-05-31', createdAt: 1 },
    ]}))
    const { container } = renderForCase()
    expect(container.querySelector('[data-test="catalyst-journal-section"]')).not.toBeNull()
  })
})
