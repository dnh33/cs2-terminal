import { useEffect, useMemo, useState } from 'react'
import { useMarketData } from './hooks/useMarketData'
import { Header } from './components/Header'
import { Ticker } from './components/Ticker'
import { MarketStats } from './components/MarketStats'
import { CaseTable } from './components/CaseTable'
import type { SortState, FilterState, ItemFull } from './components/CaseTable'
import { DetailPanel } from './components/DetailPanel'
import { MarketScanPanel, ChatPanel } from './components/Panels'
import { PoolDistribution, VolumePriceScatter } from './components/Charts'
import { MoversPanel } from './components/MoversPanel'
import { LoginScreen } from './components/LoginScreen'
import { SkipLink } from './components/primitives/SkipLink'
import { POOL_RANK } from './lib/cases'
import {
  callClaude,
  ANALYST_SYSTEM,
  checkAuth,
  logout,
  fetchMovers,
} from './lib/api'
import type { PricePoint } from './lib/metrics'
import { C } from './lib/theme'

function sortValue(item: ItemFull, key: SortState['key']): number | string | undefined {
  switch (key) {
    case 'name':   return item.name
    case 'pool':   return POOL_RANK[item.pool]
    case 'price':  return item.price?.lowest
    case 'median': return item.price?.median ?? undefined
    case 'spread': return item.metrics?.spreadPct
    case 'volume': return item.price?.volume
    case 'age':    return item.metrics?.ageYears
    default:       return undefined
  }
}

type AuthState =
  | { status: 'loading' }
  | { status: 'login_required' }
  | { status: 'authenticated' }
  | { status: 'worker_unreachable'; message: string }

/**
 * Top-level gate. Asks the worker on mount whether auth is required and
 * whether our existing token is valid. Renders LoginScreen or the dashboard
 * accordingly. Listens for AuthRequiredError thrown deep in the API client
 * (e.g. token expired mid-session) and bumps the user back to the login screen.
 */
export default function AppGate() {
  const [auth, setAuth] = useState<AuthState>({ status: 'loading' })

  async function probe() {
    try {
      const result = await checkAuth()
      if (!result.auth_required) setAuth({ status: 'authenticated' })
      else if (result.authenticated) setAuth({ status: 'authenticated' })
      else setAuth({ status: 'login_required' })
    } catch (e) {
      // Worker down, CORS misconfigured, network failure — show a useful state
      // rather than freezing on the loading screen.
      setAuth({
        status: 'worker_unreachable',
        message: e instanceof Error ? e.message : 'unknown error',
      })
    }
  }

  useEffect(() => { probe() }, [])

  // Listen for window-level auth events fired by the API client when a 401
  // comes back mid-session (token expired, secret rotated, etc.)
  useEffect(() => {
    function onUnauthorized() {
      setAuth({ status: 'login_required' })
    }
    window.addEventListener('cs2-auth-required', onUnauthorized)
    return () => window.removeEventListener('cs2-auth-required', onUnauthorized)
  }, [])

  if (auth.status === 'loading') {
    return (
      <div
        className="min-h-screen flex items-center justify-center font-mono text-xs tracking-[0.2em] uppercase"
        style={{ background: C.bg0, color: C.t2 }}
      >
        Connecting to terminal…
      </div>
    )
  }

  if (auth.status === 'worker_unreachable') {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: C.bg0, color: C.t1 }}
      >
        <div className="max-w-md font-mono text-xs space-y-3">
          <div style={{ color: C.red }} className="tracking-[0.2em] uppercase font-bold">
            Worker unreachable
          </div>
          <div style={{ color: C.t2 }}>{auth.message}</div>
          <div style={{ color: C.t3 }} className="text-[10px]">
            Check that the worker URL in <code>config.js</code> is correct and that the
            worker is deployed. Open the browser devtools network tab for details.
          </div>
        </div>
      </div>
    )
  }

  if (auth.status === 'login_required') {
    return <LoginScreen onSuccess={() => setAuth({ status: 'authenticated' })} />
  }

  return <AppDashboard onLogout={() => { logout(); setAuth({ status: 'login_required' }) }} />
}

interface DashboardProps {
  onLogout: () => void
}

/**
 * Build a compact time-series block for one case. Downsamples to ≤30 points
 * so token spend stays bounded even with months of daily snapshots.
 * Format: ISO-date | $price (one per line, oldest first).
 */
function formatHistoryBlock(history: PricePoint[]): string {
  if (!history || history.length === 0) {
    return '(no real time-series available yet — this case only has ≤1 D1 snapshot)'
  }
  const target = 30
  const step = Math.max(1, Math.ceil(history.length / target))
  const sampled = history.filter((_, i) => i % step === 0 || i === history.length - 1)
  return sampled.map(p => `${p.date} | $${p.price.toFixed(2)}`).join('\n')
}

/**
 * Build a compact "% change windows" table for the whole universe by merging
 * the 7d/30d/90d mover snapshots. Cases that didn't accumulate enough history
 * in a window are shown as "—" for that column. Claude is told explicitly not
 * to invent trends for cases that don't appear.
 */
interface MoverLite { name: string; pct_change: number }
function formatDeltaTable(m7: MoverLite[], m30: MoverLite[], m90: MoverLite[]): string {
  const merged = new Map<string, { d7?: number; d30?: number; d90?: number }>()
  for (const r of m7)  (merged.get(r.name) || merged.set(r.name, {}).get(r.name)!).d7  = r.pct_change
  for (const r of m30) (merged.get(r.name) || merged.set(r.name, {}).get(r.name)!).d30 = r.pct_change
  for (const r of m90) (merged.get(r.name) || merged.set(r.name, {}).get(r.name)!).d90 = r.pct_change
  if (merged.size === 0) return '(no time-series Δ available yet — D1 needs ≥2 snapshots per case)'
  const fmt = (v: number | undefined) => v == null ? '   —  ' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
  const lines = ['name | 7d | 30d | 90d']
  for (const [name, d] of merged) lines.push(`${name} | ${fmt(d.d7)} | ${fmt(d.d30)} | ${fmt(d.d90)}`)
  return lines.join('\n')
}

function AppDashboard({ onLogout }: DashboardProps) {
  const { items, fetching, lastUpdated, fetchError, stats, fetchAll, loadDemo, loadRealHistory } = useMarketData()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [scan, setScan] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterState>('all')
  const [sort, setSort] = useState<SortState>({ key: 'price', dir: 'desc' })

  const selected = items.find(i => i.id === selectedId)

  // Load real history when a case is selected
  useEffect(() => {
    if (selected?.name && lastUpdated) {
      loadRealHistory(selected.name, 90)
    }
  }, [selectedId, lastUpdated, selected?.name, loadRealHistory])

  useEffect(() => {
    setAnalysis(null)
    setAnalysisError(null)
  }, [selectedId])

  const filteredSorted = useMemo(() => {
    let arr = [...items]
    if (filter !== 'all') arr = arr.filter(i => i.pool === filter)
    arr.sort((a, b) => {
      const av = sortValue(a, sort.key)
      const bv = sortValue(b, sort.key)
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number)
      return sort.dir === 'desc' ? -cmp : cmp
    })
    return arr
  }, [items, filter, sort])

  const marketContext = useMemo(() => {
    const wp = items.filter(i => i.price)
    if (wp.length === 0) return 'No price data loaded.'
    const lines = [
      `Tracked cases with prices: ${wp.length}/${items.length}`,
      '',
      'Format: name | pool | release | lowest | median | volume | age_years | notable',
    ]
    wp.forEach(i => {
      lines.push(
        `${i.name} | ${i.pool} | ${i.released} | $${i.price!.lowest.toFixed(2)} | $${(i.price!.median || 0).toFixed(2)} | ${i.price!.volume} | ${i.metrics!.ageYears.toFixed(1)}y | ${i.notable}`,
      )
    })
    return lines.join('\n')
  }, [items])

  async function analyzeCase() {
    if (!selected || !selected.price || !selected.metrics) return
    setAnalyzing(true)
    setAnalysisError(null)
    setAnalysis(null)
    try {
      const realHistory = (selected.history || []).filter(h => h.source === 'real')
      const historyBlock = formatHistoryBlock(realHistory)
      const userMsg = `Analyze this case as an investment thesis. Cover: valuation read, supply/demand from pool status, comparable cases in the dataset, key risks, and a directional view (LONG / FLAT / SHORT-AVOID).

When citing trajectory or trend, use ONLY the time-series block below if it has data. If the time-series is sparse or absent, say so plainly — do not fabricate trends.

FOCUS: ${selected.name}
Pool: ${selected.pool}
Released: ${selected.released} (${selected.metrics.ageYears.toFixed(1)}y old)
Lowest: $${selected.price.lowest.toFixed(2)} | Median: $${(selected.price.median || 0).toFixed(2)}
Volume: ${selected.price.volume}
Notable: ${selected.notable}
Special items: ${selected.rare}${selected.hasGloves ? ' (incl. gloves)' : ''}

=== TIME SERIES (real D1 snapshots, this case only) ===
${historyBlock}`
      const reply = await callClaude({
        messages: [{ role: 'user', content: userMsg }],
        system: ANALYST_SYSTEM + '\n\n=== FULL MARKET CONTEXT ===\n' + marketContext,
        // Cache the (large, static) system prompt — saves ~90% on subsequent
        // calls within the cache window when using anthropic/* models.
        cache_system_prompt: true,
      })
      setAnalysis(reply)
    } catch (e: any) {
      setAnalysisError(e.message)
    } finally {
      setAnalyzing(false)
    }
  }

  async function runScan() {
    setScanning(true)
    setScanError(null)
    setScan(null)
    try {
      // Pull % change windows for the whole universe in parallel — gives Claude
      // real time-series signal instead of just "current snapshot" cross-section.
      // Cases with <2 snapshots in a window simply won't appear, that's expected.
      const [m7, m30, m90] = await Promise.all([
        fetchMovers(7).catch(() => []),
        fetchMovers(30).catch(() => []),
        fetchMovers(90).catch(() => []),
      ])
      const deltaContext = formatDeltaTable(m7, m30, m90)
      const enhancedContext = marketContext + '\n\n=== % CHANGE WINDOWS (real Δ from D1) ===\n' + deltaContext
      const userMsg = `Run a full market scan. Produce these sections in order:

// EXECUTIVE READ
2-3 sentences: where is this market right now?

// TOP 3 LONG CANDIDATES
3 cases most attractive to BUY now. For each: name, current price, reasoning.

// TOP 3 AVOID CANDIDATES
3 cases most likely to disappoint. Same format.

// CONTRARIAN EDGE
One non-obvious pattern or mispricing in this dataset.

// CAPITAL ALLOCATION
If $500 to deploy across this universe today, how would you split it? Specific $ amounts and case names.

End with one brief disclaimer line.

When citing momentum, trends, or "movers", use ONLY the % change windows table below. Cases not in the table simply lack the snapshots — never invent trends for them.`
      const reply = await callClaude({
        messages: [{ role: 'user', content: userMsg }],
        system: ANALYST_SYSTEM + '\n\n=== FULL MARKET CONTEXT ===\n' + enhancedContext,
        cache_system_prompt: true,
        // Market Scan output is identical for identical inputs — cache for 5 min.
        // If a user spams the button, hits 2..N are completely free.
        cache_response_ttl: 300,
      })
      setScan(reply)
    } catch (e: any) {
      setScanError(e.message)
    } finally {
      setScanning(false)
    }
  }

  const tickerRows = useMemo(
    () =>
      items
        .filter(i => i.price)
        .map(i => ({
          shortName: i.name
            .replace(' Case', '')
            .replace('Operation ', 'OP-')
            .replace('Weapon Case', 'WC')
            .toUpperCase(),
          price: i.price!.lowest,
          pool: i.pool,
        })),
    [items],
  )

  const hasPrice = items.some(i => i.price)

  return (
    <>
      <SkipLink targetId="main" />
      <div className="min-h-screen flex flex-col">
        <Header fetching={fetching} stats={stats} onLogout={onLogout} />
        {hasPrice && <Ticker rows={tickerRows} />}
        {hasPrice && <MarketStats items={items} />}

        <main id="main" className="flex-1">
      {!hasPrice && (
        <div className="px-6 py-10 text-center">
          <div className="max-w-[680px] mx-auto border border-line bg-bg-1 px-8 py-10">
            <div className="font-display text-[36px] tracking-[0.04em] text-accent-orange leading-none">INITIALIZE FEED</div>
            <div className="text-[11px] tracking-[0.2em] text-ink-2 my-3 mb-6">
              // CHOOSE A DATA SOURCE TO BEGIN MARKET ANALYSIS
            </div>
            <div className="text-[13px] text-ink-1 mb-7 leading-[1.7] text-left">
              <strong className="text-accent-cyan">LIVE MODE</strong> — pulls latest snapshots from your Cloudflare Worker D1 database. The cron writes a fresh row per case every hour; on click, stale cases (&gt;10min old) are refreshed on-demand.
              <br />
              <br />
              <strong className="text-accent-orange">DEMO MODE</strong> — loads a curated synthetic dataset with plausible prices grounded in late-2024 market ranges. Use to explore the terminal if the worker isn't deployed yet.
            </div>
            <div className="flex gap-3 justify-center flex-wrap">
              <button
                onClick={() => fetchAll(true)}
                disabled={fetching}
                className="text-[12px] tracking-[0.2em] px-6 py-3.5 bg-accent-cyan text-bg-0 font-bold disabled:opacity-50"
              >
                {fetching ? '◌ FETCHING...' : '▸ LIVE — STEAM MARKET'}
              </button>
              <button
                onClick={loadDemo}
                className="text-[12px] tracking-[0.2em] px-6 py-3.5 bg-transparent text-accent-orange font-bold border border-accent-orange"
              >
                ▸ DEMO — SYNTHETIC DATA
              </button>
            </div>
            {fetchError && (
              <div className="mt-5 p-3 text-[11px] text-accent-red border border-accent-red bg-accent-red/5 text-left">
                ERR: {fetchError}
              </div>
            )}
          </div>
        </div>
      )}

      {hasPrice && (
        <div className="px-6 py-5">
          <MarketScanPanel items={items} onScan={runScan} scan={scan} scanning={scanning} error={scanError} />

          <div className="mb-4">
            <MoversPanel onSelect={setSelectedId} />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <PoolDistribution items={items} />
            <VolumePriceScatter items={items} onSelect={setSelectedId} selectedId={selectedId} />
          </div>

          <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
            <CaseTable
              items={filteredSorted}
              selectedId={selectedId}
              onSelect={setSelectedId}
              sort={sort}
              setSort={setSort}
              filter={filter}
              setFilter={setFilter}
            />
            <div className="bg-bg-1 border border-line">
              <DetailPanel
                item={selected}
                onAnalyze={analyzeCase}
                analysis={analysis}
                analyzing={analyzing}
                error={analysisError}
              />
            </div>
          </div>

          <ChatPanel marketContext={marketContext} />
        </div>
      )}
        </main>

        <footer className="px-6 pb-6">
          {hasPrice && (
            <div className="mt-5 px-5 py-4 border border-line bg-bg-1 text-[10px] text-ink-2 tracking-[0.05em] leading-[1.6]">
              <strong className="text-ink-1">// DISCLAIMER</strong> — Analytical tool, not investment advice. Steam Market prices via your Cloudflare Worker proxy, stored in D1. CS2 case prices are highly speculative; Valve can change drop pool status at any time. Steam takes 15% on resale.
              <button
                onClick={() => fetchAll(true)}
                disabled={fetching}
                className="ml-4 text-[9px] tracking-[0.15em] px-2.5 py-1 text-accent-cyan border border-accent-cyan bg-transparent"
              >
                {fetching ? '◌ SYNCING...' : '↻ REFRESH FEED'}
              </button>
              {stats?.last_cron && (
                <span className="ml-4 text-ink-3">
                  last cron: {stats.last_cron.succeeded}/{stats.last_cron.succeeded + stats.last_cron.failed} ok
                  {stats.last_cron.error && <span className="text-accent-red"> — {stats.last_cron.error}</span>}
                </span>
              )}
            </div>
          )}
        </footer>
      </div>
    </>
  )
}
