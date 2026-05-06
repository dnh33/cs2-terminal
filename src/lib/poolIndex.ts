export interface PoolIndexRawPoint {
  snapshot_at: number
  vwap: number
  contributors: number
}

export interface PoolIndexNormalizedPoint {
  snapshot_at: number
  index: number
}

/**
 * Normalize a pool's VWAP series to first-point = 100.
 * Returns empty array if input is empty or first vwap is 0 (cannot normalize).
 * Rounds to 2 decimal places for stable rendering.
 */
export function normalizePoolSeries(raw: PoolIndexRawPoint[]): PoolIndexNormalizedPoint[] {
  if (raw.length === 0) return []
  const baseline = raw[0].vwap
  if (baseline === 0) return []
  return raw.map((p) => ({
    snapshot_at: p.snapshot_at,
    index: Math.round((p.vwap / baseline) * 100 * 100) / 100,
  }))
}
