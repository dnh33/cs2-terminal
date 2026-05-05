import { useCallback, useEffect, useState } from 'react'
import { CASE_DB, DEMO_PRICES } from '../lib/cases'
import type { CaseRecord } from '../lib/cases'
import { computeMetrics, modelPriceHistory } from '../lib/metrics'
import { fetchLatest, fetchHistory, fetchStats, refreshStale, priceFromLatest } from '../lib/api'
import type { ItemFull } from '../components/CaseTable'
import type { MarketStats } from '../lib/api'

/**
 * Convert a CaseRecord (frontend reference) and worker LatestRow data into
 * a fully-hydrated ItemFull. The frontend keeps the full case database
 * locally so we can render a row even if the worker hasn't seen the case yet.
 */
function hydrate(c: CaseRecord, price: ReturnType<typeof priceFromLatest>): ItemFull {
  if (!price) return { ...c, price: null, metrics: null, history: [] }
  const metrics = computeMetrics(c, price)
  const history = modelPriceHistory(c, price.lowest)
  return { ...c, price, metrics, history }
}

export function useMarketData() {
  const [items, setItems] = useState<ItemFull[]>(
    () => CASE_DB.map(c => hydrate(c, null)),
  )
  const [fetching, setFetching] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [stats, setStats] = useState<MarketStats | null>(null)

  /** Pull latest snapshots from the worker D1, then optionally refresh stale. */
  const fetchAll = useCallback(async (refreshIfStale = true) => {
    setFetching(true)
    setFetchError(null)
    let freshDeployHint: string | null = null
    try {
      // Optionally trigger an on-demand refresh first — only refreshes cases
      // whose latest snapshot is older than 10 min. Cheap if all fresh.
      if (refreshIfStale) {
        try {
          const refreshResult = await refreshStale()
          if (refreshResult.freshDeploy) {
            freshDeployHint = refreshResult.message || 'fresh deploy detected'
          }
        } catch { /* non-fatal */ }
      }

      const [latest, statsData] = await Promise.all([fetchLatest(), fetchStats()])
      setStats(statsData)

      const byId = new Map(latest.map(r => [r.id, r]))
      const next = CASE_DB.map(c => {
        const row = byId.get(c.id)
        const price = row ? priceFromLatest(row) : null
        return hydrate(c, price)
      })
      setItems(next)
      setLastUpdated(new Date())

      const success = next.filter(i => i.price).length
      if (success === 0) {
        setFetchError(
          freshDeployHint
            ? freshDeployHint
            : 'Worker has no price data yet. Run POST /admin/snapshot-now or wait for the cron.'
        )
      }
    } catch (e: any) {
      setFetchError(`Worker unreachable: ${e.message}`)
    } finally {
      setFetching(false)
    }
  }, [])

  /** Replace one case's history chart with real time-series from D1. */
  const loadRealHistory = useCallback(async (caseName: string, days = 30) => {
    try {
      const points = await fetchHistory(caseName, days)
      if (points.length < 2) return
      setItems(prev =>
        prev.map(i => (i.name === caseName ? { ...i, history: points } : i)),
      )
    } catch { /* non-fatal — keep modeled history */ }
  }, [])

  // Auto-hydrate on mount: ask the worker if it has any data; if so, pull it
  // immediately so returning users land on the dashboard instead of the
  // Initialize Feed empty state. fetchAll(false) skips the on-demand stale
  // refresh — the cron handles freshness, this is a cheap read.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const s = await fetchStats()
        if (cancelled) return
        setStats(s)
        if (s?.last_snapshot_at != null) {
          await fetchAll(false)
        }
      } catch (e: any) {
        if (!cancelled) setFetchError(`Worker unreachable: ${e.message}`)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Load synthetic prices for offline exploration. */
  const loadDemo = useCallback(() => {
    const next = CASE_DB.map(c => {
      const dp = DEMO_PRICES[c.id] ?? null
      return hydrate(c, dp)
    })
    setItems(next)
    setLastUpdated(new Date())
    setFetchError(null)
    setStats(null)
  }, [])

  return {
    items,
    fetching,
    lastUpdated,
    fetchError,
    stats,
    fetchAll,
    loadDemo,
    loadRealHistory,
  }
}
