import { useMemo, useState, useRef } from 'react'
import type { ItemFull } from '../CaseTable'

interface ScatterProps {
  items: ItemFull[]
  onSelect: (id: string) => void
  selectedId: string | null
}

const W = 480, H = 200, PAD_L = 36, PAD_R = 8, PAD_T = 8, PAD_B = 24

function logMap(v: number, [vMin, vMax]: [number, number], [pxMin, pxMax]: [number, number]): number {
  // Single-point dataset guard — when min === max, log-difference is 0,
  // dividing produces NaN and all points render at NaN coords (invisible).
  if (vMax === vMin) return (pxMin + pxMax) / 2
  const lv = Math.log10(Math.max(v, 1e-4))
  const t = (lv - Math.log10(vMin)) / (Math.log10(vMax) - Math.log10(vMin))
  return pxMin + t * (pxMax - pxMin)
}

function logTicks(min: number, max: number): number[] {
  // Decade ticks: 1, 10, 100, 1000, 10000 — clamped to [min, max]
  const out: number[] = []
  for (let exp = Math.floor(Math.log10(min)); exp <= Math.ceil(Math.log10(max)); exp++) {
    const v = Math.pow(10, exp)
    if (v >= min && v <= max) out.push(v)
  }
  // Degenerate extent (single-point dataset): vMin === vMax. No tick has
  // informational value — return empty so axis renders without label clutter
  // (and avoids tooltip collision with the lone tick label).
  if (min === max) return []
  // Sub-decade fallback: extents like [120, 850] yield zero decade ticks.
  // Fall back to [min, geometric-mid, max] so the user always sees axis context.
  if (out.length === 0) {
    return [min, Math.sqrt(min * max), max]
  }
  return out
}

interface ScatterPointProps {
  d: { id: string; name: string; vol: number; price: number; pool: string }
  cx: number
  cy: number
  selected: boolean
  onSelect: () => void
  onHover: (x: number, y: number) => void
  onLeave: (id: string) => void
  containerRef: React.RefObject<HTMLDivElement | null>
}

function ScatterPoint({ d, cx, cy, selected, onSelect, onHover, onLeave, containerRef }: ScatterPointProps) {
  const colors: Record<string, string> = {
    discontinued: 'var(--accent-sel)',
    rare: 'var(--accent-data)',
    active: 'var(--delta-up)',
  }
  const fill = colors[d.pool] ?? 'var(--ink-2)'
  const r = selected ? 10 : 8
  const stroke = selected ? 'var(--on-accent)' : 'none'
  const sw = selected ? 1.5 : 0
  const handleEnter = (e: React.MouseEvent) => {
    // Tooltip position: convert viewport coords (clientX/Y) to container-relative
    // coords using getBoundingClientRect. Using clientX/Y directly puts tooltip
    // wildly off-screen because the wrapper is `relative` and inset:0 is the
    // wrapper's own coordinate origin.
    const rect = containerRef.current?.getBoundingClientRect()
    const x = rect ? e.clientX - rect.left : e.clientX
    const y = rect ? e.clientY - rect.top : e.clientY
    onHover(x, y)
  }
  const props = {
    fill, stroke, strokeWidth: sw,
    style: { cursor: 'pointer' } as const,
    onClick: onSelect,
    onMouseEnter: handleEnter,
    onMouseLeave: () => onLeave(d.id),
  }
  if (d.pool === 'rare') {
    const h = r * 1.4
    return <polygon points={`${cx},${cy - h * 0.7} ${cx - h * 0.7},${cy + h * 0.5} ${cx + h * 0.7},${cy + h * 0.5}`} {...props} />
  }
  if (d.pool === 'active') {
    return <rect x={cx - r * 0.85} y={cy - r * 0.85} width={r * 1.7} height={r * 1.7} {...props} />
  }
  return <circle cx={cx} cy={cy} r={r} {...props} />
}

export function VolumePriceScatter({ items, onSelect, selectedId }: ScatterProps) {
  const [hover, setHover] = useState<{ id: string; x: number; y: number; name: string; price: number; vol: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const data = useMemo(
    () => items
      .filter(i => i.price && Number.isFinite(i.price.volume) && i.price.volume > 0)
      .map(i => ({
        id: i.id, name: i.name, vol: i.price!.volume, price: i.price!.lowest, pool: i.pool,
      })),
    [items],
  )

  const topIds = useMemo(() => new Set(
    [...data].sort((a, b) => b.vol - a.vol).slice(0, 5).map(d => d.id),
  ), [data])

  if (data.length === 0) {
    return (
      <div className="bg-bg-1 border border-line p-4">
        <h2 className="text-[10px] tracking-[0.2em] text-ink-1 font-semibold mb-2.5 m-0">// PRICE × VOLUME (LIQUIDITY MAP)</h2>
        <div className="h-[200px] flex items-center justify-center text-ink-3 text-[11px] tracking-[0.15em]">
          // INSUFFICIENT VOLUME DATA
        </div>
      </div>
    )
  }

  const volExtent: [number, number] = [
    Math.max(1, Math.min(...data.map(d => d.vol))),
    Math.max(...data.map(d => d.vol)),
  ]
  const priceExtent: [number, number] = [
    Math.max(0.01, Math.min(...data.map(d => d.price))),
    Math.max(...data.map(d => d.price)),
  ]

  const xPx = (vol: number) => logMap(vol, volExtent, [PAD_L, W - PAD_R])
  const yPx = (price: number) => logMap(price, priceExtent, [H - PAD_B, PAD_T])

  const summary = `${data.length} cases plotted by 24h volume vs lowest price`

  return (
    <div className="bg-bg-1 border border-line p-4">
      <h2 className="text-[10px] tracking-[0.2em] text-ink-1 font-semibold mb-2.5 m-0">// PRICE × VOLUME (LIQUIDITY MAP)</h2>
      <div role="img" aria-label={summary} className="relative" ref={containerRef}>
        {/* LAYERING ORDER (lock — pinned by test):
              1. quadrant tints     (lowest, atmosphere)
              2. grid lines + ticks (mid-low)
              3. axis labels        (mid)
              4. point shapes       (high)
              5. persistent labels  (highest, top-5/selected names) */}
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none">
          {/* 1. quadrant tints */}
          <rect x={W / 2} y={0}     width={W / 2} height={H / 2} fill="rgb(var(--accent-data-rgb) / 0.04)" />
          <rect x={W / 2} y={H / 2} width={W / 2} height={H / 2} fill="rgb(var(--delta-up-rgb) / 0.04)" />
          <rect x={0}     y={0}     width={W / 2} height={H / 2} fill="rgb(var(--state-warn-rgb) / 0.04)" />

          {/* 2/3. grid + ticks */}
          {logTicks(volExtent[0], volExtent[1]).map(t => (
            <g key={`x-${t}`}>
              <line x1={xPx(t)} y1={PAD_T} x2={xPx(t)} y2={H - PAD_B} stroke="var(--bg-3)" strokeDasharray="2 4" />
              <text x={xPx(t)} y={H - PAD_B + 12} fontSize={9} fill="var(--ink-2)" textAnchor="middle">
                {t >= 1000 ? `${(t / 1000).toFixed(0)}K` : t.toString()}
              </text>
            </g>
          ))}
          {logTicks(priceExtent[0], priceExtent[1]).map(t => (
            <g key={`y-${t}`}>
              <line x1={PAD_L} y1={yPx(t)} x2={W - PAD_R} y2={yPx(t)} stroke="var(--bg-3)" strokeDasharray="2 4" />
              <text x={PAD_L - 4} y={yPx(t) + 3} fontSize={9} fill="var(--ink-2)" textAnchor="end">
                ${t.toFixed(t < 10 ? 2 : 0)}
              </text>
            </g>
          ))}

          {/* 2.5. axis baselines (preserves Recharts axis-stroke fidelity) */}
          <line x1={PAD_L} y1={H - PAD_B} x2={W - PAD_R} y2={H - PAD_B} stroke="var(--line)" strokeWidth={1} />
          <line x1={PAD_L} y1={PAD_T}     x2={PAD_L}     y2={H - PAD_B} stroke="var(--line)" strokeWidth={1} />

          {/* 4. points */}
          {data.map(d => (
            <ScatterPoint key={d.id}
              d={d} cx={xPx(d.vol)} cy={yPx(d.price)}
              selected={d.id === selectedId}
              onSelect={() => onSelect(d.id)}
              onHover={(x, y) => setHover({ id: d.id, name: d.name, price: d.price, vol: d.vol, x, y })}
              onLeave={(leavingId) => setHover(prev => prev?.id === leavingId ? null : prev)}
              containerRef={containerRef}
            />
          ))}

          {/* 5. persistent labels for top-5 + selected — RHS-truncation flip.
                Suppress label for the currently hovered item to avoid duplicate
                name rendering (tooltip shows it). Also suppress when only one
                point exists — a sole label is visual noise and collides with
                tooltip text in test queries. */}
          {(data.length > 1 ? data.filter(d => (topIds.has(d.id) || d.id === selectedId) && d.id !== hover?.id) : []).map(d => {
            const px = xPx(d.vol), py = yPx(d.price)
            const labelText = d.name.slice(0, 12)
            // Approx 6px per char in 9px JetBrains Mono
            const labelW = labelText.length * 6
            const wouldClipRight = px + 10 + labelW > W - PAD_R
            return (
              <text key={`label-${d.id}`}
                x={wouldClipRight ? px - 10 : px + 10}
                y={py + 4}
                fontSize={9} fill="var(--ink-2)"
                textAnchor={wouldClipRight ? 'end' : 'start'}
                data-persistent-label="" fontFamily={'"JetBrains Mono", monospace'}>
                {labelText}
              </text>
            )
          })}
        </svg>

        {hover && (() => {
          // Tooltip overflow flip — prevent right-edge clipping.
          // Estimate tooltip width: longest visible chars ≈ name (≤12 truncated) + price + vol.
          // Approx 8px/char at 11px font + padding ≈ 140px conservative upper bound.
          const TOOLTIP_W = 140
          const TOOLTIP_H = 36
          const containerW = containerRef.current?.clientWidth ?? W
          const flipX = hover.x + TOOLTIP_W + 12 > containerW
          const flipY = hover.y - TOOLTIP_H < 0
          const left = flipX ? Math.max(0, hover.x - TOOLTIP_W - 12) : hover.x + 12
          const top  = flipY ? hover.y + 12 : hover.y - 12
          return (
            <div className="absolute pointer-events-none bg-bg-1 border border-line-bright px-2.5 py-2 text-[11px]"
              style={{ left: `${left}px`, top: `${top}px` }}>
              <div className="text-accent-sel font-bold">{hover.name}</div>
              <div className="text-ink-1">${hover.price.toFixed(2)} · {hover.vol.toLocaleString()} vol</div>
            </div>
          )
        })()}
      </div>

      {/* legend (unchanged shape) */}
      <div className="flex gap-3.5 text-[10px] text-ink-2 mt-1.5">
        <span aria-label="Discontinued: circle">
          <svg width="10" height="10" viewBox="0 0 10 10" className="inline-block mr-1.5">
            <circle cx="5" cy="5" r="3.5" fill="var(--accent-sel)" />
          </svg>
          DISC
        </span>
        <span aria-label="Rare: triangle">
          <svg width="10" height="10" viewBox="0 0 10 10" className="inline-block mr-1.5">
            <polygon points="5,1 9,9 1,9" fill="var(--accent-data)" />
          </svg>
          RARE
        </span>
        <span aria-label="Active: square">
          <svg width="10" height="10" viewBox="0 0 10 10" className="inline-block mr-1.5">
            <rect x="1.5" y="1.5" width="7" height="7" fill="var(--delta-up)" />
          </svg>
          ACTIVE
        </span>
      </div>
    </div>
  )
}
