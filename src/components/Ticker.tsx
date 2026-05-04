import type { Pool } from '../lib/cases'

export interface TickerRow {
  shortName: string
  price: number
  pool: Pool
}

const POOL_COLOR: Record<Pool, string> = {
  discontinued: 'text-accent-orange border-accent-orange',
  rare: 'text-accent-cyan border-accent-cyan',
  active: 'text-accent-green border-accent-green',
}

export function Ticker({ rows }: { rows: TickerRow[] }) {
  if (!rows || rows.length === 0) return null
  const display = [...rows, ...rows]
  return (
    <div className="border-b border-line bg-bg-0 overflow-hidden py-2">
      <div className="flex gap-8 whitespace-nowrap text-[11px] animate-ticker">
        {display.map((r, i) => (
          <div key={i} className="flex items-center gap-2 shrink-0">
            <span className="text-ink-2 tracking-[0.05em]">{r.shortName}</span>
            <span className="text-ink-0 font-semibold">${r.price.toFixed(2)}</span>
            <span className={`text-[9px] tracking-[0.1em] px-1.5 border ${POOL_COLOR[r.pool]}`}>
              {r.pool.toUpperCase().slice(0, 4)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
