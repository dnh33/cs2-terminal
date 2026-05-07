import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  useCatalystJournal,
  readJournal,
  writeJournal,
  CATALYST_JOURNAL_KEY,
  type Catalyst,
} from '../useCatalystJournal'

describe('useCatalystJournal adapter', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => { localStorage.clear(); vi.restoreAllMocks() })

  it('exports CATALYST_JOURNAL_KEY = cs-catalysts:v1', () => {
    expect(CATALYST_JOURNAL_KEY).toBe('cs-catalysts:v1')
  })

  it('commit appends entry; entries newest-first', () => {
    const { result } = renderHook(() => useCatalystJournal())
    act(() => result.current.commit({ caseId: 'glove', label: 'IEM Katowice', eventDate: '2026-05-31' }))
    act(() => result.current.commit({ caseId: 'kilo',  label: 'Drop change',  eventDate: '2026-06-15' }))
    expect(result.current.entries).toHaveLength(2)
    expect(result.current.entries[0].label).toBe('Drop change')
    expect(result.current.entries[1].label).toBe('IEM Katowice')
  })

  it('buildEntry trims and slices label to 80 chars', () => {
    const { result } = renderHook(() => useCatalystJournal())
    const long = '   ' + 'A'.repeat(100) + '   '
    act(() => result.current.commit({ caseId: 'glove', label: long, eventDate: '2026-05-31' }))
    expect(result.current.entries[0].label.length).toBe(80)
    expect(result.current.entries[0].label).not.toMatch(/^\s/)
  })

  it('remove drops entry by id', () => {
    const { result } = renderHook(() => useCatalystJournal())
    act(() => result.current.commit({ caseId: 'glove', label: 'A', eventDate: '2026-05-31' }))
    const id = result.current.entries[0].id
    act(() => result.current.remove(id))
    expect(result.current.entries).toHaveLength(0)
  })

  it('readJournal returns persisted state outside React', () => {
    writeJournal({ schemaVersion: 1, entries: [
      { id: 'x', caseId: 'glove', label: 'A', eventDate: '2026-05-31', createdAt: 1 },
    ] })
    expect(readJournal().entries).toHaveLength(1)
  })

  it('validate rejects malformed JSON', () => {
    localStorage.setItem(CATALYST_JOURNAL_KEY, 'not-json{{{')
    expect(readJournal().entries).toEqual([])
  })

  it('validate rejects schemaVersion mismatch', () => {
    localStorage.setItem(CATALYST_JOURNAL_KEY, JSON.stringify({ schemaVersion: 2, entries: [] }))
    expect(readJournal().entries).toEqual([])
  })

  it('Catalyst type has required fields', () => {
    const e: Catalyst = { id: 'a', caseId: 'b', label: 'c', eventDate: '2026-01-01', createdAt: 1 }
    expect(e).toBeDefined()
  })
})
