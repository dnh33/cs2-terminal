import { useEffect, useReducer, useRef, useMemo, useState, useLayoutEffect } from 'react'
import type { RefObject } from 'react'
import type { MouseEventParams, Time } from 'lightweight-charts'
import type { LWChartRef } from './primitives/LWChart'
import { reticleReducer, initialState } from './reticleReducer'
import { computeDelta, computeBreakeven, computeVerdict } from '../lib/reticleMath'
import type { PricePointForReticle } from '../lib/reticleMath'
import { isInputFocused } from '../lib/useGlobalKeystroke'
import type { ItemFull } from './CaseTable'

interface Peer { id: string; name: string; price: number }

interface Props {
  item: ItemFull
  chartRef: RefObject<LWChartRef | null>
  peers: Peer[]
}

const VERDICT_COLOR: Record<string, string> = {
  HIT: 'var(--delta-up)',
  MISS: 'var(--delta-dn)',
  RICOCHET: 'var(--state-warn)',
  INSUFFICIENT_DATA: 'var(--ink-3)',
}

export function Reticle({ item, chartRef, peers }: Props) {
  const [store, dispatch] = useReducer(reticleReducer, initialState)
  const overlayRef = useRef<HTMLDivElement>(null)
  const [arcCoords, setArcCoords] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)

  // Reset state on selected case change.
  useEffect(() => {
    dispatch({ type: 'CASE_CHANGE' })
  }, [item.id])

  // Global keystroke handlers — `r` toggle + Esc with capture-phase + stopImmediatePropagation.
  // P0-4 audit fix: stopPropagation does NOT stop sibling window listeners. Capture-phase +
  // stopImmediatePropagation reliably preempts App.tsx's useGlobalKeystroke when in active state.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isInputFocused()) return
      if (e.key === 'r' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        dispatch({ type: 'TOGGLE' })
        return
      }
      if (e.key === 'Escape' && store.state !== 'IDLE') {
        e.stopImmediatePropagation()
        dispatch({ type: 'ESC' })
        return
      }
      // Esc in IDLE: do NOT stop propagation — let App.tsx onEsc cascade handle ⌘K close / chat blur.
    }
    window.addEventListener('keydown', handler, { capture: true })
    return () => window.removeEventListener('keydown', handler, { capture: true })
  }, [store.state])

  // LWC subscriptions when in active states.
  useEffect(() => {
    if (store.state === 'IDLE') return
    const chart = chartRef.current?.getChart()
    if (!chart) return
    const series = chartRef.current?.getMainSeries()
    if (!series) return

    const readPrice = (param: MouseEventParams<Time>): number | null => {
      const data = param.seriesData?.get(series)
      if (!data) return null
      // AreaData/LineData → `value`; bar/candle → `close`. Reticle main series is line/area.
      const value = (data as { value?: number }).value
      return typeof value === 'number' ? value : null
    }

    const onCrosshairMove = (param: MouseEventParams<Time>) => {
      if (param.time == null || param.point == null) {
        dispatch({ type: 'CROSSHAIR_LEAVE' })
        return
      }
      const price = readPrice(param)
      if (price === null) {
        dispatch({ type: 'CROSSHAIR_LEAVE' })
        return
      }
      dispatch({ type: 'CROSSHAIR_MOVE', time: Number(param.time), price })
    }

    const onClick = (param: MouseEventParams<Time>) => {
      if (param.time == null) {
        dispatch({ type: 'CLICK', time: null, price: null })
        return
      }
      dispatch({ type: 'CLICK', time: Number(param.time), price: readPrice(param) })
    }

    chart.subscribeCrosshairMove(onCrosshairMove)
    chart.subscribeClick(onClick)
    return () => {
      chart.unsubscribeCrosshairMove(onCrosshairMove)
      chart.unsubscribeClick(onClick)
    }
  }, [store.state, chartRef])

  // P0-3 audit fix: all useMemo / useState / useLayoutEffect MUST be above early return.
  // P0-1 audit fix: adapt item.history (PricePoint{date}) to PricePointForReticle{time}.
  const reticleHistory = useMemo<PricePointForReticle[]>(
    () => item.history.map((h) => ({
      time: Math.floor(new Date(h.date).getTime() / 1000),
      price: h.price,
    })),
    [item.history],
  )

  const verdictResult = useMemo(() => {
    if (store.state !== 'LOCKED_AB' || !store.lockA || !store.lockB) return null
    return computeVerdict({ lockA: store.lockA, lockB: store.lockB, history: reticleHistory })
  }, [store.state, store.lockA, store.lockB, reticleHistory])

  // Arc SVG coordinate derivation — re-derives on every crosshair move + visible-range change.
  useLayoutEffect(() => {
    if (store.state !== 'LOCKED_AB' || !store.lockA || !store.lockB) {
      setArcCoords(null)
      return
    }
    const chart = chartRef.current?.getChart()
    const series = chartRef.current?.getMainSeries()
    if (!chart || !series) return

    const lockA = store.lockA
    const lockB = store.lockB
    const update = () => {
      const x1 = chart.timeScale().timeToCoordinate(lockA.time as never)
      const x2 = chart.timeScale().timeToCoordinate(lockB.time as never)
      const y1 = series.priceToCoordinate(lockA.price)
      const y2 = series.priceToCoordinate(lockB.price)
      if (x1 !== null && x2 !== null && y1 !== null && y2 !== null) {
        setArcCoords({ x1, y1, x2, y2 })
      } else {
        setArcCoords(null)
      }
    }
    update()
    chart.timeScale().subscribeVisibleTimeRangeChange(update)
    return () => {
      chart.timeScale().unsubscribeVisibleTimeRangeChange(update)
    }
  }, [store.state, store.lockA, store.lockB, chartRef])

  // === EARLY RETURN — must come AFTER all hooks per Rules of Hooks (P0-3) ===
  if (store.state === 'IDLE') return null

  const lockedRef = store.lockA ?? store.crosshair
  const currentPrice = item.price?.lowest ?? 0
  const delta = lockedRef ? computeDelta(lockedRef.price, currentPrice) : null
  const breakeven = lockedRef ? computeBreakeven(lockedRef.price, item.metrics?.breakeven ?? null) : null

  const dateStr = lockedRef ? new Date(lockedRef.time * 1000).toISOString().slice(0, 10) : ''

  return (
    <div ref={overlayRef} className="absolute inset-0 pointer-events-none" data-reticle-overlay>
      {/* TARGET indicator chip */}
      <div
        className="absolute top-2 left-2 text-[10px] tracking-[0.2em] text-accent-sel uppercase font-mono"
        data-reticle-indicator
      >
        ● TARGET
      </div>

      {/* Readout box — top right */}
      {lockedRef && (
        <div
          data-reticle-readout
          className="absolute top-2 right-2 w-[200px] bg-bg-1/95 border border-line p-2 text-[11px] tabular-nums font-mono text-ink-1"
        >
          <div className="text-[9px] tracking-[0.2em] text-ink-3 mb-1">
            {store.state === 'LOCKED_AB' ? 'LOCK A · B' : store.state === 'LOCKED_A' ? 'LOCK A' : 'TARGET'}
          </div>
          <div>LOCK ${lockedRef.price.toFixed(2)} @ {dateStr}</div>
          {delta !== null && (
            <div style={{ color: delta >= 0 ? 'var(--delta-up)' : 'var(--delta-dn)' }}>
              Δ vs NOW {delta >= 0 ? '+' : ''}{delta}%
            </div>
          )}
          {breakeven !== null && <div>BREAKEVEN ${breakeven.toFixed(2)}</div>}
          {peers.length > 0 && (
            <>
              <div className="mt-1 text-[9px] tracking-[0.2em] text-ink-3">COMP</div>
              {peers.slice(0, 3).map((p) => (
                <div key={p.id} className="text-[10px]">· {p.name.slice(0, 14)} ${p.price.toFixed(2)}</div>
              ))}
            </>
          )}
          {verdictResult && verdictResult.verdict !== 'INSUFFICIENT_DATA' && (
            <div className="mt-1 pt-1 border-t border-line">
              <span style={{ color: VERDICT_COLOR[verdictResult.verdict] }}>
                {verdictResult.verdict} {verdictResult.maxExcursion >= 0 ? '+' : ''}{verdictResult.maxExcursion}%
              </span>
            </div>
          )}
        </div>
      )}

      {/* Arc SVG overlay — visible only in LOCKED_AB with valid coords. */}
      {arcCoords && verdictResult && (
        <svg
          data-reticle-arc
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ overflow: 'visible' }}
        >
          {(() => {
            const apexX = (arcCoords.x1 + arcCoords.x2) / 2
            const apexY = Math.min(arcCoords.y1, arcCoords.y2) - 32
            return (
              <>
                <path
                  d={`M ${arcCoords.x1},${arcCoords.y1} Q ${apexX},${apexY} ${arcCoords.x2},${arcCoords.y2}`}
                  stroke={VERDICT_COLOR[verdictResult.verdict]}
                  strokeWidth={2}
                  fill="none"
                />
                <circle cx={arcCoords.x1} cy={arcCoords.y1} r={4} fill="var(--accent-sel)" />
                <circle cx={arcCoords.x2} cy={arcCoords.y2} r={4} fill="var(--accent-sel)" />
              </>
            )
          })()}
        </svg>
      )}
    </div>
  )
}
