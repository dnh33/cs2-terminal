/**
 * Lightweight localStorage persistence for analyses + market scans.
 *
 * - Analyses are keyed by `caseId + last_snapshot_at` so a fresh worker
 *   snapshot automatically busts the cached LLM output.
 * - Last scan persists across page refresh so users land back on whatever
 *   they last looked at instead of an empty panel.
 * - Every operation is wrapped in try/catch — disabled storage (private mode,
 *   quota exceeded, corrupted JSON) must never crash the app.
 */

const ANALYSIS_PREFIX = 'cs-analysis:'
const SCAN_KEY = 'cs-last-scan'

export function saveAnalysis(caseId: string, snapshotAt: number, text: string): void {
  try {
    localStorage.setItem(`${ANALYSIS_PREFIX}${caseId}:${snapshotAt}`, text)
  } catch {
    /* storage disabled or quota exceeded — non-fatal */
  }
}

export function loadAnalysis(caseId: string, snapshotAt: number): string | null {
  try {
    return localStorage.getItem(`${ANALYSIS_PREFIX}${caseId}:${snapshotAt}`)
  } catch {
    return null
  }
}

export interface ScanRecord {
  text: string
  savedAt: number
}

export function saveScan(text: string): void {
  try {
    const record: ScanRecord = { text, savedAt: Date.now() }
    localStorage.setItem(SCAN_KEY, JSON.stringify(record))
  } catch {
    /* non-fatal */
  }
}

export function loadLastScan(): ScanRecord | null {
  try {
    const raw = localStorage.getItem(SCAN_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ScanRecord
  } catch {
    return null
  }
}
