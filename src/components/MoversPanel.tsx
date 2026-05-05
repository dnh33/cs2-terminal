import { useEffect, useState } from 'react'
import { fetchMovers } from '../lib/api'
import type { MoverRow } from '../lib/api'
import { PoolBadge } from './Atoms'
import { C } from '../lib/theme'
import { KbdRow } from './primitives/KeyboardTable'

const WINDOWS: { label: string; days: number }[] = [
  { label: '24H', days: 1 },
  { label: '7D',  days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
]

export function MoversPanel({ onSelect }: { onSelect: (id: string) => void }) {
  const [days, setDays] = useState(7)
  const [movers, setMovers] = useState<MoverRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancel = false
    setLoading(true)
    setError(null)
    fetchMovers(days)
      .then(rows => { if (!cancel) setMovers(rows) })
      .catch(e => { if (!cancel) setError(e.message) })
      .finally(() => { if (!cancel) setLoading(false) })
    return () => { cancel = true }
  }, [days])

  const gainers = movers.filter(m => m.pct_change > 0).slice(0, 5)
  const losers  = movers.filter(m => m.pct_change < 0).slice(0, 5)
  const enoughHistory = movers.length > 0

  return (
    <div className="bg-bg-1 border border-line" role="grid" aria-label="Top movers">
      <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-bg-2">
        <div>
          <span className="text-[11px] tracking-[0.2em] text-ink-1 font-semibold">// TOP MOVERS</span>
          <span className="text-[10px] text-ink-3 ml-2">real Δ from D1 history</span>
        </div>
        <div className="flex gap-1">
          {WINDOWS.map(w => (
            <button
              key={w.days}
              onClick={() => setDays(w.days)}
              className={`text-[10px] tracking-[0.15em] px-2 py-0.5 ${
                days === w.days
                  ? 'border border-accent-orange text-accent-orange bg-accent-orange/10'
                  : 'border border-line-bright text-ink-2 hover:text-ink-1'
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="p-6 text-[11px] text-ink-3 text-center tracking-[0.15em]">// LOADING...</div>
      )}
      {error && (
        <div className="p-3 text-[11px] text-accent-red border-b border-line">ERR: {error}</div>
      )}
      {!loading && !error && !enoughHistory && (
        <div className="p-6 text-[11px] text-ink-3 text-center tracking-[0.1em] leading-[1.6]">
          // NOT ENOUGH HISTORY YET
          <div className="mt-2 text-ink-2">Need ≥2 snapshots in window. Wait for the cron to accumulate data.</div>
        </div>
      )}
      {!loading && !error && enoughHistory && (
        <div className="grid grid-cols-2 divide-x divide-line" role="rowgroup">
          <MoverList title="GAINERS" rows={gainers} accent={C.green} onSelect={onSelect} />
          <MoverList title="LOSERS"  rows={losers}  accent={C.red}   onSelect={onSelect} />
        </div>
      )}
    </div>
  )
}

function MoverList({
  title, rows, accent, onSelect,
}: { title: string; rows: MoverRow[]; accent: string; onSelect: (id: string) => void }) {
  return (
    <div>
      <div className="px-4 py-2 text-[9px] tracking-[0.25em] font-bold border-b border-line" style={{ color: accent }}>
        ▸ {title}
      </div>
      {rows.length === 0 ? (
        <div className="p-4 text-[11px] text-ink-3 tracking-[0.1em]">// none in window</div>
      ) : (
        rows.map(r => (
          <KbdRow
            key={r.id}
            onActivate={() => onSelect(r.id)}
            selected={false}
            aria-label={`${r.name}, ${r.pct_change > 0 ? 'up' : 'down'} ${Math.abs(r.pct_change).toFixed(1)} percent, $${r.last_price.toFixed(2)}`}
            className="flex items-center justify-between px-4 py-2 border-b border-line hover:bg-white/[0.02] cursor-pointer"
          >
            <div className="flex items-center gap-2 min-w-0">
              <PoolBadge pool={r.pool} />
              <div className="min-w-0">
                <div className="text-[12px] text-ink-0 truncate">{r.name}</div>
                <div className="text-[10px] text-ink-2">${r.last_price.toFixed(2)} from ${r.first_price.toFixed(2)}</div>
              </div>
            </div>
            <div className="font-display text-[18px] shrink-0" style={{ color: accent }}>
              {r.pct_change > 0 ? '+' : ''}{r.pct_change.toFixed(1)}%
            </div>
          </KbdRow>
        ))
      )}
    </div>
  )
}
