import { useMemo } from 'react'
import { CASE_DB } from '../lib/cases'
import type { CaseRecord } from '../lib/cases'
import type { PriceData } from '../lib/metrics'
import type { MoverRow } from '../lib/api'
import { Skeleton } from './primitives/Skeleton'
import { NumberFlip } from './primitives/NumberFlip'

export interface ItemWithPrice extends CaseRecord {
  price: PriceData | null
}

function StatBlock({
  label,
  value,
  sub,
  accent,
  dominant = false,
  dataTest,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  accent?: string
  dominant?: boolean
  dataTest?: string
}) {
  // Phase 4.5 Plan 1 — dominant doubles flex-basis and bumps numeral size for
  // the HERO STRIP 24H DOLLAR VOLUME block.
  const flexClass = dominant ? 'flex-[2] min-w-[280px]' : 'flex-1 min-w-[140px]'
  const numClass = dominant ? 'text-[44px]' : 'text-[28px]'
  return (
    <div data-test={dataTest} className={`px-4 py-3.5 border-r border-line ${flexClass}`}>
      <div className="text-[9px] tracking-[0.2em] text-ink-2 mb-1.5">{label}</div>
      <div className={`font-display ${numClass} tracking-[0.02em] leading-none`} style={{ color: accent || 'var(--text-0)' }}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-ink-2 mt-1.5">{sub}</div>}
    </div>
  )
}

function BiggestMoverContent({ topMover }: { topMover: MoverRow | null | undefined }) {
  if (topMover === undefined) {
    return <Skeleton width="60%" height={28} />
  }
  if (topMover === null) {
    return <span className="text-ink-3">—</span>
  }
  const sign = topMover.pct_change >= 0 ? '+' : ''
  const color = topMover.pct_change >= 0 ? '#4ade80' : '#f87171'
  return (
    <span style={{ color }} className="tabular-nums">
      {sign}{topMover.pct_change.toFixed(1)}%
    </span>
  )
}

export function MarketStats({ items, topMover }: { items: ItemWithPrice[]; topMover?: MoverRow | null }) {
  const stats = useMemo(() => {
    const wp = items.filter(i => i.price)
    if (wp.length === 0) return null
    const totalCap = wp.reduce((s, i) => s + i.price!.lowest * (i.price!.volume || 0), 0)
    const disc = wp.filter(i => i.pool === 'discontinued')
    const act = wp.filter(i => i.pool === 'active')
    const avgD = disc.length ? disc.reduce((s, i) => s + i.price!.lowest, 0) / disc.length : 0
    const avgA = act.length ? act.reduce((s, i) => s + i.price!.lowest, 0) / act.length : 0
    const ratio = avgA > 0 ? avgD / avgA : 0
    return {
      tracked: wp.length,
      totalCap,
      avgD,
      avgA,
      ratio,
    }
  }, [items])

  if (!stats) {
    // Skeleton: 4 cards (dominant + 3 satellites). Plan 1 reduces from 5 to 4.
    return (
      <div
        className="border-b border-line bg-bg-1 flex flex-wrap"
        aria-busy="true"
        aria-label="Loading market stats"
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`px-4 py-3.5 border-r border-line ${i === 0 ? 'flex-[2] min-w-[280px]' : 'flex-1 min-w-[140px]'}`}>
            <Skeleton width="60%" height={9} className="mb-1.5" />
            <Skeleton width="80%" height={i === 0 ? 44 : 28} />
            <Skeleton width="40%" height={9} className="mt-1.5" />
          </div>
        ))}
      </div>
    )
  }

  // Phase 5+ TODO: when worker exposes total_market_cap_24h_ago, compute
  // dvol24hPctChange and replace the "—" placeholder. Plan 1 ships the slot;
  // Phase 5 fills it.
  const delta24hPlaceholder = 'Δ24H · —'

  return (
    <div className="border-b border-line bg-bg-1 flex flex-wrap">
      {/* DOMINANT — 24H DOLLAR VOLUME (renamed from DAILY MARKET CAP) */}
      <StatBlock
        dominant
        dataTest="hero-dominant"
        label="24H DOLLAR VOLUME"
        value={<NumberFlip value={stats.totalCap} formatter={(n) => `$${(n / 1000).toFixed(1)}K`} />}
        sub={<span className="tabular-nums tracking-[0.1em]">{delta24hPlaceholder}</span>}
        accent="#4fd1c5"
      />
      {/* SATELLITE 1 — BIGGEST MOVER 24H */}
      <StatBlock
        dataTest="hero-mover"
        label="BIGGEST MOVER 24H"
        value={<BiggestMoverContent topMover={topMover} />}
        sub={topMover && typeof topMover === 'object' ? topMover.name : undefined}
      />
      {/* SATELLITE 2 — DISC / ACTIVE */}
      <StatBlock
        label="DISC / ACTIVE"
        value={<NumberFlip value={stats.ratio} suffix="×" decimals={1} />}
        sub={`$${stats.avgD.toFixed(2)} vs $${stats.avgA.toFixed(2)}`}
        accent="#ff7421"
      />
      {/* SATELLITE 3 — CASES TRACKED */}
      <StatBlock
        label="CASES TRACKED"
        value={<NumberFlip value={stats.tracked} decimals={0} flashOnChange={false} />}
        sub={`of ${CASE_DB.length} in DB`}
      />
    </div>
  )
}
