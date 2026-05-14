export type HistoryPoint = { date: string; price: number }

interface Options {
  breakEven: number
  flatThreshold?: number   // default ±0.02 = ±2%
  drawdownThreshold?: number  // default 0.10 = 10%
}

export function summarizeTrend(points: HistoryPoint[], opts: Options): string {
  if (points.length === 0) return 'no history'
  if (points.length === 1) return 'single observation'

  const flat = opts.flatThreshold ?? 0.02
  const dd = opts.drawdownThreshold ?? 0.10

  const first = points[0]
  const last = points[points.length - 1]
  const pctChange = (last.price - first.price) / first.price

  const days = daysBetween(first.date, last.date)

  const parts: string[] = []
  if (Math.abs(pctChange) <= flat) parts.push('flat')
  else if (pctChange > 0) parts.push(`rising ${Math.round(pctChange * 100)}%`)
  else parts.push(`falling ${Math.round(Math.abs(pctChange) * 100)}%`)

  parts.push(`over ${days} days`)

  // drawdown
  let peak = -Infinity
  let maxDrawdown = 0
  for (const p of points) {
    if (p.price > peak) peak = p.price
    if (peak > 0) {
      const dd0 = (peak - p.price) / peak
      if (dd0 > maxDrawdown) maxDrawdown = dd0
    }
  }
  if (maxDrawdown >= dd) {
    parts.push(`drawdown ${Math.round(maxDrawdown * 100)}%`)
  }

  // breakeven cross
  const startsBelow = first.price < opts.breakEven
  const everCrossesUp =
    startsBelow && points.some((p) => p.price >= opts.breakEven)
  if (everCrossesUp) {
    const crossPoint = points.find((p) => p.price >= opts.breakEven)
    if (crossPoint) parts.push(`breakeven crossed ${crossPoint.date}`)
  }

  return parts.join(', ')
}

export function captionFromHistory(points: HistoryPoint[]): string {
  if (points.length === 0) return '// NO HISTORY'
  const since = points[0].date
  const base = `// SINCE ${since}`
  // Thin-data suffix when the observation span is shorter than 14 days.
  // A short window means we don't have enough temporal depth to trust the
  // shape, regardless of how many samples land inside it.
  const last = points[points.length - 1]
  const span = daysBetween(since, last.date)
  if (span < 14) return `${base} · thin data (${points.length} pts)`
  return base
}

function daysBetween(a: string, b: string): number {
  const dA = new Date(a).getTime()
  const dB = new Date(b).getTime()
  return Math.max(1, Math.round((dB - dA) / (1000 * 60 * 60 * 24)))
}
