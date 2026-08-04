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

const DAY_SECONDS = 86400

export function computePoolIndexSeries(rows: SnapshotRow[]): PoolIndexSeries {
  // Group by (day, pool) → accumulate (num, denom, contributors). Bucketing
  // by exact fetched_at previously produced 600-700+ raw points per line
  // over a 30-day window (cron runs hourly + 3-hourly + twice-daily), which
  // is why the chart looked like noise. Bucketing by day matches the F11
  // history-dedup fix's granularity.
  //
  // contributors is a Set of case_id, not a row count: a single case
  // reporting 24x/day must still count as ONE contributor, otherwise
  // MIN_COVERAGE (meant to require ≥3 distinct cases) would pass on
  // volume from a single case's repeated snapshots.
  const buckets = new Map<string, { num: number; denom: number; contributors: Set<string> }>()
  for (const row of rows) {
    if (row.lowest === null) continue
    // Treat NULL volume the same as null lowest: skip BEFORE arithmetic so
    // NaN never enters num/denom and contributors count stays accurate.
    if (row.volume === null) continue
    const dayBucket = Math.floor(row.fetched_at / DAY_SECONDS) * DAY_SECONDS
    const key = `${dayBucket}|${row.pool}`
    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = { num: 0, denom: 0, contributors: new Set() }
      buckets.set(key, bucket)
    }
    bucket.num += row.lowest * row.volume
    bucket.denom += row.volume
    if (row.volume > 0) bucket.contributors.add(row.case_id)
  }

  const out: PoolIndexSeries = { DISCONTINUED: [], RARE: [], ACTIVE: [] }
  for (const [key, bucket] of buckets) {
    if (bucket.contributors.size < MIN_COVERAGE) continue
    if (bucket.denom === 0) continue
    const [tStr, poolRaw] = key.split('|')
    const poolKey = POOL_KEY_MAP[poolRaw as SnapshotRow['pool']]
    if (!poolKey) continue // P3-3 guard against unexpected pool values
    out[poolKey].push({
      snapshot_at: Number(tStr),
      vwap: bucket.num / bucket.denom,
      contributors: bucket.contributors.size,
    })
  }
  // Sort each series by snapshot_at ascending
  for (const k of Object.keys(out) as PoolKey[]) {
    out[k].sort((a, b) => a.snapshot_at - b.snapshot_at)
  }
  return out
}
