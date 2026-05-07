import type { CronRecentRun } from '../lib/api'

interface Props {
  runs: CronRecentRun[]
}

function classifyRun(run: CronRecentRun): 'ok' | 'degraded' | 'failed' {
  if (run.error !== null) return 'failed'
  if (run.failed > 0) return 'degraded'
  return 'ok'
}

const STATUS_COLOR: Record<string, string> = {
  ok: 'var(--delta-up)',
  degraded: 'var(--state-warn)',
  failed: 'var(--delta-dn)',
}

export function SystemStatus({ runs }: Props) {
  if (runs.length === 0) {
    return <div className="text-[10px] text-ink-3 tracking-[0.15em]">// NO CRON HISTORY</div>
  }

  const counts = { ok: 0, degraded: 0, failed: 0 }
  // runs is desc by started_at; reverse for left=oldest visual
  const reversed = [...runs].reverse()
  for (const r of reversed) counts[classifyRun(r)]++

  const summary = `Last ${runs.length} case-sweep runs: ${counts.ok} ok, ${counts.degraded} degraded, ${counts.failed} failed.`

  return (
    <div role="img" aria-label={summary} className="flex items-end gap-[2px] h-6">
      {reversed.map((r, i) => {
        const status = classifyRun(r)
        const total = r.succeeded + r.failed
        const ratio = total > 0 ? r.succeeded / total : 0
        // P2-1 audit fix: drop 0.3 fudge for failed runs; let the 2px floor handle it.
        const heightPx = Math.max(2, Math.round(24 * ratio))
        const tooltip = `${new Date(r.started_at * 1000).toISOString().slice(0, 16).replace('T', ' ')} — ${r.succeeded}/${total} ok · ${r.duration_s ?? '?'}s`
        return (
          <div
            key={i}
            data-cron-bar
            data-status={status}
            title={tooltip}
            style={{
              width: 8,
              height: heightPx,
              background: STATUS_COLOR[status],
            }}
          />
        )
      })}
    </div>
  )
}
