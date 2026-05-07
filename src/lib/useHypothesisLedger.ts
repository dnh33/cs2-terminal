import { createLocalLog, uuidv4 } from './useLocalLog'

export const HYPOTHESIS_LEDGER_KEY = 'cs-hypotheses:v1'

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

const { helpers, useLog } = createLocalLog<Hypothesis, CommitInput>({
  key: HYPOTHESIS_LEDGER_KEY,
  event: 'cs-hypothesis-ledger-changed',
  schemaVersion: 1,
  buildEntry: (input) => ({
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
  }),
  validate: (parsed) => {
    if (!parsed || typeof parsed !== 'object') return null
    const o = parsed as { schemaVersion?: number; entries?: unknown }
    if (o.schemaVersion !== 1 || !Array.isArray(o.entries)) return null
    return o.entries as Hypothesis[]
  },
})

// Resolver-pass non-React access path — preserves the existing API exactly.
// hypothesisResolverPass.ts imports these as standalone functions.
export const readLedger: () => HypothesisLedgerState = helpers.read
export const writeLedger: (state: HypothesisLedgerState) => void = helpers.write
export const dispatchLedgerChanged: () => void = helpers.dispatch

// Hook public surface stays append-only — drop `remove` to preserve contract.
export function useHypothesisLedger(): {
  entries: Hypothesis[]
  commit: (input: CommitInput) => void
} {
  const { entries, commit } = useLog()
  return { entries, commit }
}
