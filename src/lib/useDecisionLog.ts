import { createLocalLog, uuidv4 } from './useLocalLog'

export const DECISION_LOG_KEY = 'cs-decisions:v1'

export type Verdict = 'LONG' | 'FLAT' | 'AVOID'

export interface DecisionEntry {
  id: string
  caseId: string
  caseName: string
  verdict: Verdict
  confidence: number
  priceAtCommit: number
  snapshotAt: number
  committedAt: number
  note: string
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

export interface DecisionLogState {
  schemaVersion: 1
  entries: DecisionEntry[]
}

const { useLog } = createLocalLog<DecisionEntry, CommitInput>({
  key: DECISION_LOG_KEY,
  event: 'cs-decision-log-changed',
  schemaVersion: 1,
  buildEntry: (input) => ({
    id: uuidv4(),
    caseId: input.caseId,
    caseName: input.caseName,
    verdict: input.verdict,
    confidence: input.confidence,
    priceAtCommit: input.priceAtCommit,
    snapshotAt: input.snapshotAt,
    committedAt: Date.now(),
    note: input.note.slice(0, 200),
  }),
  validate: (parsed) => {
    if (!parsed || typeof parsed !== 'object') return null
    const o = parsed as { schemaVersion?: number; entries?: unknown }
    if (o.schemaVersion !== 1 || !Array.isArray(o.entries)) return null
    return o.entries as DecisionEntry[]
  },
})

// Decision Log is append-only — drop `remove` to preserve existing type contract.
export function useDecisionLog(): { entries: DecisionEntry[]; commit: (input: CommitInput) => void } {
  const { entries, commit } = useLog()
  return { entries, commit }
}
