/**
 * /cron/recent?n=N handler — returns last N case-cron runs for the
 * SystemStatus sparkline (Phase 3 spec § 2.1.G).
 *
 * Scope: kind='case' only. The mixed-tier liveness query in /stats
 * (last single row, no kind filter) intentionally diverges — footer
 * shows worker liveness across all tiers, sparkline shows case-tier
 * cadence history.
 *
 * Pure helpers (`clampN`, `formatCronRow`) are extracted for unit
 * testing without spinning up D1. The `handleCronRecent` runner returns
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

export async function handleCronRecent(
  url: URL,
  env: { DB: D1Database },
): Promise<{ runs: FormattedCronRun[] }> {
  const nParam = url.searchParams.get('n')
  const n = clampN(nParam !== null ? Number(nParam) : 24)
  const rows = await env.DB
    .prepare(
      `SELECT started_at, finished_at, succeeded, failed, error
       FROM cron_runs
       WHERE kind = 'case'
       ORDER BY started_at DESC
       LIMIT ?`,
    )
    .bind(n)
    .all<CronRunRow>()
  const runs = (rows.results ?? []).map(formatCronRow)
  return { runs }
}
