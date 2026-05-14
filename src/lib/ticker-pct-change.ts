import type { MoverRow } from './api'

/**
 * Build a Map of name → pct_change for fast Ticker row lookup.
 *
 * MoverRow keys items by `name` (the raw case name, e.g. "Operation Bravo
 * Case"). Ticker rows transform that into `shortName` for display, so
 * callers must look up using the raw `item.name` BEFORE the transform.
 *
 * Duplicate names: later entries overwrite earlier ones (Map.set semantics).
 */
export function buildPctChangeMap(movers: MoverRow[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const row of movers) {
    m.set(row.name, row.pct_change)
  }
  return m
}
