import { useEffect, useState } from 'react'
import { fetchMovers } from '../lib/api'
import type { MoverRow } from '../lib/api'
import { PoolBadge } from './Atoms'
import { C } from '../lib/theme'
import { KbdRow } from './primitives/KeyboardTable'
import { Banner } from './primitives/Banner'
import { NumberFlip } from './primitives/NumberFlip'

const WINDOWS: { label: string; days: number }[] = [
  { label: '24H', days: 1 },
  { label: '7D',  days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
]

interface MoversPanelProps {
  onSelect: (id: string) => void
  /** Latest snapshot age in seconds — when <86400 the 24H window is hidden */
  earliestSnapshotAge?: number
}

export function MoversPanel({ onSelect, earliestSnapshotAge }: MoversPanelProps) {
  const [days, setDays] = useState(7)
  const [movers, setMovers] = useState<MoverRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancel = false
    setLoading(true)
    setError(null)
    fetchMovers(days)
      .then(resp => { if (!cancel) setMovers(resp.movers) })
      .catch(e => { if (!cancel) setError(e.message) })
      .finally(() => { if (!cancel) setLoading(false) })
    return () => { cancel = true }
  }, [days])

  const gainers = movers.filter(m => m.pct_change > 0).slice(0, 5)
  const losers  = movers.filter(m => m.pct_change < 0).slice(0, 5)
  const enoughHistory = movers.length > 0
  const visibleWindows = (earliestSnapshotAge !== undefined && earliestSnapshotAge < 86400)
    ? WINDOWS.filter(w => w.days !== 1)
    : WINDOWS

  return (
    <div className="bg-bg-1 border border-line" role="grid" aria-label="Top movers">
      <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-bg-2">
        <div>
          <span className="text-[11px] tracking-[0.2em] text-ink-1 font-semibold">// TOP MOVERS</span>
          <span className="text-[10px] text-ink-3 ml-2">real Δ from D1 history</span>
        </div>
        <div className="flex gap-1">
          {visibleWindows.map(w => (
            <button
              key={w.days}
              onClick={() => setDays(w.days)}
              className={`text-[10px] tracking-[0.15em] px-3 py-1 min-h-[24px] inline-flex items-center ${
                days === w.days
                  ? 'border border-accent-sel text-accent-sel bg-accent-sel/10'
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
      {error && <Banner variant="error" className="m-3">{error}</Banner>}
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
        rows.map(r => {
          const vol = (r as MoverRow & { last_volume?: number }).last_volume
          const hasVol = typeof vol === 'number' && Number.isFinite(vol)
          const volColor = hasVol
            ? (vol! > 1000 ? 'var(--delta-up)' : vol! > 100 ? 'var(--ink-1)' : 'var(--ink-3)')
            : 'var(--ink-3)'
          return (
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
                  <div className="text-[10px] text-ink-2">
                    <NumberFlip value={r.last_price} prefix="$" decimals={2} /> from <NumberFlip value={r.first_price} prefix="$" decimals={2} flashOnChange={false} />
                  </div>
                </div>
              </div>
              <div
                className="text-[10px] tabular-nums shrink-0 mr-2 text-right"
                data-testid="mover-row-volume"
                style={{ color: volColor }}
              >
                {hasVol ? <NumberFlip value={vol!} formatter={(n) => n.toLocaleString('en-US')} /> : '—'}
                <div className="text-[8px] text-ink-3 tracking-[0.15em] uppercase">vol/24h</div>
              </div>
              <div className="font-display text-[18px] shrink-0" style={{ color: accent }}>
                {r.pct_change > 0 ? '+' : ''}<NumberFlip value={r.pct_change} suffix="%" decimals={1} />
              </div>
            </KbdRow>
          )
        })
      )}
    </div>
  )
}
