import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  runResolverPass,
  __resetResolverPassForTests,
} from '../hypothesisResolverPass'
import {
  HYPOTHESIS_LEDGER_KEY,
  type Hypothesis,
} from '../useHypothesisLedger'
import * as api from '../api'

const HYPO_TODAY: Hypothesis = {
  id: 'h-today',
  caseId: 'glove',
  caseName: 'Glove Case',
  comparator: 'gte',
  targetPrice: 280,
  targetDate: '', // set per test
  confidence: 65,
  priceAtCommit: 268,
  snapshotAt: 0,
  committedAt: 0,
  note: '',
  resolution: null,
}

function setLedger(entries: Hypothesis[]) {
  localStorage.setItem(HYPOTHESIS_LEDGER_KEY, JSON.stringify({ schemaVersion: 1, entries }))
}

function readLedger(): Hypothesis[] {
  const raw = localStorage.getItem(HYPOTHESIS_LEDGER_KEY)
  return raw ? JSON.parse(raw).entries : []
}

describe('hypothesisResolverPass', () => {
  beforeEach(() => {
    localStorage.clear()
    __resetResolverPassForTests()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-14T22:30:00Z')) // Ralph's timezone boundary
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('does nothing when no pending matured entries', async () => {
    setLedger([
      { ...HYPO_TODAY, id: 'future', targetDate: '2099-12-31' },
    ])
    const fetchSpy = vi.spyOn(api, 'fetchHistory').mockResolvedValue([])
    await runResolverPass()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('UTC boundary: targetDate=2026-06-14 matures at 22:30Z, 2026-06-15 stays pending', async () => {
    setLedger([
      { ...HYPO_TODAY, id: 'matured', targetDate: '2026-06-14' },
      { ...HYPO_TODAY, id: 'pending', targetDate: '2026-06-15' },
    ])
    const fetchSpy = vi.spyOn(api, 'fetchHistory').mockResolvedValue([
      { date: '2026-06-14', price: 290, source: 'real' as const },
    ])
    await runResolverPass()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const after = readLedger()
    const matured = after.find(h => h.id === 'matured')
    const pending = after.find(h => h.id === 'pending')
    expect(matured?.resolution?.outcome).toBe('HIT')
    expect(pending?.resolution).toBeNull()
  })

  it('groups by caseId — one fetch per case', async () => {
    setLedger([
      { ...HYPO_TODAY, id: 'a', caseId: 'glove', targetDate: '2026-06-14' },
      { ...HYPO_TODAY, id: 'b', caseId: 'glove', targetDate: '2026-06-13' },
      { ...HYPO_TODAY, id: 'c', caseId: 'recoil', targetDate: '2026-06-14' },
    ])
    const fetchSpy = vi.spyOn(api, 'fetchHistory').mockResolvedValue([])
    await runResolverPass()
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('inflight guard: concurrent calls share one fetch', async () => {
    setLedger([{ ...HYPO_TODAY, id: 'a', targetDate: '2026-06-14' }])
    const fetchSpy = vi.spyOn(api, 'fetchHistory').mockResolvedValue([])
    const p1 = runResolverPass()
    const p2 = runResolverPass()
    await Promise.all([p1, p2])
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('30s gate: second pass within window is a no-op', async () => {
    setLedger([{ ...HYPO_TODAY, id: 'a', targetDate: '2026-06-14' }])
    const fetchSpy = vi.spyOn(api, 'fetchHistory').mockResolvedValue([])
    await runResolverPass()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    setLedger([{ ...HYPO_TODAY, id: 'b', targetDate: '2026-06-14' }])
    await runResolverPass()
    expect(fetchSpy).toHaveBeenCalledTimes(1) // gate held
    vi.advanceTimersByTime(30_001)
    await runResolverPass()
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('network failure: hypothesis stays pending, lastAttemptError=network', async () => {
    setLedger([{ ...HYPO_TODAY, id: 'a', targetDate: '2026-06-14' }])
    vi.spyOn(api, 'fetchHistory').mockRejectedValue(new Error('boom'))
    await runResolverPass()
    const after = readLedger()
    expect(after[0].resolution).toBeNull()
    expect(after[0].lastAttemptError).toBe('network')
    expect(typeof after[0].lastAttemptAt).toBe('number')
  })

  it('caseId not in CASE_DB → permanent STALE without fetch', async () => {
    setLedger([{ ...HYPO_TODAY, id: 'a', caseId: 'NOT_A_REAL_CASE', targetDate: '2026-06-14' }])
    const fetchSpy = vi.spyOn(api, 'fetchHistory').mockResolvedValue([])
    await runResolverPass()
    expect(fetchSpy).not.toHaveBeenCalled()
    const after = readLedger()
    expect(after[0].resolution?.outcome).toBe('STALE')
  })

  it('concurrent commit during pass: matured new entry preserved (merge-aware write)', async () => {
    setLedger([{ ...HYPO_TODAY, id: 'a', targetDate: '2026-06-14' }])
    let resolveFetch: (v: any) => void = () => {}
    const fetchPromise = new Promise<any>(r => { resolveFetch = r })
    vi.spyOn(api, 'fetchHistory').mockReturnValue(fetchPromise as any)

    const passPromise = runResolverPass()
    // While fetch is in flight, simulate a user commit appending entry 'b'
    // 'b' is also matured but landed AFTER the resolver's initial readLedger() —
    // merge-aware write must preserve it WITHOUT computing a resolution for it.
    const current = readLedger()
    setLedger([
      { ...HYPO_TODAY, id: 'b', targetDate: '2026-06-14', caseId: 'recoil' },
      ...current,
    ])
    resolveFetch([{ date: '2026-06-14', price: 285, source: 'real' as const }])
    await passPromise

    const after = readLedger()
    expect(after.find(h => h.id === 'a')?.resolution?.outcome).toBe('HIT')
    expect(after.find(h => h.id === 'b')).toBeDefined()           // not lost
    expect(after.find(h => h.id === 'b')?.resolution).toBeNull()  // resolver did NOT compute for 'b'
  })

  it('daysSpan margin: targetDate==today calls fetchHistory with EXACT days=2', async () => {
    setLedger([{ ...HYPO_TODAY, id: 'a', targetDate: '2026-06-14' }])
    const fetchSpy = vi.spyOn(api, 'fetchHistory').mockResolvedValue([])
    await runResolverPass()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const callArgs = fetchSpy.mock.calls[0]
    // Lock the exact boundary: oldestTargetDate==today → ceil(0)+2 = 2.
    // Asserting >=2 would let a future "optimization" silently drop the margin.
    expect(callArgs[1]).toBe(2)
  })

  it('caseName lookup is via CASE_DB by id, ignores stored caseName', async () => {
    setLedger([{ ...HYPO_TODAY, id: 'a', caseId: 'glove', caseName: 'STALE_NAME', targetDate: '2026-06-14' }])
    const fetchSpy = vi.spyOn(api, 'fetchHistory').mockResolvedValue([])
    await runResolverPass()
    const callArgs = fetchSpy.mock.calls[0]
    expect(callArgs[0]).not.toBe('STALE_NAME')
    // The actual name comes from CASE_DB.find(c => c.id === 'glove').name
  })
})
