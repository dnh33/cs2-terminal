import { useMemo, useRef } from 'react'
import { LineSeries, type IChartApi } from 'lightweight-charts'
import { LWChart, resolveToken } from './_shared'
import type { LWChartRef } from './_shared'
import { normalizePoolSeries } from '../../lib/poolIndex'
import type { PoolIndexRawPoint } from '../../lib/poolIndex'

interface PoolIndexProps {
  poolIndex: {
    DISCONTINUED: PoolIndexRawPoint[]
    RARE: PoolIndexRawPoint[]
    ACTIVE: PoolIndexRawPoint[]
  }
  days: number
}

export function PoolIndexChart({ poolIndex, days }: PoolIndexProps) {
  const chartRef = useRef<LWChartRef>(null)
  const normalized = useMemo(() => ({
    DISC: normalizePoolSeries(poolIndex.DISCONTINUED),
    RARE: normalizePoolSeries(poolIndex.RARE),
    ACTIVE: normalizePoolSeries(poolIndex.ACTIVE),
  }), [poolIndex])

  const totalPoints = normalized.DISC.length + normalized.RARE.length + normalized.ACTIVE.length
  if (totalPoints === 0) {
    return (
      <div className="bg-bg-1 border border-line p-4" role="img" aria-label={`${days}-day pool index — insufficient data`}>
        <h2 className="text-[10px] tracking-[0.2em] text-ink-1 font-semibold mb-2.5 m-0">// POOL INDEX × {days}D</h2>
        <div className="h-40 flex items-center justify-center text-ink-3 text-[11px] tracking-[0.15em]">
          // INSUFFICIENT POOL DATA
        </div>
      </div>
    )
  }

  const lastDisc = normalized.DISC[normalized.DISC.length - 1]?.index ?? 100
  const lastRare = normalized.RARE[normalized.RARE.length - 1]?.index ?? 100
  const lastActive = normalized.ACTIVE[normalized.ACTIVE.length - 1]?.index ?? 100
  const summary = `${days}-day pool index. DISC at ${lastDisc.toFixed(1)}, RARE at ${lastRare.toFixed(1)}, ACTIVE at ${lastActive.toFixed(1)}, baseline 100.`

  const onReady = (chart: IChartApi) => {
    // v5 unified API: addSeries(SeriesType, options)
    const seriesDisc   = chart.addSeries(LineSeries, { color: resolveToken('--accent-sel'),  lineWidth: 2, title: 'DISC' })
    const seriesRare   = chart.addSeries(LineSeries, { color: resolveToken('--accent-data'), lineWidth: 2, title: 'RARE' })
    const seriesActive = chart.addSeries(LineSeries, { color: resolveToken('--ink-2'),       lineWidth: 1, title: 'ACTIVE' })

    const toLwc = (s: typeof normalized.DISC) =>
      s.map((p) => ({ time: Math.floor(p.snapshot_at) as import('lightweight-charts').UTCTimestamp, value: p.index }))

    seriesDisc.setData(toLwc(normalized.DISC))
    seriesRare.setData(toLwc(normalized.RARE))
    seriesActive.setData(toLwc(normalized.ACTIVE))
    chart.timeScale().fitContent()
  }

  return (
    <div className="bg-bg-1 border border-line p-4">
      <h2 className="text-[10px] tracking-[0.2em] text-ink-1 font-semibold mb-2.5 m-0">// POOL INDEX × {days}D</h2>
      <LWChart ref={chartRef} height={180} ariaLabel={summary} onReady={onReady} />
      <div className="flex gap-3.5 text-[10px] text-ink-2 mt-1.5 tabular-nums">
        <span><span className="inline-block w-2 h-2 mr-1.5" style={{ background: 'var(--accent-sel)' }} /> DISC {lastDisc.toFixed(1)}</span>
        <span><span className="inline-block w-2 h-2 mr-1.5" style={{ background: 'var(--accent-data)' }} /> RARE {lastRare.toFixed(1)}</span>
        <span><span className="inline-block w-2 h-2 mr-1.5" style={{ background: 'var(--ink-2)' }} /> ACTIVE {lastActive.toFixed(1)}</span>
      </div>
    </div>
  )
}
