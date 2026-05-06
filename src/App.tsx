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
import { ErrorBoundary } from './components/primitives/ErrorBoundary'
import { Banner } from './components/primitives/Banner'
import { CmdK, type CmdKItem } from './components/CmdK'
import { useGlobalKeystroke } from './lib/useGlobalKeystroke'
import { POOL_RANK } from './lib/cases'
import {
  callClaudeStream,
  ANALYST_SYSTEM,
  checkAuth,
  logout,
  fetchMovers,
  getStoredToken,
} from './lib/api'
import type { PricePoint } from './lib/metrics'
import { saveAnalysis, loadAnalysis, saveScan, loadLastScan } from './lib/persist'
import { useSelectedCase } from './lib/useSelectedCase'
import { C } from './lib/theme'
import { computeFit, type FitResult } from './lib/fitScore'
import { fetchItemMedians, type ItemMediansResponse } from './lib/itemMedians'

// Worker URL precedence mirrors src/lib/api.ts so telemetry POST hits the
// same origin as the rest of the API.
declare global {
  interface Window {
    __CS2_CONFIG__?: { workerUrl?: string }
  }
}
const TELEMETRY_WORKER_URL =
  (typeof window !== 'undefined' && window.__CS2_CONFIG__?.workerUrl) ||
  import.meta.env.VITE_WORKER_URL ||
  'http://localhost:8787'

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

  return (
    <ErrorBoundary>
      <AppDashboard onLogout={() => { logout(); setAuth({ status: 'login_required' }) }} />
    </ErrorBoundary>
  )
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

  const [urlSelectedId, setSelectedId] = useSelectedCase()
  // Validate the URL value against the loaded items list. A garbage ?case=
  // value (typo, deleted case, attacker probe) would otherwise trigger
  // fetchHistory + analyzeCase + computeFit on a non-existent ID and
  // pollute caches / fire 4xx history fetches.
  const selectedId = urlSelectedId && items.some(i => i.id === urlSelectedId) ? urlSelectedId : null
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [scan, setScan] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterState>('all')
  const [sort, setSort] = useState<SortState>({ key: 'price', dir: 'desc' })
  // Per-case item-median cache. Populated lazily when a case is selected so
  // we don't fan out 41× /api/items/medians calls on dashboard load.
  const [itemMedians, setItemMedians] = useState<Record<string, ItemMediansResponse>>({})
  const [cmdkOpen, setCmdkOpen] = useState(false)

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

  // Lazy fetch item medians on case selection. Cached per-id so re-selecting a
  // case is free. Failure is swallowed — FIT will compute with empty items[]
  // and unbox_ev_ratio falls back to a neutral score.
  useEffect(() => {
    if (!selectedId || itemMedians[selectedId]) return
    let cancelled = false
    fetchItemMedians(selectedId).then((res) => {
      if (cancelled) return
      setItemMedians(prev => (prev[selectedId] ? prev : { ...prev, [selectedId]: res }))
    }).catch(() => { /* graceful — see comment above */ })
    return () => { cancelled = true }
  }, [selectedId, itemMedians])

  // FIT for every priced case. Single useMemo across all 41 cases is fine at
  // this N (~1ms total per Plan 2 vercel-react-best-practices audit). Drives
  // both the selected case's FIT block and the peers component-distance calc.
  const fitResults = useMemo(() => {
    const now = Math.floor(Date.now() / 1000)
    const out: Record<string, FitResult> = {}
    for (const item of items) {
      if (!item.price || !item.metrics) continue
      const items_for_case = itemMedians[item.id]?.items ?? []
      out[item.id] = computeFit({
        case_: { id: item.id, pool: item.pool, notable: item.notable },
        current: {
          fetched_at: stats?.last_snapshot_at ?? now,
          lowest: item.price.lowest,
          median: item.price.median,
          volume: item.price.volume,
        },
        history: item.history.filter(h => h.source === 'real').map(h => ({
          fetched_at: Math.floor(new Date(h.date).getTime() / 1000),
          lowest: h.price,
          median: null,
          // history endpoint doesn't expose volume in the current shape; v2
          // enriches. Zero is correct-ish for crowding_risk's volZ which uses
          // 30d mean+std anyway.
          volume: 0,
        })),
        items: items_for_case,
        asOf: now,
        poolSize: items.length,
      })
    }
    return out
  }, [items, itemMedians, stats?.last_snapshot_at])

  const fit = selectedId ? fitResults[selectedId] : undefined

  // Peer candidates — every priced case with a FitResult. PeersList itself
  // filters out the target and non-ok statuses, then sorts by Euclidean
  // distance across the six component scores.
  const peerCandidates = useMemo(() => {
    return items.flatMap(it => {
      const r = fitResults[it.id]
      return r ? [{ id: it.id, name: it.name, result: r }] : []
    })
  }, [items, fitResults])

  // Telemetry — fire-and-forget POST to /api/telemetry/fit on every fresh
  // FIT computation for the selected case. Keyed on inputs_hash so we don't
  // re-send when the user re-selects the same case with the same snapshot.
  useEffect(() => {
    if (!fit || fit.status !== 'ok') return
    const token = getStoredToken()
    fetch(`${TELEMETRY_WORKER_URL}/api/telemetry/fit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        case_id: fit.case_id,
        weights_version: fit.weights_version,
        algo_version: fit.algo_version,
        status: fit.status,
        confidence: fit.confidence,
        fit: fit.fit,
        liquidity: fit.components.liquidity.score,
        momentum: fit.components.momentum.score,
        supply: fit.components.supply_tightness.score,
        content: fit.components.content_quality.score,
        unbox_ev: fit.components.unbox_ev_ratio.score,
        crowding: fit.components.crowding_risk.score,
      }),
    }).catch(() => { /* fire-and-forget */ })
  }, [fit?.inputs_hash])  // eslint-disable-line react-hooks/exhaustive-deps

  // Hydrate the scan panel from localStorage on mount so refreshes don't wipe
  // the last market scan a user generated. Errors are swallowed inside persist.
  useEffect(() => {
    const last = loadLastScan()
    if (last) setScan(last.text)
  }, [])

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
    // Cache hit short-circuit: if we've already paid for this exact analysis
    // (same case + same worker snapshot timestamp), serve from localStorage
    // and skip the LLM stream entirely.
    const snapshotKey = stats?.last_snapshot_at ?? 0
    const cached = loadAnalysis(selected.id, snapshotKey)
    if (cached) {
      setAnalysis(cached)
      setAnalyzing(false)
      return
    }
    setAnalysis('')
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
      let full = ''
      await callClaudeStream(
        {
          messages: [{ role: 'user', content: userMsg }],
          system: ANALYST_SYSTEM + '\n\n=== FULL MARKET CONTEXT ===\n' + marketContext,
          // Cache the (large, static) system prompt — saves ~90% on subsequent
          // calls within the cache window when using anthropic/* models.
          cache_system_prompt: true,
        },
        delta => {
          full += delta
          setAnalysis(full)
        },
      )
      // Only persist successful streams. Errors thrown above skip this.
      saveAnalysis(selected.id, snapshotKey, full)
    } catch (e: any) {
      setAnalysisError(e.message)
    } finally {
      setAnalyzing(false)
    }
  }

  async function runScan() {
    setScanning(true)
    setScanError(null)
    setScan('')
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
      let full = ''
      await callClaudeStream(
        {
          messages: [{ role: 'user', content: userMsg }],
          system: ANALYST_SYSTEM + '\n\n=== FULL MARKET CONTEXT ===\n' + enhancedContext,
          cache_system_prompt: true,
          // Market Scan output is identical for identical inputs — cache for 5 min.
          // If a user spams the button, hits 2..N are completely free.
          cache_response_ttl: 300,
        },
        delta => {
          full += delta
          setScan(full)
        },
      )
      // Persist last successful scan so refresh doesn't wipe expensive output.
      saveScan(full)
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

  // Earliest snapshot age (in seconds) across loaded items — feeds MoversPanel
  // 24H gating. T39 added the prop; T33 wires the value. NOTE: prop semantics
  // are seconds (see MoversPanel.tsx:18-19 — "<86400 the 24H window is hidden"),
  // not days. Plan 3 task description said "days" — taking the working
  // unit-of-prop here so the gating actually fires correctly.
  const earliestSnapshotAge = useMemo<number | undefined>(() => {
    const now = Date.now()
    let earliest: number | null = null
    for (const it of items) {
      for (const h of it.history || []) {
        const t = new Date(h.date).getTime()
        if (Number.isFinite(t) && (earliest === null || t < earliest)) earliest = t
      }
    }
    if (earliest === null) return undefined
    return Math.max(0, Math.floor((now - earliest) / 1000))
  }, [items])

  const cmdkItems = useMemo<CmdKItem[]>(() => {
    const caseItems: CmdKItem[] = items.map((it) => ({
      id: `case:${it.id}`,
      section: 'cases',
      label: it.name,
      tier: it.pool,
      meta: it.pool.toUpperCase().slice(0, 4),
    }))
    const panelItems: CmdKItem[] = [
      { id: 'panel:movers', section: 'panels', label: 'Movers' },
      { id: 'panel:scan', section: 'panels', label: 'Market Scan' },
      { id: 'panel:detail', section: 'panels', label: 'Detail' },
    ]
    const actionItems: CmdKItem[] = [
      { id: 'action:scan', section: 'action', label: 'Run Market Scan' },
      { id: 'action:analyze', section: 'action', label: 'Run Analysis on Selected Case' },
      { id: 'action:refresh', section: 'action', label: 'Refresh Feed' },
      { id: 'action:logout', section: 'action', label: 'Sign Out' },
    ]
    const toggleItems: CmdKItem[] = [
      { id: 'toggle:palette', section: 'toggle', label: 'Cycle Palette Mode (STD/AMBER/GREEN)' },
    ]
    return [...caseItems, ...panelItems, ...actionItems, ...toggleItems]
  }, [items])

  function handleCmdKActivate(item: CmdKItem) {
    setCmdkOpen(false)
    if (item.id.startsWith('case:')) {
      setSelectedId(item.id.slice('case:'.length))
      return
    }
    if (item.id === 'panel:movers') {
      document.querySelector('[data-test="movers-panel"]')?.scrollIntoView({ behavior: 'smooth' })
      return
    }
    if (item.id === 'panel:scan') {
      document.querySelector('[data-test="market-scan-panel"]')?.scrollIntoView({ behavior: 'smooth' })
      return
    }
    if (item.id === 'panel:detail') {
      if (selected) document.querySelector('[data-test="detail-panel"]')?.scrollIntoView({ behavior: 'smooth' })
      return
    }
    if (item.id === 'action:scan') { runScan(); return }
    if (item.id === 'action:analyze') { if (selected) analyzeCase(); return }
    if (item.id === 'action:refresh') { fetchAll(true); return }
    if (item.id === 'action:logout') { onLogout(); return }
    if (item.id === 'toggle:palette') {
      const html = document.documentElement
      const cur = html.getAttribute('data-palette') ?? 'std'
      const next = cur === 'std' ? 'amber' : cur === 'amber' ? 'green' : 'std'
      html.setAttribute('data-palette', next)
      try { localStorage.setItem('cs-palette', next) } catch { /* ignore */ }
      return
    }
  }

  useGlobalKeystroke({
    onCmdK: () => setCmdkOpen((o) => !o),
    // onSlash + onEsc wire in T34 + T36 respectively
  })

  return (
    <>
      <SkipLink targetId="main" />
      <div className="min-h-screen flex flex-col">
        <Header fetching={fetching} stats={stats} onLogout={onLogout} onOpenCmdK={() => setCmdkOpen(true)} />
        {hasPrice && <Ticker rows={tickerRows} />}
        {hasPrice && <MarketStats items={items} />}

        <main id="main" className="flex-1">
      {!hasPrice && (
        <div className="px-6 py-10 text-center">
          <div className="max-w-[680px] mx-auto border border-line bg-bg-1 px-8 py-10">
            <div className="font-display text-[36px] tracking-[0.04em] text-accent-sel leading-none">INITIALIZE FEED</div>
            <div className="text-[11px] tracking-[0.2em] text-ink-2 my-3 mb-6">
              // FIRST LOAD — PICK A SOURCE
            </div>
            <div className="text-[13px] text-ink-1 mb-7 leading-[1.7] text-left">
              <strong className="text-accent-data">LIVE MODE</strong> — pulls latest snapshots from your worker. First sweep can take ~30s.
              <br />
              <br />
              Returning visitors auto-hydrate when the worker has data.
            </div>
            <div className="flex gap-3 justify-center items-center flex-wrap">
              <button
                type="button"
                onClick={() => fetchAll(true)}
                disabled={fetching}
                data-variant="primary"
                className="text-[12px] tracking-[0.2em] px-6 py-3.5 bg-accent-sel text-on-accent font-bold disabled:opacity-50"
              >
                {fetching ? '◌ FETCHING...' : '▸ LIVE — STEAM MARKET'}
              </button>
              <button
                type="button"
                onClick={loadDemo}
                className="text-[12px] tracking-[0.2em] px-3 py-2 text-ink-2 hover:text-ink-0 bg-transparent"
              >
                or explore with synthetic data →
              </button>
            </div>
            {fetchError && (
              <Banner
                variant="error"
                className="mt-5"
                action={{ label: '↻ RETRY', onClick: () => fetchAll(true) }}
              >
                Couldn't load market data. {fetchError}
              </Banner>
            )}
          </div>
        </div>
      )}

      {hasPrice && (
        <div className="px-6 py-5">
          <div data-test="market-scan-panel">
            <MarketScanPanel items={items} onScan={runScan} scan={scan} scanning={scanning} error={scanError} />
          </div>

          <div className="mb-4" data-test="movers-panel">
            <MoversPanel onSelect={setSelectedId} earliestSnapshotAge={earliestSnapshotAge} />
          </div>

          <div data-test="chart-row" className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <PoolDistribution items={items} />
            <VolumePriceScatter items={items} onSelect={setSelectedId} selectedId={selectedId} />
          </div>

          <div
            data-test="table-detail-grid"
            className="grid gap-4 mb-4 grid-cols-1 md:grid-cols-[1.4fr_1fr]"
          >
            <CaseTable
              items={filteredSorted}
              selectedId={selectedId}
              onSelect={setSelectedId}
              sort={sort}
              setSort={setSort}
              filter={filter}
              setFilter={setFilter}
              loading={fetching}
            />
            <div data-test="detail-panel" className="bg-bg-1 border border-line">
              <DetailPanel
                item={selected}
                onAnalyze={analyzeCase}
                analysis={analysis}
                analyzing={analyzing}
                error={analysisError}
                fit={fit}
                peers={peerCandidates}
                onSelectPeer={(peerId) => setSelectedId(peerId)}
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
                className="ml-4 text-[9px] tracking-[0.15em] px-2.5 py-1 text-accent-data border border-accent-data bg-transparent"
              >
                {fetching ? '◌ SYNCING...' : '↻ REFRESH FEED'}
              </button>
              {stats?.last_cron && (
                <span className="ml-4 text-ink-3">
                  last cron: {stats.last_cron.succeeded}/{stats.last_cron.succeeded + stats.last_cron.failed} ok
                  {stats.last_cron.error && <span className="text-state-err"> — {stats.last_cron.error}</span>}
                </span>
              )}
            </div>
          )}
        </footer>
      </div>
      <CmdK open={cmdkOpen} onClose={() => setCmdkOpen(false)} items={cmdkItems} onActivate={handleCmdKActivate} />
    </>
  )
}
