/**
 * Pool Index VWAP series helper for /movers handler.
 *
 * Computes 3-line (DISCONTINUED / RARE / ACTIVE) volume-weighted average
 * price per pool per snapshot. Min-coverage gate (≥3 contributors) drops
 * single-case proxy noise. Frontend normalizes first-snapshot=100; this
 * function emits raw VWAP only.
 */

export type SnapshotRow = {
  case_id: string
  pool: 'discontinued' | 'rare' | 'active'
  fetched_at: number
  lowest: number | null
  // D1 schema permits NULL volume; treat as zero contributor (skip) so NaN
  // does not propagate through num/denom arithmetic.
  volume: number | null
}

type PoolKey = 'DISCONTINUED' | 'RARE' | 'ACTIVE'

const POOL_KEY_MAP: Record<SnapshotRow['pool'], PoolKey> = {
  discontinued: 'DISCONTINUED',
  rare: 'RARE',
  active: 'ACTIVE',
}

export interface PoolIndexPoint {
  snapshot_at: number
  vwap: number
  contributors: number
}

export interface PoolIndexSeries {
  DISCONTINUED: PoolIndexPoint[]
  RARE: PoolIndexPoint[]
  ACTIVE: PoolIndexPoint[]
}

const MIN_COVERAGE = 3

export function computePoolIndexSeries(rows: SnapshotRow[]): PoolIndexSeries {
  // Group by (snapshot_at, pool) → accumulate (num, denom, contributors)
  const buckets = new Map<string, { num: number; denom: number; contributors: number }>()
  for (const row of rows) {
    if (row.lowest === null) continue
    // Treat NULL volume the same as null lowest: skip BEFORE arithmetic so
    // NaN never enters num/denom and contributors count stays accurate.
    if (row.volume === null) continue
    const key = `${row.fetched_at}|${row.pool}`
    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = { num: 0, denom: 0, contributors: 0 }
      buckets.set(key, bucket)
    }
    bucket.num += row.lowest * row.volume
    bucket.denom += row.volume
    if (row.volume > 0) bucket.contributors += 1
  }

  const out: PoolIndexSeries = { DISCONTINUED: [], RARE: [], ACTIVE: [] }
  for (const [key, bucket] of buckets) {
    if (bucket.contributors < MIN_COVERAGE) continue
    if (bucket.denom === 0) continue
    const [tStr, poolRaw] = key.split('|')
    const poolKey = POOL_KEY_MAP[poolRaw as SnapshotRow['pool']]
    if (!poolKey) continue // P3-3 guard against unexpected pool values
    out[poolKey].push({
      snapshot_at: Number(tStr),
      vwap: bucket.num / bucket.denom,
      contributors: bucket.contributors,
    })
  }
  // Sort each series by snapshot_at ascending
  for (const k of Object.keys(out) as PoolKey[]) {
    out[k].sort((a, b) => a.snapshot_at - b.snapshot_at)
  }
  return out
}
