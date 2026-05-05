import type { Pool } from '../lib/cases'

export interface TickerRow {
  shortName: string
  price: number
  pool: Pool
  pctChange?: number
}

const POOL_COLOR: Record<Pool, string> = {
  discontinued: 'text-accent-sel border-accent-sel',
  rare: 'text-accent-data border-accent-data',
  active: 'text-delta-up border-delta-up',
}

export function Ticker({ rows }: { rows: TickerRow[] }) {
  if (!rows || rows.length === 0) return null
  const display = [...rows, ...rows]
  return (
    <div
      role="region"
      aria-label="Live tickers"
      className="border-b border-line bg-bg-0 overflow-hidden py-2 group"
    >
      <div
        className="flex gap-8 whitespace-nowrap text-[11px] animate-ticker-drift group-hover:[animation-play-state:paused] motion-reduce:animate-none motion-reduce:overflow-x-auto"
      >
        {display.map((r, i) => (
          <div key={i} className="flex items-center gap-2 shrink-0">
            <span className="text-ink-2 tracking-[0.05em]">{r.shortName}</span>
            <span className="t-data-bold text-ink-0">${r.price.toFixed(2)}</span>
            {r.pctChange != null && (
              <span
                className="text-[10px]"
                style={{ color: r.pctChange >= 0 ? 'var(--delta-up)' : 'var(--delta-dn)' }}
              >
                {r.pctChange >= 0 ? '▲' : '▼'} {Math.abs(r.pctChange).toFixed(1)}%
              </span>
            )}
            <span className={`text-[9px] tracking-[0.1em] px-1.5 border ${POOL_COLOR[r.pool]}`}>
              {r.pool.toUpperCase().slice(0, 4)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
