import type { ItemMedianRow } from './itemMedians'
import { CASE_CONTENT, contentQuality } from '../data/caseContent'
import { DROP_ODDS_STANDARD, KEY_COST_USD } from '../data/dropOdds'

// ─── Types ─────────────────────────────────────────────────────────────────

export type Pool = 'discontinued' | 'rare' | 'active'

export type FitStatus = 'ok' | 'insufficient_history' | 'low_confidence' | 'stale_data'
export type FitConfidence = 'high' | 'low'

export interface FitComponent {
  raw: number          // pre-normalization signal
  score: number        // 0..100 contribution
}

export interface FitResult {
  case_id: string
  fit: number                          // 0..100 final
  status: FitStatus
  confidence: FitConfidence
  components: {
    liquidity: FitComponent
    momentum: FitComponent
    supply_tightness: FitComponent
    content_quality: FitComponent
    unbox_ev_ratio: FitComponent
    crowding_risk: FitComponent
    catalyst: null
  }
  weights: Record<string, number>
  weights_version: string
  algo_version: string
  inputs_hash: string
  as_of: number
  snapshot_at: number
  pool_size: number
}

export interface CaseInput {
  id: string
  pool: Pool
  notable: string | null   // unused in v1 — content_quality reads CASE_CONTENT instead
}

export interface SnapshotInput {
  fetched_at: number    // unix seconds
  lowest: number
  median: number | null
  volume: number        // 24h volume per Steam Market
  listings?: number     // not exposed by Steam priceoverview today; pass undefined
  sell_price?: number   // estimated upper bid; pass undefined if not available
}

export interface FitInputs {
  case_: CaseInput
  current: SnapshotInput
  history: SnapshotInput[]   // last 30 days, ordered ASC by fetched_at
  items: ItemMedianRow[]      // for unbox_ev_ratio
  asOf: number                // explicit clock — seconds since epoch
  poolSize: number
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function clip(x: number, lo = 0, hi = 100): number {
  if (Number.isNaN(x) || !Number.isFinite(x)) return 0
  return Math.max(lo, Math.min(hi, x))
}

function tanh01(x: number): number {
  return 50 * (1 + Math.tanh(x))
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.floor(q * (sorted.length - 1))
  return sorted[idx]
}

function stdDev(values: number[]): number {
  if (values.length === 0) return 0
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

function withinDays(history: SnapshotInput[], asOfSec: number, days: number): SnapshotInput[] {
  const cutoff = asOfSec - days * 86400
  return history.filter(h => h.fetched_at >= cutoff).sort((a, b) => a.fetched_at - b.fetched_at)
}

// Cheap deterministic hash for inputs_hash. Not crypto — just stable + fast.
function fnv1a(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = (h * 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

// ─── Components ─────────────────────────────────────────────────────────────

function liquidityScore(current: SnapshotInput): number {
  const lowest = current.lowest
  const median_ = current.median ?? lowest
  const sellPrice = current.sell_price ?? median_
  const spread = lowest > 0 ? Math.max(0, (sellPrice - lowest) / median_) : 0.20
  const spreadScore = clip(100 * (1 - spread / 0.20))
  const volScore = clip(100 * Math.log1p(current.volume) / Math.log1p(500))
  return 0.6 * volScore + 0.4 * spreadScore
}

function momentumScore(current: SnapshotInput, history: SnapshotInput[], asOfSec: number): number {
  const h7 = withinDays(history, asOfSec, 7)
  const h30 = withinDays(history, asOfSec, 30)
  const med7 = median(h7.map(h => h.lowest))
  const med30 = median(h30.map(h => h.lowest))
  if (med7 <= 0 || med30 <= 0) return 50
  const r7 = Math.log(current.lowest / med7)
  const r30 = Math.log(current.lowest / med30)
  return tanh01(2.5 * (0.6 * r7 + 0.4 * r30))
}

function supplyTightnessScore(current: SnapshotInput, history: SnapshotInput[], asOfSec: number, pool: Pool): number {
  // Days of supply: only computable if listings is known. Steam priceoverview
  // doesn't expose listings — we fall back to volume-derived proxy.
  const listingsNow = current.listings
  const avgDailyVol = current.volume   // already 24h per Steam
  let dosScore: number
  if (listingsNow !== undefined && avgDailyVol > 0) {
    const dos = listingsNow / avgDailyVol
    dosScore = clip(100 * (1 - dos / 60))
  } else {
    // Volume-only fallback: assume "supply tight" when volume is very low,
    // because no flow = nothing to absorb new buyers.
    dosScore = clip(100 - 100 * Math.log1p(current.volume) / Math.log1p(500))
  }

  // Glut score requires a listings history baseline. With listings unknown,
  // proxy via lowest-vs-30d-median: if price has appreciated, supply has
  // tightened in practice.
  let glutScore = 50
  const h30 = withinDays(history, asOfSec, 30)
  if (h30.length >= 3 && listingsNow === undefined) {
    const listingsP90Proxy = quantile(h30.map(h => h.lowest), 0.9)
    if (listingsP90Proxy > 0) {
      glutScore = clip(100 * (current.lowest / listingsP90Proxy - 1) * 50 + 50)
    }
  }

  // Listings trend (7d): only with listings present.
  let trendScore = 50
  if (listingsNow !== undefined && h30.length >= 7) {
    const sevenAgo = h30.find(h => h.fetched_at >= asOfSec - 7 * 86400)
    const listings7d = sevenAgo?.listings
    if (listings7d && listings7d > 0) {
      const trend = (listingsNow - listings7d) / listings7d
      trendScore = tanh01(-3 * trend)
    }
  }

  let base = 0.5 * dosScore + 0.3 * glutScore + 0.2 * trendScore

  // Pool-aware modifier
  if (pool === 'discontinued' && listingsNow !== undefined && trendScore > 50) {
    base += 20 * ((trendScore - 50) / 50)
  }
  if (pool === 'active') base = base * 0.4

  return clip(base)
}

function unboxEvRatio(current: SnapshotInput, items: ItemMedianRow[]): number {
  if (items.length === 0) return 50
  // Group items by tier from kind (item_high vs item_low — but we need
  // sub-tier breakdown classified vs covert vs special; we approximate by
  // counts since the cron table's high_tier mixes covert/classified/knife).
  // For v1: aggregate high-tier as one bucket weighted by drop_odds.special +
  // .covert + .classified, low-tier weighted by .restricted + .milspec.
  const highMedians = items.filter(i => i.kind === 'item_high' && i.median !== null).map(i => i.median!)
  const lowMedians = items.filter(i => i.kind === 'item_low' && i.median !== null).map(i => i.median!)

  const highOdds = DROP_ODDS_STANDARD.classified + DROP_ODDS_STANDARD.covert + DROP_ODDS_STANDARD.special
  const lowOdds = DROP_ODDS_STANDARD.restricted + DROP_ODDS_STANDARD.milspec

  const highEv = highMedians.length === 0 ? 0 : (highMedians.reduce((s, v) => s + v, 0) / highMedians.length) * highOdds
  const lowEv = lowMedians.length === 0 ? 0 : (lowMedians.reduce((s, v) => s + v, 0) / lowMedians.length) * lowOdds

  const ev = highEv + lowEv - KEY_COST_USD
  if (ev <= 0) return 0   // case is below sum-of-costs — can't compute meaningfully
  const ratio = current.lowest / ev
  return tanh01(-4 * (ratio - 0.7))
}

function crowdingRisk(current: SnapshotInput, history: SnapshotInput[], asOfSec: number): number {
  const h30 = withinDays(history, asOfSec, 30)
  if (h30.length < 5) return 25  // not enough data → mild dampener
  const volMean = h30.reduce((s, h) => s + h.volume, 0) / h30.length
  const volStd = stdDev(h30.map(h => h.volume))
  const volZ = volStd > 0 ? (current.volume - volMean) / volStd : 0
  const med7 = median(withinDays(history, asOfSec, 7).map(h => h.lowest))
  const r7 = med7 > 0 ? Math.log(current.lowest / med7) : 0
  const returns7d = withinDays(history, asOfSec, 7).map(h => h.lowest)
  const retsStd = stdDev(returns7d)
  const priceZ = retsStd > 0 ? r7 / retsStd : 0
  const lowest = current.lowest
  const median_ = current.median ?? lowest
  const spread = lowest > 0 ? Math.max(0, ((current.sell_price ?? median_) - lowest) / median_) : 0.20

  return clip(
    25 * Math.max(0, volZ - 2)
    + 25 * Math.max(0, priceZ - 2)
    + 50 * Math.max(0, 1 - spread / 0.05)
  )
}

// ─── Final formula ─────────────────────────────────────────────────────────

const WEIGHTS_VERSION = 'v1-defaults-2026-05'
const ALGO_VERSION = 'fit-1.0.0'

const POOL_WEIGHTS: Record<Pool, { liq: number; mom: number; sup: number; cnt: number; evr: number; crowd: number }> = {
  discontinued: { liq: 0.10, mom: 0.30, sup: 0.35, cnt: 0.20, evr: 0.05, crowd: 0.30 },
  rare:         { liq: 0.15, mom: 0.25, sup: 0.30, cnt: 0.20, evr: 0.10, crowd: 0.30 },
  active:       { liq: 0.30, mom: 0.30, sup: 0.25, cnt: 0.10, evr: 0.05, crowd: 0.30 },
}

const ACTIVE_HARD_CAP = 55

export function computeFit(inputs: FitInputs): FitResult {
  const { case_, current, history, items, asOf, poolSize } = inputs
  const now = asOf
  const stale = now - current.fetched_at > 7200   // 2h
  const sortedHistory = [...history].sort((a, b) => a.fetched_at - b.fetched_at)
  const earliest = sortedHistory[0]?.fetched_at ?? now
  const days = (now - earliest) / 86400

  // Status / confidence gates
  if (stale) {
    return makeStaleResult(case_, current, now, poolSize)
  }
  if (sortedHistory.length < 7 || days < 7) {
    return makeInsufficientResult(case_, current, now, poolSize)
  }
  const lowConf = days < 30

  // Compute components
  const liquidity = { raw: current.volume, score: clip(liquidityScore(current)) }
  const momentum = { raw: 0, score: clip(momentumScore(current, sortedHistory, now)) }
  const supply_tightness = { raw: 0, score: clip(supplyTightnessScore(current, sortedHistory, now, case_.pool)) }
  const cqRaw = contentQuality(CASE_CONTENT[case_.id] ?? { knife: 0, glove: 0, knife_tier: 0, multi_knife: 0, notable_pattern: 0 })
  const content_quality = { raw: cqRaw, score: cqRaw }
  const unbox_ev_ratio = { raw: 0, score: clip(unboxEvRatio(current, items)) }
  const crowdingRaw = crowdingRisk(current, sortedHistory, now)
  const crowding_risk = { raw: crowdingRaw, score: crowdingRaw }

  // Pool-weighted positives
  const w = POOL_WEIGHTS[case_.pool]
  const positives =
    w.liq * liquidity.score +
    w.mom * momentum.score +
    w.sup * supply_tightness.score +
    w.cnt * content_quality.score +
    w.evr * unbox_ev_ratio.score
  const dampener = 1 - (w.crowd * crowding_risk.score) / 100
  let fit = clip(positives * dampener)

  if (case_.pool === 'active') fit = Math.min(fit, ACTIVE_HARD_CAP)
  if (lowConf) fit = Math.min(fit, 70)

  const weights = { liq: w.liq, mom: w.mom, sup: w.sup, cnt: w.cnt, evr: w.evr, crowd: w.crowd }
  const inputsHash = fnv1a(JSON.stringify({
    cid: case_.id, pool: case_.pool, fit_at: current.fetched_at,
    lowest: current.lowest, median: current.median, volume: current.volume,
    history_n: sortedHistory.length, items_n: items.length, asOf,
  }))

  return {
    case_id: case_.id,
    fit,
    status: 'ok',
    confidence: lowConf ? 'low' : 'high',
    components: { liquidity, momentum, supply_tightness, content_quality, unbox_ev_ratio, crowding_risk, catalyst: null },
    weights,
    weights_version: WEIGHTS_VERSION,
    algo_version: ALGO_VERSION,
    inputs_hash: inputsHash,
    as_of: now,
    snapshot_at: current.fetched_at,
    pool_size: poolSize,
  }
}

function emptyComponents() {
  return {
    liquidity: { raw: 0, score: 0 },
    momentum: { raw: 0, score: 0 },
    supply_tightness: { raw: 0, score: 0 },
    content_quality: { raw: 0, score: 0 },
    unbox_ev_ratio: { raw: 0, score: 0 },
    crowding_risk: { raw: 0, score: 0 },
    catalyst: null,
  } as FitResult['components']
}

function makeStaleResult(case_: CaseInput, current: SnapshotInput, asOf: number, poolSize: number): FitResult {
  return {
    case_id: case_.id, fit: 0, status: 'stale_data', confidence: 'low',
    components: emptyComponents(),
    weights: {}, weights_version: WEIGHTS_VERSION, algo_version: ALGO_VERSION,
    inputs_hash: fnv1a(`stale:${case_.id}:${current.fetched_at}`),
    as_of: asOf, snapshot_at: current.fetched_at, pool_size: poolSize,
  }
}

function makeInsufficientResult(case_: CaseInput, current: SnapshotInput, asOf: number, poolSize: number): FitResult {
  return {
    case_id: case_.id, fit: 0, status: 'insufficient_history', confidence: 'low',
    components: emptyComponents(),
    weights: {}, weights_version: WEIGHTS_VERSION, algo_version: ALGO_VERSION,
    inputs_hash: fnv1a(`insufficient:${case_.id}:${current.fetched_at}`),
    as_of: asOf, snapshot_at: current.fetched_at, pool_size: poolSize,
  }
}
