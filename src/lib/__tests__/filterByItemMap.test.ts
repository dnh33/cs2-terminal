import { describe, it, expect } from 'vitest'
import { filterByItemMap } from '../filterByItemMap'

interface TestEntry { id: string; caseId: string; label: string }

describe('filterByItemMap', () => {
  const items: { id: string }[] = [{ id: 'glove' }, { id: 'kilo' }]

  it('keeps entries whose caseId matches an item id', () => {
    const entries: TestEntry[] = [
      { id: 'a', caseId: 'glove', label: 'A' },
      { id: 'b', caseId: 'kilo',  label: 'B' },
    ]
    expect(filterByItemMap(entries, items)).toEqual(entries)
  })

  it('drops entries whose caseId is orphaned (case removed from CASE_DB)', () => {
    const entries: TestEntry[] = [
      { id: 'a', caseId: 'glove',   label: 'A' },
      { id: 'b', caseId: 'deleted', label: 'B' },
    ]
    expect(filterByItemMap(entries, items)).toEqual([entries[0]])
  })

  it('loading-state fallback: when items is empty, returns ALL entries unchanged', () => {
    // Without this fallback, page-load with items[]==[] briefly would erase every
    // entry from view until items populated. Loading-state must NOT mass-orphan.
    const entries: TestEntry[] = [
      { id: 'a', caseId: 'glove', label: 'A' },
      { id: 'b', caseId: 'kilo',  label: 'B' },
    ]
    expect(filterByItemMap(entries, [])).toEqual(entries)
  })

  it('empty entries returns empty', () => {
    expect(filterByItemMap([], items)).toEqual([])
  })
})
