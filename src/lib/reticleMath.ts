/** Reticle-specific shape. Caller adapts metrics.PricePoint via `Math.floor(new Date(h.date).getTime() / 1000)`. P0-1 audit fix. */
export interface PricePointForReticle {
  time: number   // unix seconds
  price: number
}

export interface Lock {
  time: number   // unix seconds
  price: number
}

export type Verdict = 'HIT' | 'MISS' | 'RICOCHET' | 'INSUFFICIENT_DATA'

export interface VerdictResult {
  verdict: Verdict
  maxPrice: number
  minPrice: number
  maxExcursion: number
}

const STEAM_FEE = 0.15

/**
 * Percentage delta from lockedPrice to currentPrice. Rounded to 1 decimal.
 * Returns null when lockedPrice is 0 (cannot normalize).
 */
export function computeDelta(lockedPrice: number, currentPrice: number): number | null {
  if (lockedPrice === 0) return null
  return Math.round(((currentPrice - lockedPrice) / lockedPrice) * 1000) / 10
}

/**
 * Breakeven price after Steam fees. Prefers metric.breakeven when finite;
 * otherwise applies the 15% Steam-fee formula `lockedPrice / (1 - 0.15)`.
 * Rounded to 2 decimals.
 */
export function computeBreakeven(lockedPrice: number, metricBreakeven: number | null): number {
  if (metricBreakeven !== null && Number.isFinite(metricBreakeven) && metricBreakeven > 0) {
    return metricBreakeven
  }
  const fallback = lockedPrice / (1 - STEAM_FEE)
  return Math.round(fallback * 100) / 100
}

/**
 * HIT/MISS/RICOCHET verdict for a (lockA, lockB) pair against price history.
 *
 * Algorithm:
 * 1. Window = [min(lockA.time, lockB.time), max(...)]
 * 2. Walk history; collect points within window (sorted by time).
 * 3. target = lockB.price.
 * 4. HIT: price reached/exceeded target (up-target) or reached/fell-below target (down-target).
 * 5. RICOCHET: HIT met AND price subsequently reversed past lockA.price.
 * 6. MISS: HIT condition never met within window.
 * 7. INSUFFICIENT_DATA: no history points in window.
 */
export function computeVerdict(input: {
  lockA: Lock
  lockB: Lock
  history: PricePointForReticle[]
}): VerdictResult {
  const { lockA: rawA, lockB: rawB, history } = input
  // Canonicalize so the temporally-earlier lock is treated as the origin (A)
  // and the later one as the target (B). The math is otherwise asymmetric:
  // the target direction (up vs down) flips when A/B are swapped, which
  // would flip HIT into RICOCHET on identical windows. Sniper semantics:
  // the earlier click is where you "took the shot from."
  const [lockA, lockB] = rawA.time <= rawB.time ? [rawA, rawB] : [rawB, rawA]
  const t0 = lockA.time
  const t1 = lockB.time
  // P2-2 audit fix: sort defensively before walking; ricochet detection depends on temporal order.
  const inWindow = history
    .filter((h) => h.time >= t0 && h.time <= t1)
    .sort((a, b) => a.time - b.time)
  if (inWindow.length === 0) {
    return { verdict: 'INSUFFICIENT_DATA', maxPrice: 0, minPrice: 0, maxExcursion: 0 }
  }
  const target = lockB.price
  const isUpTarget = target > lockA.price

  let hit = false
  let ricochet = false
  let maxPrice = -Infinity
  let minPrice = Infinity

  for (const p of inWindow) {
    if (p.price > maxPrice) maxPrice = p.price
    if (p.price < minPrice) minPrice = p.price

    if (isUpTarget && p.price >= target) hit = true
    if (!isUpTarget && p.price <= target) hit = true
    if (hit) {
      if (isUpTarget && p.price < lockA.price) ricochet = true
      if (!isUpTarget && p.price > lockA.price) ricochet = true
    }
  }

  const verdict: Verdict = !hit ? 'MISS' : ricochet ? 'RICOCHET' : 'HIT'
  const excursion = lockA.price === 0 ? 0 : Math.round(((maxPrice - lockA.price) / lockA.price) * 1000) / 10
  return { verdict, maxPrice, minPrice, maxExcursion: excursion }
}
