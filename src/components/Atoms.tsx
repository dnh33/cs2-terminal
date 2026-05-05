import { C } from '../lib/theme'
import type { Pool } from '../lib/cases'

export function StatusDot({ color = C.green, pulse = false }: { color?: string; pulse?: boolean }) {
  return (
    <span
      className={pulse ? 'animate-pulse-orange' : ''}
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: color,
        boxShadow: `0 0 8px ${color}`,
      }}
    />
  )
}

export function PoolBadge({ pool }: { pool: Pool }) {
  const cfg = {
    active:       { color: C.green,  label: 'ACTIVE', bg: 'rgba(74,222,128,0.08)' },
    rare:         { color: C.cyan,   label: 'RARE',   bg: 'rgba(79,209,197,0.08)' },
    discontinued: { color: C.orange, label: 'DISC',   bg: 'rgba(255,116,33,0.1)' },
  }[pool]
  return (
    <span
      className="text-[9px] tracking-[0.15em] font-semibold px-1.5 py-px"
      style={{ color: cfg.color, border: `1px solid ${cfg.color}`, background: cfg.bg }}
    >
      {cfg.label}
    </span>
  )
}

interface SparkProps {
  data: number[] | undefined
  modeled?: boolean
  windowLabel?: string
}

export function MiniSparkline({ data, modeled = false, windowLabel = '' }: SparkProps) {
  if (!data || data.length < 2) return <div className="w-20 h-6 bg-bg-2" aria-hidden="true" />
  const max = Math.max(...data), min = Math.min(...data)
  const range = max - min || 1
  const points = data
    .map((d, i) => `${(i / (data.length - 1)) * 78 + 1},${22 - ((d - min) / range) * 20}`)
    .join(' ')
  const trend = data[data.length - 1] - data[0]
  const pct = data[0] !== 0 ? (trend / data[0]) * 100 : 0
  const trendUp = trend >= 0
  const lineColor = modeled ? C.modeled : trendUp ? C.green : C.red
  const ariaPrefix = modeled ? 'Modeled' : 'Real'
  const dir = trendUp ? 'up' : 'down'
  const ariaLabel = `${ariaPrefix} ${windowLabel || ''} ${dir} ${Math.abs(pct).toFixed(1)}%`.replace(/\s+/g, ' ').trim()
  return (
    <span className="inline-flex items-center gap-1" aria-label={ariaLabel} role="img">
      <svg width="80" height="24" className="block" aria-hidden="true">
        <polyline
          points={points}
          fill="none"
          stroke={lineColor}
          strokeWidth="1.2"
          strokeDasharray={modeled ? '4 2' : undefined}
        />
      </svg>
      <span aria-hidden="true" className="text-[9px]" style={{ color: lineColor }}>
        {trendUp ? '▲' : '▼'}
      </span>
      {modeled && (
        <span aria-hidden="true" className="text-[9px] border px-1" style={{ color: C.modeled, borderColor: C.modeled }}>
          MODEL
        </span>
      )}
    </span>
  )
}
