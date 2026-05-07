// src/lib/useCatalystJournal.ts
import { createLocalLog, uuidv4 } from './useLocalLog'

export const CATALYST_JOURNAL_KEY = 'cs-catalysts:v1'

export interface Catalyst {
  id: string
  caseId: string
  label: string
  eventDate: string
  createdAt: number
}

export interface CatalystInput {
  caseId: string
  label: string
  eventDate: string
}

export interface CatalystJournalState {
  schemaVersion: 1
  entries: Catalyst[]
}

const { helpers, useLog } = createLocalLog<Catalyst, CatalystInput>({
  key: CATALYST_JOURNAL_KEY,
  event: 'cs-catalyst-changed',
  schemaVersion: 1,
  buildEntry: (input) => ({
    id: uuidv4(),
    caseId: input.caseId,
    label: input.label.trim().slice(0, 80),
    eventDate: input.eventDate,
    createdAt: Date.now(),
  }),
  validate: (parsed) => {
    if (!parsed || typeof parsed !== 'object') return null
    const o = parsed as { schemaVersion?: number; entries?: unknown }
    if (o.schemaVersion !== 1 || !Array.isArray(o.entries)) return null
    return o.entries as Catalyst[]
  },
})

export const readJournal = helpers.read
export const writeJournal = helpers.write

export function useCatalystJournal(): {
  entries: Catalyst[]
  commit: (input: CatalystInput) => void
  remove: (id: string) => void
} {
  return useLog()
}
