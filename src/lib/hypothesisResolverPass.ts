import { fetchHistory } from './api'
import { CASE_DB } from './cases'
import {
  readLedger,
  writeLedger,
  dispatchLedgerChanged,
  type Hypothesis,
  type Resolution,
} from './useHypothesisLedger'
import { resolveHypothesis } from './resolveHypothesis'

const MIN_INTERVAL_MS = 30_000

let inflight: Promise<void> | null = null
let lastPassAt = 0

/** Test-only reset. Do not call from production code. */
export function __resetResolverPassForTests(): void {
  inflight = null
  lastPassAt = 0
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function runResolverPass(): Promise<void> {
  if (inflight) return inflight
  if (Date.now() - lastPassAt < MIN_INTERVAL_MS) return
  inflight = doResolverPass().finally(() => {
    lastPassAt = Date.now()
    inflight = null
  })
  return inflight
}

async function doResolverPass(): Promise<void> {
  const today = todayUTC()
  const initial = readLedger()
  const pending = initial.entries.filter(
    h => h.resolution === null && h.targetDate <= today,
  )
  if (pending.length === 0) return

  const byCase = new Map<string, Hypothesis[]>()
  for (const h of pending) {
    const list = byCase.get(h.caseId) ?? []
    list.push(h)
    byCase.set(h.caseId, list)
  }

  const computedResolutions = new Map<string, Resolution>()
  const computedAttempts = new Map<string, { attemptAt: number; error: 'network' | 'unknown_case' | null }>()

  for (const [caseId, hypotheses] of byCase) {
    const caseDef = CASE_DB.find(c => c.id === caseId)
    if (!caseDef) {
      // CASE_DB miss: TRANSIENT marker, NOT permanent STALE. A permanent STALE
      // write here is a one-way door — it survives Phase 5's D1 retrofit and
      // can't be retroactively un-resolved if the case re-appears (e.g., Daniel
      // adds a Valve-announced case that a hypothesis was committed for under
      // a placeholder id). Leave resolution null; record lastAttemptError so
      // the next pass after CASE_DB grows can re-resolve.
      const attemptAt = Date.now()
      for (const h of hypotheses) {
        computedAttempts.set(h.id, { attemptAt, error: 'unknown_case' })
      }
      continue
    }

    let oldestTargetDate = today
    for (const h of hypotheses) {
      if (h.targetDate < oldestTargetDate) oldestTargetDate = h.targetDate
    }
    const oldestMs = Date.parse(oldestTargetDate + 'T00:00:00Z')
    const todayMs = Date.parse(today + 'T00:00:00Z')
    const daysSpan = Math.min(365, Math.ceil((todayMs - oldestMs) / 86_400_000) + 2)

    try {
      const history = await fetchHistory(caseDef.name, daysSpan)
      const attemptAt = Date.now()
      for (const h of hypotheses) {
        computedResolutions.set(h.id, resolveHypothesis(h, history))
        computedAttempts.set(h.id, { attemptAt, error: null })
      }
    } catch {
      const attemptAt = Date.now()
      for (const h of hypotheses) {
        computedAttempts.set(h.id, { attemptAt, error: 'network' })
      }
    }
  }

  // Merge-aware write: re-read state, only update entries still pending
  const current = readLedger()
  const next = current.entries.map(e => {
    const newRes = computedResolutions.get(e.id)
    const newAttempt = computedAttempts.get(e.id)
    if (e.resolution !== null) return e
    if (newRes && e.resolution === null) {
      return {
        ...e,
        resolution: newRes,
        lastAttemptAt: newAttempt?.attemptAt ?? e.lastAttemptAt,
        lastAttemptError: newAttempt?.error ?? null,
      }
    }
    if (newAttempt) {
      return { ...e, lastAttemptAt: newAttempt.attemptAt, lastAttemptError: newAttempt.error }
    }
    return e
  })
  writeLedger({ schemaVersion: 1, entries: next })
  dispatchLedgerChanged()
}
