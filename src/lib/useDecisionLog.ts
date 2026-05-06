import { useCallback, useSyncExternalStore } from 'react'

export const DECISION_LOG_KEY = 'cs-decisions:v1'
const SAME_TAB_EVENT = 'cs-decision-log-changed'

export type Verdict = 'LONG' | 'FLAT' | 'AVOID'

export interface DecisionEntry {
  id: string                  // uuid v4
  caseId: string
  caseName: string
  verdict: Verdict
  confidence: number          // 0..1
  priceAtCommit: number
  snapshotAt: number
  committedAt: number         // epoch ms
  note: string                // optional, ≤200 chars (caller enforces)
}

export interface DecisionLogState {
  schemaVersion: 1
  entries: DecisionEntry[]
}

const EMPTY: DecisionLogState = { schemaVersion: 1, entries: [] }

function readLog(): DecisionLogState {
  try {
    const raw = localStorage.getItem(DECISION_LOG_KEY)
    if (!raw) return EMPTY
    const parsed = JSON.parse(raw) as DecisionLogState
    if (parsed && parsed.schemaVersion === 1 && Array.isArray(parsed.entries)) return parsed
    return EMPTY
  } catch {
    return EMPTY
  }
}

function writeLog(state: DecisionLogState): void {
  try {
    localStorage.setItem(DECISION_LOG_KEY, JSON.stringify(state))
  } catch {
    /* quota / private mode — non-fatal, in-memory state still updates */
  }
}

// Cache last-parsed snapshot keyed by raw string for referential stability.
let snapshotCache: { raw: string | null; parsed: DecisionLogState } = { raw: null, parsed: EMPTY }
function getSnapshot(): DecisionLogState {
  let raw: string | null = null
  try { raw = localStorage.getItem(DECISION_LOG_KEY) } catch { /* ignore */ }
  if (raw === snapshotCache.raw) return snapshotCache.parsed
  const parsed = readLog()
  snapshotCache = { raw, parsed }
  return parsed
}

function subscribe(cb: () => void): () => void {
  function onStorage(e: StorageEvent) {
    if (e.key === DECISION_LOG_KEY) cb()
  }
  function onCustom() { cb() }
  window.addEventListener('storage', onStorage)
  window.addEventListener(SAME_TAB_EVENT, onCustom as EventListener)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(SAME_TAB_EVENT, onCustom as EventListener)
  }
}

function uuidv4(): string {
  // Browser-native crypto.randomUUID is available in jsdom + modern browsers.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback: RFC4122 v4 via Math.random (test environments without randomUUID)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export interface CommitInput {
  caseId: string
  caseName: string
  verdict: Verdict
  confidence: number
  priceAtCommit: number
  snapshotAt: number
  note: string
}

export function useDecisionLog(): {
  entries: DecisionEntry[]
  commit: (input: CommitInput) => void
} {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const commit = useCallback((input: CommitInput) => {
    const entry: DecisionEntry = {
      id: uuidv4(),
      caseId: input.caseId,
      caseName: input.caseName,
      verdict: input.verdict,
      confidence: input.confidence,
      priceAtCommit: input.priceAtCommit,
      snapshotAt: input.snapshotAt,
      committedAt: Date.now(),
      note: input.note.slice(0, 200),
    }
    const next: DecisionLogState = {
      schemaVersion: 1,
      entries: [entry, ...readLog().entries],   // newest first
    }
    writeLog(next)
    // Sync cache to live storage state so getSnapshot returns `next` whether
    // the write succeeded or silently failed (quota / private mode).
    let liveRaw: string | null = null
    try { liveRaw = localStorage.getItem(DECISION_LOG_KEY) } catch { /* ignore */ }
    snapshotCache = { raw: liveRaw, parsed: next }
    window.dispatchEvent(new CustomEvent(SAME_TAB_EVENT))
  }, [])

  return { entries: state.entries, commit }
}
