import type { CaseRecord, Pool } from '../lib/cases'
import type { PriceData, Metrics, PricePoint } from '../lib/metrics'
import { PoolBadge, MiniSparkline } from './Atoms'
import { KbdRow, KbdSortHeader } from './primitives/KeyboardTable'

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
}

function CaseRow({ item, idx, selected, onClick }: RowProps) {
  const m = item.metrics, p = item.price
  const bg = selected ? 'rgba(232,104,26,0.08)' : 'transparent'

  return (
    <KbdRow
      onActivate={onClick}
      selected={selected}
      aria-label={`${item.name}, ${item.pool}, ${p ? `lowest $${p.lowest.toFixed(2)}` : 'no price'}`}
      className="grid items-center px-4 py-2.5 border-b border-line cursor-pointer text-[12px] transition-colors hover:bg-white/[0.02]"
      style={{
        gridTemplateColumns: '24px 2fr 60px 90px 70px 70px 70px 70px 80px',
        background: bg,
        borderLeft: selected ? '2px solid var(--accent-sel)' : '2px solid transparent',
      }}
    >
      <div className="text-ink-3 text-[10px]">{String(idx).padStart(2, '0')}</div>
      <div>
        <div className="text-ink-0 font-medium">{item.name}</div>
        <div className="text-[10px] text-ink-2 mt-0.5">
          {item.released} · {item.rare}{item.hasGloves ? ' · GLV' : ''}
        </div>
      </div>
      <PoolBadge pool={item.pool} />
      <div className="t-data-bold text-ink-0">
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
      <MiniSparkline data={item.history?.map(h => h.price)} />
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
}

export function CaseTable({ items, selectedId, onSelect, sort, setSort, filter, setFilter }: TableProps) {
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
              className={`text-[10px] tracking-[0.15em] px-2.5 py-1 ${
                filter === f
                  ? 'border border-accent-orange text-accent-orange bg-accent-orange/10'
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
          className="grid px-4 py-2 border-b border-line bg-bg-2"
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

      <div className="max-h-[520px] overflow-y-auto" role="rowgroup">
        {items.map((item, i) => (
          <CaseRow
            key={item.id}
            item={item}
            idx={i + 1}
            selected={item.id === selectedId}
            onClick={() => onSelect(item.id)}
          />
        ))}
      </div>
    </div>
  )
}
