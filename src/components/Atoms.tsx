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
    active:       { color: C.t2,     label: 'ACTIVE', bg: 'transparent' },
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

export function MiniSparkline({ data }: { data: number[] | undefined }) {
  if (!data || data.length < 2) return <div className="w-20 h-6 bg-bg-2" />
  const max = Math.max(...data), min = Math.min(...data)
  const range = max - min || 1
  const points = data
    .map((d, i) => `${(i / (data.length - 1)) * 78 + 1},${22 - ((d - min) / range) * 20}`)
    .join(' ')
  const trend = data[data.length - 1] - data[0]
  const lineColor = trend >= 0 ? C.green : C.red
  return (
    <svg width="80" height="24" className="block">
      <polyline points={points} fill="none" stroke={lineColor} strokeWidth="1.2" />
    </svg>
  )
}
