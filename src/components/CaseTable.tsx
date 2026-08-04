import { useEffect, useMemo, useRef, useState } from 'react'
import type { CaseRecord, Pool } from '../lib/cases'
import type { PriceData, Metrics, PricePoint } from '../lib/metrics'
import { PoolBadge, MiniSparkline } from './Atoms'
import { KbdRow, KbdSortHeader } from './primitives/KeyboardTable'
import { Skeleton } from './primitives/Skeleton'
import { usePrevious } from '../lib/usePrevious'
import { useCatalystJournal } from '../lib/useCatalystJournal'
import { todayLocal, formatShortDate } from '../lib/dates'

interface CatalystChipInfo { count: number; next: string }

export interface ItemFull extends CaseRecord {
  price: PriceData | null
  metrics: Metrics | null
  history: PricePoint[]
}

export type SortKey = 'name' | 'pool' | 'price' | 'median' | 'spread' | 'volume' | 'age'
export type SortState = { key: SortKey; dir: 'asc' | 'desc' }
export type FilterState = 'all' | Pool

interface RowProps {
  item: ItemFull
  idx: number
  selected: boolean
  onClick: () => void
  catalyst?: CatalystChipInfo
}

function CaseRow({ item, idx, selected, onClick, catalyst }: RowProps) {
  const m = item.metrics, p = item.price
  const bg = selected ? 'rgba(232,104,26,0.08)' : 'transparent'

  // P0-4 audit fix: strengthened initial-load guard — first real price after `null` would flash UP for
  // every row. `prevPrice == null || item.price?.lowest == null` early-return prevents that.
  const prevPrice = usePrevious(item.price?.lowest)
  const [flash, setFlash] = useState<'up' | 'down' | null>(null)
  const flashElRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const cur = item.price?.lowest
    if (prevPrice == null || cur == null) return
    if (prevPrice === cur) return
    setFlash(cur > prevPrice ? 'up' : 'down')
  }, [item.price?.lowest, prevPrice])

  // P2-1 fix: native animationend listener — React 19 synthetic delegation for animation events
  // is unreliable under jsdom and varies across browsers. Filter by animationName to avoid bubbled
  // descendant animations clearing prematurely.
  useEffect(() => {
    const el = flashElRef.current
    if (!el) return
    const onEnd = (e: Event) => {
      const name = (e as AnimationEvent).animationName
      if (!name || name === 'flash-up' || name === 'flash-down') setFlash(null)
    }
    el.addEventListener('animationend', onEnd)
    return () => el.removeEventListener('animationend', onEnd)
  }, [])

  return (
    <KbdRow
      onActivate={onClick}
      selected={selected}
      aria-label={`${item.name}, ${item.pool}, ${p ? `lowest $${p.lowest.toFixed(2)}` : 'no price'}${catalyst ? `, ${catalyst.count} upcoming catalyst${catalyst.count === 1 ? '' : 's'}, next ${formatShortDate(catalyst.next)}` : ''}`}
      className="border-b border-line cursor-pointer transition-colors hover:bg-white/[0.02]"
      style={{
        background: bg,
        borderLeft: selected ? '2px solid var(--accent-sel)' : '2px solid transparent',
      }}
    >
      {/* Mobile card */}
      <div data-mobile-card className="flex md:hidden items-center justify-between px-4 py-3 gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <PoolBadge pool={item.pool} />
            <span className="text-ink-0 text-[12px] truncate">{item.name}</span>
          </div>
          <div className="text-[10px] text-ink-2 mt-0.5">
            {item.released} · {item.rare}{item.hasGloves ? ' · GLV' : ''}
            {catalyst && (
              <span className="ml-1 text-accent-data">
                {' • '}<span aria-hidden="true">●</span> {catalyst.count} {catalyst.count === 1 ? 'catalyst' : 'catalysts'} · {formatShortDate(catalyst.next)}
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="t-data-bold text-ink-0">
            {p ? `$${p.lowest.toFixed(2)}` : '—'}
          </div>
          <div className="text-[10px] text-ink-2">
            {p ? `${p.volume.toLocaleString()} 24H` : '—'}
          </div>
        </div>
      </div>

      {/* Desktop grid */}
      <div
        className="hidden md:grid items-center px-4 py-2.5 text-[12px]"
        style={{ gridTemplateColumns: '24px 2fr 60px 90px 70px 70px 70px 70px 80px' }}
      >
        <div className="text-ink-3 text-[10px]">{String(idx).padStart(2, '0')}</div>
        <div>
          <div className="text-ink-0 font-medium">{item.name}</div>
          <div className="text-[10px] text-ink-2 mt-0.5">
            {item.released} · {item.rare}{item.hasGloves ? ' · GLV' : ''}
            {catalyst && (
              <span className="ml-1 text-accent-data">
                {' • '}<span aria-hidden="true">●</span> {catalyst.count} {catalyst.count === 1 ? 'catalyst' : 'catalysts'} · {formatShortDate(catalyst.next)}
              </span>
            )}
          </div>
        </div>
        {/* justify-self-start: grid items stretch to fill their cell by
            default, and unlike the text cells (which never fill their own
            column width, leaving natural trailing space), this badge WOULD
            stretch to the full 60px column with zero gap before LOWEST. */}
        <PoolBadge pool={item.pool} className="justify-self-start" />
        <div
          ref={flashElRef}
          className="t-data-bold text-ink-0 num-flip tabular-nums"
          data-flash={flash ?? undefined}
        >
          {p ? `$${p.lowest.toFixed(2)}` : <span className="text-ink-3 text-[11px]">—</span>}
        </div>
        <div className="text-ink-1">{p ? `$${(p.median || 0).toFixed(2)}` : '—'}</div>
        <div className={m && m.spreadPct > 5 ? 'text-state-warn' : 'text-ink-1'}>
          {m ? `${m.spreadPct.toFixed(1)}%` : '—'}
        </div>
        <div className={p && p.volume > 1000 ? 'text-delta-up' : p && p.volume > 100 ? 'text-ink-1' : 'text-ink-3'}>
          {p ? p.volume.toLocaleString() : '—'}
        </div>
        <div className="text-ink-1">{m ? `${m.ageYears.toFixed(1)}y` : '—'}</div>
        <MiniSparkline
          data={item.history?.map(h => h.price)}
          modeled={!item.history?.some(h => h.source === 'real')}
        />
      </div>
    </KbdRow>
  )
}

interface TableProps {
  items: ItemFull[]
  selectedId: string | null
  onSelect: (id: string) => void
  sort: SortState
  setSort: React.Dispatch<React.SetStateAction<SortState>>
  filter: FilterState
  setFilter: (f: FilterState) => void
  loading?: boolean
}

export function CaseTable({ items, selectedId, onSelect, sort, setSort, filter, setFilter, loading }: TableProps) {
  const { entries: catalystEntries } = useCatalystJournal()
  const today = todayLocal()
  const upcomingByCase = useMemo(() => {
    const map = new Map<string, CatalystChipInfo>()
    for (const e of catalystEntries) {
      if (e.eventDate < today) continue
      const cur = map.get(e.caseId)
      if (!cur) map.set(e.caseId, { count: 1, next: e.eventDate })
      else map.set(e.caseId, { count: cur.count + 1, next: e.eventDate < cur.next ? e.eventDate : cur.next })
    }
    return map
  }, [catalystEntries, today])

  const headers: { k: SortKey | 'idx' | 'spark'; l: string }[] = [
    { k: 'idx', l: '#' },
    { k: 'name', l: 'CASE' },
    { k: 'pool', l: 'POOL' },
    { k: 'price', l: 'LOWEST' },
    { k: 'median', l: 'MEDIAN' },
    { k: 'spread', l: 'SPRD' },
    { k: 'volume', l: '24H VOL' },
    { k: 'age', l: 'AGE' },
    { k: 'spark', l: 'TREND' },
  ]
  const filters: FilterState[] = ['all', 'discontinued', 'rare', 'active']

  return (
    <div
      className="bg-bg-1 border border-line"
      role="grid"
      aria-label="Case market table"
      aria-rowcount={items.length + 1}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-bg-2">
        <div className="flex items-center gap-3">
          <h2 className="text-[11px] tracking-[0.2em] text-ink-1 font-semibold m-0">// MARKET TABLE</h2>
          <span className="text-[10px] text-ink-3">{items.length} ROWS</span>
        </div>
        <div className="flex gap-1.5">
          {filters.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-[10px] tracking-[0.15em] px-3 py-1.5 min-h-[28px] inline-flex items-center ${
                filter === f
                  ? 'border border-accent-sel text-accent-sel bg-accent-sel/10'
                  : 'border border-line-bright text-ink-1 hover:border-ink-2'
              }`}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div role="rowgroup">
        <div
          className="hidden md:grid px-4 py-2 border-b border-line bg-bg-2"
          role="row"
          style={{ gridTemplateColumns: '24px 2fr 60px 90px 70px 70px 70px 70px 80px' }}
        >
          {headers.map(h => {
            if (h.k === 'idx' || h.k === 'spark') {
              return (
                <div key={h.k} role="columnheader" className="t-micro text-ink-2">
                  {h.l}
                </div>
              )
            }
            const isActive = sort.key === h.k
            const dir: 'asc' | 'desc' | null = isActive ? sort.dir : null
            return (
              <div key={h.k} role="columnheader">
                <KbdSortHeader
                  onClick={() =>
                    setSort(p => ({
                      key: h.k as SortKey,
                      dir: p.key === h.k && p.dir === 'desc' ? 'asc' : 'desc',
                    }))
                  }
                  sort={dir}
                >
                  {h.l}
                </KbdSortHeader>
              </div>
            )
          })}
        </div>
      </div>

      <div
        className="max-h-[520px] overflow-y-auto"
        role="rowgroup"
        aria-busy={loading || undefined}
      >
        {loading && items.length === 0
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="px-4 py-2.5 border-b border-line">
                <Skeleton height={20} />
              </div>
            ))
          : items.map((item, i) => (
              <CaseRow
                key={item.id}
                item={item}
                idx={i + 1}
                selected={item.id === selectedId}
                onClick={() => onSelect(item.id)}
                catalyst={upcomingByCase.get(item.id)}
              />
            ))}
      </div>
    </div>
  )
}
