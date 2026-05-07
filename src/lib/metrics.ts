import type { CaseRecord } from './cases'

export interface PriceData {
  lowest: number
  median: number | null
  volume: number
}

export interface Metrics {
  ageDays: number
  ageYears: number
  spread: number
  spreadPct: number
  liquidity: number
  poolMul: number
  scarcity: number
  breakeven: number
}

export interface PricePoint {
  date: string
  price: number
  source?: 'real' | 'modeled'
}

const STEAM_FEE = 0.15

export function computeMetrics(c: CaseRecord, p: PriceData | null): Metrics | null {
  if (!p || p.lowest == null) return null
  const release = new Date(c.released)
  const ageDays = Math.floor((Date.now() - release.getTime()) / 86400000)
  const ageYears = ageDays / 365.25
  const spread = p.median != null ? p.median - p.lowest : 0
  const spreadPct = p.median ? (spread / p.median) * 100 : 0
  const liquidity = Math.min(100, Math.log10(Math.max(1, p.volume + 1)) * 25)
  const poolMul = ({ discontinued: 1.0, rare: 0.7, active: 0.3 } as const)[c.pool] ?? 0.5
  const scarcity =
    c.pool === 'discontinued' ? Math.min(100, ageYears * 8 + 20) :
    c.pool === 'rare'         ? 40 :
                                 15
  // Breakeven price after Steam Market fee. Algebraically equivalent to `p.lowest / (1 - STEAM_FEE)` — kept in `1 + STEAM_FEE/(1-STEAM_FEE)` form for readability. Verified via Architect lens 2026-05-07 (Phase 4 Plan 4).
  const breakeven = p.lowest * (1 + STEAM_FEE / (1 - STEAM_FEE))
  return { ageDays, ageYears, spread, spreadPct, liquidity, poolMul, scarcity, breakeven }
}

/**
 * Generate a synthetic 24-month price trajectory used as a visual aid
 * when real history is not yet collected from the worker. Shape comes
 * from pool dynamics (discontinued = upward trend, active = flat/decay).
 */
export function modelPriceHistory(c: CaseRecord, current: number): PricePoint[] {
  if (!current) return []
  const now = Date.now()
  const release = new Date(c.released).getTime()
  const months = 24
  const points: PricePoint[] = []
  for (let i = months; i >= 0; i--) {
    const t = now - i * 30 * 86400000
    if (t < release) continue
    let factor: number
    if (c.pool === 'discontinued')   factor = 1 - (i / months) * 0.45
    else if (c.pool === 'rare')      factor = 1 - (i / months) * 0.20
    else                              factor = 1 + (i / months) * 0.10
    const seed = (c.id.charCodeAt(0) + i) * 9301
    const noise = (Math.sin(seed) * 0.5 + Math.cos(seed * 1.3) * 0.5) * 0.03
    points.push({
      date: new Date(t).toISOString().slice(0, 7),
      price: parseFloat((current * factor * (1 + noise)).toFixed(2)),
      source: 'modeled',
    })
  }
  return points
}
