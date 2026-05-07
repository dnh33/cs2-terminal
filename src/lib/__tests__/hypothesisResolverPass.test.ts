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
import { CASE_DB } from '../cases'

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

  it('caseId not in CASE_DB → transient unknown_case marker, NOT permanent STALE, no fetch', async () => {
    setLedger([{ ...HYPO_TODAY, id: 'a', caseId: 'NOT_A_REAL_CASE', targetDate: '2026-06-14' }])
    const fetchSpy = vi.spyOn(api, 'fetchHistory').mockResolvedValue([])
    await runResolverPass()
    expect(fetchSpy).not.toHaveBeenCalled()
    const after = readLedger()
    // resolution stays null so a future pass (after CASE_DB grows) can re-resolve.
    // Permanent STALE here would be a one-way door — corruption survives Phase 5
    // D1 retrofit and can never be un-resolved.
    expect(after[0].resolution).toBeNull()
    expect(after[0].lastAttemptError).toBe('unknown_case')
    expect(typeof after[0].lastAttemptAt).toBe('number')
  })

  it('unknown_case is recoverable: pass1 marks transient when CASE_DB miss, pass2 resolves HIT after CASE_DB grows', async () => {
    // Two-pass scenario locking the actual recovery contract:
    //   Pass 1 — simulate "caseId not yet in CASE_DB" via spy returning undefined ONCE.
    //   Resolver short-circuits to transient unknown_case marker, NOT a permanent
    //   STALE write. Resolution stays null. No fetch.
    //   Pass 2 — spy auto-passes through (mockReturnValueOnce only intercepts one call).
    //   CASE_DB.find returns the real glove caseDef → fetch fires → resolves HIT.
    //   lastAttemptError clears.
    // If the resolver had written permanent STALE in pass 1, pass 2 would skip the
    // entry (already resolved) and the recovery would be impossible.
    setLedger([{ ...HYPO_TODAY, id: 'a', caseId: 'glove', targetDate: '2026-06-14' }])
    const findSpy = vi.spyOn(CASE_DB, 'find').mockReturnValueOnce(undefined)
    const fetchSpy = vi.spyOn(api, 'fetchHistory').mockResolvedValue([
      { date: '2026-06-14', price: 290, source: 'real' as const },
    ])

    // Pass 1: CASE_DB miss → transient marker
    await runResolverPass()
    const afterPass1 = readLedger()
    expect(afterPass1[0].resolution).toBeNull()
    expect(afterPass1[0].lastAttemptError).toBe('unknown_case')
    expect(fetchSpy).not.toHaveBeenCalled()

    // Pass 2: bypass 30s gate, spy passes through, real lookup succeeds → HIT
    __resetResolverPassForTests()
    await runResolverPass()
    const afterPass2 = readLedger()
    expect(afterPass2[0].resolution?.outcome).toBe('HIT')
    expect(afterPass2[0].lastAttemptError).toBeNull()
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    findSpy.mockRestore()
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
