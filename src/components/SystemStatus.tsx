import type { CronRecentRun } from '../lib/api'

interface Props {
  runsCase: CronRecentRun[]
  runsHi: CronRecentRun[]
  runsLo: CronRecentRun[]
  /** Per-tier endpoint failure markers — when a tier's fetch rejected, set true. */
  failCase?: boolean
  failHi?: boolean
  failLo?: boolean
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

interface TierProps {
  label: 'CASE' | 'ITEM-HI' | 'ITEM-LO'
  runs: CronRecentRun[]
  failed?: boolean
  ariaLabelKey: string
}

function Tier({ label, runs, failed, ariaLabelKey }: TierProps) {
  if (failed) {
    return (
      <div className="flex items-center gap-2" role="img" aria-label={`${ariaLabelKey} runs: endpoint fail`}>
        <span className="text-[10px] text-ink-2 tracking-[0.15em] w-16">{label}</span>
        <span className="text-[10px] text-ink-3 tracking-[0.15em]">// ENDPOINT FAIL</span>
      </div>
    )
  }
  if (runs.length === 0) {
    return (
      <div className="flex items-center gap-2" role="img" aria-label={`${ariaLabelKey} runs: no runs recorded`}>
        <span className="text-[10px] text-ink-2 tracking-[0.15em] w-16">{label}</span>
        <span className="text-[10px] text-ink-3 tracking-[0.15em]">// NO RUNS</span>
      </div>
    )
  }
  const counts = { ok: 0, degraded: 0, failed: 0 }
  // runs is desc by started_at; reverse for left=oldest visual
  const reversed = [...runs].reverse()
  for (const r of reversed) counts[classifyRun(r)]++

  const summary = `Last ${runs.length} ${ariaLabelKey} runs: ${counts.ok} ok, ${counts.degraded} degraded, ${counts.failed} failed.`

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-ink-2 tracking-[0.15em] w-16">{label}</span>
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
    </div>
  )
}

export function SystemStatus({ runsCase, runsHi, runsLo, failCase, failHi, failLo }: Props) {
  return (
    <div className="flex flex-col gap-1">
      <Tier label="CASE" runs={runsCase} failed={failCase} ariaLabelKey="case-sweep" />
      <Tier label="ITEM-HI" runs={runsHi} failed={failHi} ariaLabelKey="item-high-tier" />
      <Tier label="ITEM-LO" runs={runsLo} failed={failLo} ariaLabelKey="item-low-tier" />
    </div>
  )
}
