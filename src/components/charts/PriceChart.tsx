import { useRef, forwardRef, useImperativeHandle } from 'react'
// LWC v5: AreaSeries is a named export passed to chart.addSeries(...)
import { LineSeries, type LineStyle, type IChartApi } from 'lightweight-charts'
import { LWChart, resolveToken, HAIRLINE } from './_shared'
import type { LWChartRef } from './_shared'
import type { ItemFull } from '../CaseTable'
import { summarizeTrend, captionFromHistory } from '../../lib/trend-summary'

export const PriceChart = forwardRef<LWChartRef, { item: ItemFull }>(function PriceChart(
  { item },
  forwardedRef,
) {
  const chartRef = useRef<LWChartRef>(null)

  // Forward the inner LWChart ref so Reticle (DetailPanel sibling) can read
  // the chart instance without piercing the lazy() boundary.
  useImperativeHandle(forwardedRef, () => ({
    getChart: () => chartRef.current?.getChart() ?? null,
    setMainSeries: (s) => chartRef.current?.setMainSeries(s),
    getMainSeries: () => chartRef.current?.getMainSeries() ?? null,
  }), [])

  if (!item || !item.history || item.history.length === 0) {
    return (
      <div className="h-60 flex items-center justify-center text-ink-3 text-[11px] tracking-[0.15em]">
        // NO HISTORICAL DATA
      </div>
    )
  }
  const hasReal = item.history.some(h => h.source === 'real')
  const history = item.history
  // F18: trend-summary supplies shape signal (direction, drawdown, breakeven
  // cross) — replacing the prior "N points, $A to $B" framing that lost the
  // shape of the curve. If the item carries no break-even, pass Infinity so
  // the breakeven-cross branch stays dormant.
  const breakEven = item.metrics?.breakeven ?? Infinity
  const trend = summarizeTrend(history, { breakEven })
  const summary = `Price history for ${item.name}: ${trend}`
  const caption = captionFromHistory(history)

  const onReady = (chart: IChartApi) => {
    const stroke = hasReal ? resolveToken('--accent-data') : resolveToken('--accent-sel')
    // v5 unified API: addSeries(SeriesType, options)
    const series = chart.addSeries(LineSeries, {
      color: stroke,
      lineWidth: HAIRLINE,
      priceLineVisible: false,
      lastValueVisible: false,
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
    })
    chartRef.current?.setMainSeries(series)
    series.setData(item.history.map(h => ({
      time: Math.floor(new Date(h.date).getTime() / 1000) as import('lightweight-charts').UTCTimestamp,
      value: h.price,
    })))
    if (item.metrics?.breakeven) {
      series.createPriceLine({
        price: item.metrics.breakeven,
        color: resolveToken('--accent-data'),
        lineStyle: 2 as LineStyle, // Dashed
        lineWidth: 1,
        axisLabelVisible: true,
        title: 'BE',
      })
    }
    chart.timeScale().fitContent()
    // Series ref retained on adapter; consumer (Reticle) reads via getMainSeries()
  }

  return (
    <>
      <LWChart
        ref={chartRef}
        height={240}
        ariaLabel={summary}
        onReady={onReady}
      />
      {/* F18: off-screen trend summary for screen readers — recovers the shape
          signal (direction, drawdown, breakeven cross) the visual axis omits. */}
      <span className="sr-only">{trend}</span>
      {/* F8: date-anchored caption replaces relative "LAST 7 DAYS" framing and
          flags thin-data windows (< 14 days) honestly. */}
      <div className="mt-2 text-[10px] tracking-[0.15em] text-ink-3 font-mono">
        {caption}
      </div>
    </>
  )
})
