/**
 * /cron/recent?n=N&kind=K handler — returns last N cron runs for the
 * SystemStatus sparkline cluster (Phase 3 spec § 2.1.G; Phase 4 Plan 5 T3
 * extends with kind filter).
 *
 * Default kind='case' preserves Phase-3 backward-compat. ?kind=item_high
 * and ?kind=item_low surface the item-tier sweep history for the 3-tier
 * sparkline cluster. Invalid/missing kind falls back to 'case' (parseKind).
 *
 * Pure helpers (`clampN`, `formatCronRow`, `parseKind`) are extracted for
 * unit testing without spinning up D1. The `handleCronRecent` runner returns
 * the data shape; the call site wraps via `jsonResponse(...)` so CORS
 * headers stay consistent with the rest of the worker.
 */

type CronRunRow = {
  started_at: number
  finished_at: number | null
  succeeded: number
  failed: number
  error: string | null
}

export interface FormattedCronRun {
  started_at: number
  finished_at: number | null
  succeeded: number
  failed: number
  error: string | null
  duration_s: number | null
}

export type CronKind = 'case' | 'item_high' | 'item_low'

export function clampN(n: number | undefined): number {
  if (n === undefined || Number.isNaN(n)) return 24
  return Math.max(1, Math.min(48, Math.floor(n)))
}

export function formatCronRow(row: CronRunRow): FormattedCronRun {
  return {
    started_at: row.started_at,
    finished_at: row.finished_at,
    succeeded: row.succeeded,
    failed: row.failed,
    error: row.error,
    duration_s: row.finished_at !== null ? row.finished_at - row.started_at : null,
  }
}

export function parseKind(raw: string | null): CronKind {
  if (raw === 'item_high' || raw === 'item_low') return raw
  return 'case'
}

export async function handleCronRecent(
  url: URL,
  env: { DB: D1Database },
): Promise<{ runs: FormattedCronRun[] }> {
  const nParam = url.searchParams.get('n')
  const n = clampN(nParam !== null ? Number(nParam) : 24)
  const kind = parseKind(url.searchParams.get('kind'))
  const rows = await env.DB
    .prepare(
      `SELECT started_at, finished_at, succeeded, failed, error
       FROM cron_runs
       WHERE kind = ?
       ORDER BY started_at DESC
       LIMIT ?`,
    )
    .bind(kind, n)
    .all<CronRunRow>()
  const runs = (rows.results ?? []).map(formatCronRow)
  return { runs }
}
