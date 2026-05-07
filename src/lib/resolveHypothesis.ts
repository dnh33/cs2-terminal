import type { Hypothesis, Resolution } from './useHypothesisLedger'
import type { PricePoint } from './metrics'

/**
 * Pure resolver: filter history to the hypothesis's target_date day,
 * compute MIN/MAX of `lowest`, decide HIT/MISS/STALE.
 *
 * STALE: filter empty (no D1 snapshots for that day).
 * HIT  : (gte && max >= target) || (lte && min <= target). Inclusive boundaries.
 * MISS : otherwise.
 */
export function resolveHypothesis(h: Hypothesis, history: PricePoint[]): Resolution {
  const dayPoints = history.filter(p => p.date === h.targetDate)
  if (dayPoints.length === 0) {
    return { outcome: 'STALE', resolvedAt: Date.now(), resolverVersion: 1, observed: null }
  }
  const prices = dayPoints.map(p => p.price)
  let min = prices[0]
  let max = prices[0]
  for (let i = 1; i < prices.length; i++) {
    if (prices[i] < min) min = prices[i]
    if (prices[i] > max) max = prices[i]
  }
  const hit =
    (h.comparator === 'gte' && max >= h.targetPrice) ||
    (h.comparator === 'lte' && min <= h.targetPrice)
  return {
    outcome: hit ? 'HIT' : 'MISS',
    resolvedAt: Date.now(),
    resolverVersion: 1,
    observed: { min, max, count: dayPoints.length },
  }
}
