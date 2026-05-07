import { useCallback, useSyncExternalStore } from 'react'

export const HYPOTHESIS_LEDGER_KEY = 'cs-hypotheses:v1'
const SAME_TAB_EVENT = 'cs-hypothesis-ledger-changed'

export type Comparator = 'gte' | 'lte'
export type Outcome = 'HIT' | 'MISS' | 'STALE'

export interface Resolution {
  outcome: Outcome
  resolvedAt: number
  resolverVersion: 1
  observed: { min: number; max: number; count: number } | null
}

export interface Hypothesis {
  id: string
  caseId: string
  caseName: string
  comparator: Comparator
  targetPrice: number
  targetDate: string             // 'YYYY-MM-DD' UTC
  confidence: number             // integer 0..100
  priceAtCommit: number
  snapshotAt: number             // epoch s
  committedAt: number            // epoch ms
  note: string                   // ≤200
  resolution: Resolution | null
  lastAttemptAt?: number
  lastAttemptError?: 'network' | 'unknown_case' | null
}

export interface HypothesisLedgerState {
  schemaVersion: 1
  entries: Hypothesis[]
}

export interface CommitInput {
  caseId: string
  caseName: string
  comparator: Comparator
  targetPrice: number
  targetDate: string
  confidence: number
  priceAtCommit: number
  snapshotAt: number
  note: string
}

const EMPTY: HypothesisLedgerState = { schemaVersion: 1, entries: [] }

export function readLedger(): HypothesisLedgerState {
  try {
    const raw = localStorage.getItem(HYPOTHESIS_LEDGER_KEY)
    if (!raw) return EMPTY
    const parsed = JSON.parse(raw) as HypothesisLedgerState
    if (parsed && parsed.schemaVersion === 1 && Array.isArray(parsed.entries)) return parsed
    return EMPTY
  } catch {
    return EMPTY
  }
}

export function writeLedger(state: HypothesisLedgerState): void {
  try {
    localStorage.setItem(HYPOTHESIS_LEDGER_KEY, JSON.stringify(state))
  } catch {
    /* quota / private mode — non-fatal, in-memory state still updates */
  }
}

export function dispatchLedgerChanged(): void {
  window.dispatchEvent(new CustomEvent(SAME_TAB_EVENT))
}

let snapshotCache: { raw: string | null; parsed: HypothesisLedgerState } = { raw: null, parsed: EMPTY }
function getSnapshot(): HypothesisLedgerState {
  let raw: string | null = null
  try { raw = localStorage.getItem(HYPOTHESIS_LEDGER_KEY) } catch { /* ignore */ }
  if (raw === snapshotCache.raw) return snapshotCache.parsed
  const parsed = readLedger()
  snapshotCache = { raw, parsed }
  return parsed
}

function subscribe(cb: () => void): () => void {
  function onStorage(e: StorageEvent) { if (e.key === HYPOTHESIS_LEDGER_KEY) cb() }
  function onCustom() { cb() }
  window.addEventListener('storage', onStorage)
  window.addEventListener(SAME_TAB_EVENT, onCustom as EventListener)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(SAME_TAB_EVENT, onCustom as EventListener)
  }
}

function uuidv4(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function useHypothesisLedger(): {
  entries: Hypothesis[]
  commit: (input: CommitInput) => void
} {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const commit = useCallback((input: CommitInput) => {
    const entry: Hypothesis = {
      id: uuidv4(),
      caseId: input.caseId,
      caseName: input.caseName,
      comparator: input.comparator,
      targetPrice: input.targetPrice,
      targetDate: input.targetDate,
      confidence: input.confidence,
      priceAtCommit: input.priceAtCommit,
      snapshotAt: input.snapshotAt,
      committedAt: Date.now(),
      note: input.note.slice(0, 200),
      resolution: null,
    }
    const next: HypothesisLedgerState = {
      schemaVersion: 1,
      entries: [entry, ...readLedger().entries],
    }
    writeLedger(next)
    let liveRaw: string | null = null
    try { liveRaw = localStorage.getItem(HYPOTHESIS_LEDGER_KEY) } catch { /* ignore */ }
    snapshotCache = { raw: liveRaw, parsed: next }
    dispatchLedgerChanged()
  }, [])

  return { entries: state.entries, commit }
}
