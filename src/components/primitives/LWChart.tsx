import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
// LWC v5 imports — verified against official TradingView docs (context7).
import { createChart, CrosshairMode, ColorType } from 'lightweight-charts'
import type { IChartApi, ISeriesApi, DeepPartial, ChartOptions, LineStyle } from 'lightweight-charts'

/** Read a CSS custom property from <html>, trimmed. Returns '' if undeclared. */
export function resolveToken(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function buildChartOptions(): DeepPartial<ChartOptions> {
  // no-hex-disable-next-line — token fallback when CSS var unresolved
  const bg = resolveToken('--bg-1') || '#0a0e14'
  // no-hex-disable-next-line — token fallback when CSS var unresolved
  const text = resolveToken('--ink-1') || '#c5cad1'
  // no-hex-disable-next-line — token fallback when CSS var unresolved
  const line = resolveToken('--line') || '#232932'
  // no-hex-disable-next-line — token fallback when CSS var unresolved
  const accent = resolveToken('--accent-sel') || '#ff7421'
  return {
    layout: {
      // v4+ requires { type: ColorType.Solid, color } shape (verified via official docs).
      background: { type: ColorType.Solid, color: bg },
      textColor: text,
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 10,
    },
    grid: {
      horzLines: { color: line, style: 1 /* LineStyle.Dotted */ },
      vertLines: { visible: false },
    },
    rightPriceScale: { borderColor: line },
    timeScale: { borderColor: line },
    crosshair: {
      mode: CrosshairMode.Normal, // full-axis hairlines that escape the frame
      horzLine: { color: accent, labelBackgroundColor: bg },
      vertLine: { color: accent, labelBackgroundColor: bg },
    },
    handleScroll: true,
    handleScale: true,
  }
}

export interface LWChartRef {
  /** Method (not field) — chart instance only exists after mount-effect runs. P1-2 audit fix. */
  getChart: () => IChartApi | null
  /** Convenience accessor — set by consumer after addSeries(AreaSeries|LineSeries, ...). */
  setMainSeries: (s: ISeriesApi<'Area'> | ISeriesApi<'Line'>) => void
  getMainSeries: () => ISeriesApi<'Area'> | ISeriesApi<'Line'> | null
}

interface Props {
  height: number
  ariaLabel: string
  className?: string
  onReady?: (chart: IChartApi) => void
}

/**
 * React adapter around TradingView Lightweight Charts.
 *
 * Resolves CSS custom properties to literal hex strings (LWC's canvas
 * renderer does NOT parse `var(--*)`). Watches <html data-palette> via
 * MutationObserver to re-skin on palette swaps without remount.
 *
 * Consumers call `onReady(chart)` to add their series + register events.
 */
export const LWChart = forwardRef<LWChartRef, Props>(function LWChart(
  { height, ariaLabel, className, onReady },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const mainSeriesRef = useRef<ISeriesApi<'Area'> | ISeriesApi<'Line'> | null>(null)

  useImperativeHandle(ref, () => ({
    getChart: () => chartRef.current,
    setMainSeries: (s) => { mainSeriesRef.current = s },
    getMainSeries: () => mainSeriesRef.current,
  }), [])

  useEffect(() => {
    if (!containerRef.current) return
    const chart = createChart(containerRef.current, buildChartOptions())
    chartRef.current = chart
    onReady?.(chart)

    const observer = new MutationObserver(() => {
      chart.applyOptions(buildChartOptions())
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-palette'],
    })

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.resize(containerRef.current.clientWidth, height)
      }
    })
    ro.observe(containerRef.current)

    return () => {
      observer.disconnect()
      ro.disconnect()
      chart.remove()
      chartRef.current = null
      mainSeriesRef.current = null
    }
    // height + onReady identities are intentionally stable per parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div role="img" aria-label={ariaLabel} className={className}>
      <div ref={containerRef} style={{ width: '100%', height }} />
    </div>
  )
})
