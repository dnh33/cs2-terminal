import { useMemo } from 'react'
import { CASE_DB } from '../lib/cases'
import type { CaseRecord } from '../lib/cases'
import type { PriceData } from '../lib/metrics'
import { Skeleton } from './primitives/Skeleton'

export interface ItemWithPrice extends CaseRecord {
  price: PriceData | null
}

function StatBlock({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub?: string; accent?: string }) {
  return (
    <div className="px-4 py-3.5 border-r border-line flex-1 min-w-[140px]">
      <div className="text-[9px] tracking-[0.2em] text-ink-2 mb-1.5">{label}</div>
      <div className="font-display text-[28px] tracking-[0.02em] leading-none" style={{ color: accent || 'var(--text-0)' }}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-ink-2 mt-1.5">{sub}</div>}
    </div>
  )
}

export function MarketStats({ items }: { items: ItemWithPrice[] }) {
  const stats = useMemo(() => {
    const wp = items.filter(i => i.price)
    if (wp.length === 0) return null
    const prices = wp.map(i => i.price!.lowest)
    const totalVol = wp.reduce((s, i) => s + (i.price!.volume || 0), 0)
    const totalCap = wp.reduce((s, i) => s + i.price!.lowest * (i.price!.volume || 0), 0)
    const disc = wp.filter(i => i.pool === 'discontinued')
    const act = wp.filter(i => i.pool === 'active')
    const avgD = disc.length ? disc.reduce((s, i) => s + i.price!.lowest, 0) / disc.length : 0
    const avgA = act.length ? act.reduce((s, i) => s + i.price!.lowest, 0) / act.length : 0
    const ratio = avgA > 0 ? avgD / avgA : 0
    const max = Math.max(...prices)
    return {
      tracked: wp.length,
      totalVol,
      totalCap,
      avgD,
      avgA,
      ratio,
      max,
      maxName: wp.find(i => i.price!.lowest === max)?.name,
    }
  }, [items])

  if (!stats) {
    return (
      <div
        className="border-b border-line bg-bg-1 flex flex-wrap"
        aria-busy="true"
        aria-label="Loading market stats"
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="px-4 py-3.5 border-r border-line flex-1 min-w-[140px]">
            <Skeleton width="60%" height={9} className="mb-1.5" />
            <Skeleton width="80%" height={28} />
            <Skeleton width="40%" height={9} className="mt-1.5" />
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="border-b border-line bg-bg-1 flex flex-wrap">
      <StatBlock label="CASES TRACKED" value={stats.tracked} sub={`of ${CASE_DB.length} in DB`} />
      <StatBlock label="24H VOLUME" value={stats.totalVol.toLocaleString()} sub="units sold" accent="#4fd1c5" />
      <StatBlock label="DAILY MARKET CAP" value={`$${(stats.totalCap / 1000).toFixed(1)}K`} sub="approx, lowest×vol" />
      <StatBlock label="DISC / ACTIVE" value={`${stats.ratio.toFixed(1)}×`} sub={`$${stats.avgD.toFixed(2)} vs $${stats.avgA.toFixed(2)}`} accent="#ff7421" />
      <StatBlock label="HIGHEST PRICE" value={`$${stats.max.toFixed(2)}`} sub={stats.maxName} accent="#fbbf24" />
    </div>
  )
}
