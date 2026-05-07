import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  useHypothesisLedger,
  HYPOTHESIS_LEDGER_KEY,
  type CommitInput,
} from '../useHypothesisLedger'

const baseInput: CommitInput = {
  caseId: 'glove',
  caseName: 'Glove Case',
  comparator: 'gte',
  targetPrice: 280,
  targetDate: '2026-06-15',
  confidence: 65,
  priceAtCommit: 268.4,
  snapshotAt: 1778155544,
  note: 'expecting recovery',
}

describe('useHypothesisLedger', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts with empty entries', () => {
    const { result } = renderHook(() => useHypothesisLedger())
    expect(result.current.entries).toEqual([])
  })

  it('commit adds an entry, newest first', () => {
    const { result } = renderHook(() => useHypothesisLedger())
    act(() => { result.current.commit(baseInput) })
    expect(result.current.entries).toHaveLength(1)
    const e = result.current.entries[0]
    expect(e.caseId).toBe('glove')
    expect(e.comparator).toBe('gte')
    expect(e.targetPrice).toBe(280)
    expect(e.targetDate).toBe('2026-06-15')
    expect(e.confidence).toBe(65)
    expect(e.note).toBe('expecting recovery')
    expect(e.resolution).toBeNull()
    expect(typeof e.id).toBe('string')
    expect(e.id.length).toBeGreaterThan(0)
    expect(typeof e.committedAt).toBe('number')
  })

  it('multiple commits prepend newest first', () => {
    const { result } = renderHook(() => useHypothesisLedger())
    act(() => { result.current.commit({ ...baseInput, caseId: 'a' }) })
    act(() => { result.current.commit({ ...baseInput, caseId: 'b' }) })
    expect(result.current.entries.map(e => e.caseId)).toEqual(['b', 'a'])
  })

  it('truncates note to 200 chars', () => {
    const { result } = renderHook(() => useHypothesisLedger())
    const longNote = 'x'.repeat(500)
    act(() => { result.current.commit({ ...baseInput, note: longNote }) })
    expect(result.current.entries[0].note).toHaveLength(200)
  })

  it('persists across remount via localStorage', () => {
    const { result, unmount } = renderHook(() => useHypothesisLedger())
    act(() => { result.current.commit(baseInput) })
    unmount()
    const { result: result2 } = renderHook(() => useHypothesisLedger())
    expect(result2.current.entries).toHaveLength(1)
    expect(result2.current.entries[0].caseId).toBe('glove')
  })

  it('returns EMPTY on malformed JSON', () => {
    localStorage.setItem(HYPOTHESIS_LEDGER_KEY, '{not json')
    const { result } = renderHook(() => useHypothesisLedger())
    expect(result.current.entries).toEqual([])
  })

  it('returns EMPTY on schemaVersion mismatch', () => {
    localStorage.setItem(
      HYPOTHESIS_LEDGER_KEY,
      JSON.stringify({ schemaVersion: 99, entries: [{}] }),
    )
    const { result } = renderHook(() => useHypothesisLedger())
    expect(result.current.entries).toEqual([])
  })

  it('reacts to same-tab event', () => {
    const { result } = renderHook(() => useHypothesisLedger())
    act(() => {
      localStorage.setItem(
        HYPOTHESIS_LEDGER_KEY,
        JSON.stringify({
          schemaVersion: 1,
          entries: [{
            id: 'x', caseId: 'a', caseName: 'A',
            comparator: 'lte', targetPrice: 5, targetDate: '2026-07-01',
            confidence: 50, priceAtCommit: 6, snapshotAt: 0,
            committedAt: Date.now(), note: '', resolution: null,
          }],
        }),
      )
      window.dispatchEvent(new CustomEvent('cs-hypothesis-ledger-changed'))
    })
    expect(result.current.entries).toHaveLength(1)
    expect(result.current.entries[0].id).toBe('x')
  })

  it('survives localStorage.setItem throwing (quota / private mode)', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const { result } = renderHook(() => useHypothesisLedger())
    expect(() => act(() => { result.current.commit(baseInput) })).not.toThrow()
    setItemSpy.mockRestore()
  })
})
