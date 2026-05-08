import { useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react'
import { flushSync } from 'react-dom'
import { useMarketData } from './hooks/useMarketData'
import { useHypothesisLedger } from './lib/useHypothesisLedger'
import { useCatalystJournal } from './lib/useCatalystJournal'
import { todayLocal, formatShortDate, formatAge } from './lib/dates'
import { filterByItemMap } from './lib/filterByItemMap'
import { Header } from './components/Header'
import { Ticker } from './components/Ticker'
import { MarketStats } from './components/MarketStats'
import { CaseTable } from './components/CaseTable'
import type { SortState, FilterState, ItemFull } from './components/CaseTable'
import { DetailPanel } from './components/DetailPanel'
import { MarketScanPanel, ChatPanel, type ChatPanelHandle } from './components/Panels'
import { Skeleton } from './components/primitives/Skeleton'

// T10: code-split Charts chunk. P0-1 audit fix — lazy each component
// independently (returning {default: {A,B}} fails at render with
// "Element type is invalid"). Vite dedupes the underlying chunk fetch.
const PoolIndexChart    = lazy(() => import('./components/charts/PoolIndexChart').then(m => ({ default: m.PoolIndexChart })))
const VolumePriceScatter = lazy(() => import('./components/charts/VolumePriceScatter').then(m => ({ default: m.VolumePriceScatter })))
import { MoversPanel } from './components/MoversPanel'
import { LoginScreen } from './components/LoginScreen'
import { SkipLink } from './components/primitives/SkipLink'
import { ErrorBoundary } from './components/primitives/ErrorBoundary'
import { Banner } from './components/primitives/Banner'
import { FrameGutter } from './components/primitives/FrameGutter'
import { CmdK, type CmdKItem } from './components/CmdK'
import { useGlobalKeystroke } from './lib/useGlobalKeystroke'
import { POOL_RANK, CASE_DB } from './lib/cases'
import {
  callClaudeStream,
  ANALYST_SYSTEM,
  checkAuth,
  logout,
  fetchMovers,
  fetchCronRecent,
  getStoredToken,
} from './lib/api'
import type { MoversResponse, CronRecentRun } from './lib/api'
import { SystemStatus } from './components/SystemStatus'
import { streamAnalysis, type AnalysisVerdict } from './lib/streamAnalysis'
import { computeDivergence } from './lib/divergence'
import type { PricePoint } from './lib/metrics'
import { saveAnalysis, loadAnalysis, saveScan, loadLastScan } from './lib/persist'
import { useSelectedCase } from './lib/useSelectedCase'
import { C } from './lib/theme'
import { computeFit, type FitResult } from './lib/fitScore'
import { fetchItemMedians, type ItemMediansResponse } from './lib/itemMedians'
import { runResolverPass } from './lib/hypothesisResolverPass'
import { DISPLAYED_MODEL_ID } from './lib/config'

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
// Spec preview route bypasses auth — public showcase of design specs.
// See src/spec/ for showcases. Pathname check happens before any auth probe.
const SpecRoute = lazy(() => import('./spec/HypothesisLedgerShowcase'))

function InspEmptyState({ lastScanAt, onOpenCmdK }: { lastScanAt?: number; onOpenCmdK?: () => void }) {
  const stamp = lastScanAt
    ? `LAST SCAN · ${new Date(lastScanAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : 'NO SCAN YET'
  return (
    <div data-test="insp-empty" className="px-5 py-6">
      <div className="text-[11px] tracking-[0.1em] text-ink-2 tabular-nums">
        {stamp}
      </div>
      <div className="mt-6 space-y-3 font-serif text-[14px] leading-[1.65] text-ink-1">
        <div>
          <button
            type="button"
            onClick={onOpenCmdK}
            className="bg-transparent text-ink-1 hover:text-accent-sel cursor-pointer p-0 m-0 font-serif text-[14px]"
            aria-label="Open command palette to run scan"
          >
            ▸ <kbd className="text-accent-data not-italic">⌘K</kbd> &nbsp; RUN SCAN
          </button>
        </div>
        <div>▸ &nbsp;SELECT FROM TABLE</div>
      </div>
    </div>
  )
}

export default function AppGate() {
  // Public spec-preview route — no auth, no worker calls
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/spec/hypothesis-ledger')) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-bg-0" aria-busy />}>
        <SpecRoute />
      </Suspense>
    )
  }

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
  const { entries: hypotheses } = useHypothesisLedger()
  const { entries: catalystEntries } = useCatalystJournal()

  // Phase 4 Plan 1: Hypothesis Ledger resolver pass — runs once on mount + on
  // visibilitychange→visible. Mounted INSIDE AppDashboard so auth is guaranteed
  // (resolver makes /history calls; outside the auth gate they'd 401-spam).
  useEffect(() => {
    runResolverPass()
    function onVis() {
      if (document.visibilityState === 'visible') runResolverPass()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  const [urlSelectedId, setSelectedIdRaw] = useSelectedCase()
  // P3-T36: track whether the most recent selection came from a CaseChip in
  // the scan output ('scan') vs a direct table/chart/cmdK click ('user'). The
  // DetailPanel renders a "FROM THIS SCAN" pill when source==='scan' so the
  // user has a breadcrumb back to the originating market scan.
  const [lastSelectionSource, setLastSelectionSource] = useState<'user' | 'scan' | null>(null)
  function setSelectedId(id: string | null, source: 'user' | 'scan' = 'user') {
    setLastSelectionSource(id ? source : null)
    setSelectedIdRaw(id)
  }
  // Validate the URL value against the loaded items list. A garbage ?case=
  // value (typo, deleted case, attacker probe) would otherwise trigger
  // fetchHistory + analyzeCase + computeFit on a non-existent ID and
  // pollute caches / fire 4xx history fetches.
  const selectedId = urlSelectedId && items.some(i => i.id === urlSelectedId) ? urlSelectedId : null
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  // P3-T40: structured-analysis verdict (LONG/FLAT/AVOID + confidence). Set
  // by analyzeCase() once the streamed sentinel-tail parses successfully.
  // Cached cache hits keep this null — Plan 4 may re-derive from prose.
  const [verdict, setVerdict] = useState<AnalysisVerdict | null>(null)
  const [scan, setScan] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterState>('all')
  const [sort, setSort] = useState<SortState>({ key: 'price', dir: 'desc' })
  // Per-case item-median cache. Populated lazily when a case is selected so
  // we don't fan out 41× /api/items/medians calls on dashboard load.
  const [itemMedians, setItemMedians] = useState<Record<string, ItemMediansResponse>>({})
  const [cmdkOpen, setCmdkOpen] = useState(false)
  // Phase 4.5 Plan 4 — disclaimer disclosure (collapsed by default)
  const [disclaimerOpen, setDisclaimerOpen] = useState(false)
  // Phase 4.5 Plan 4 — feed staleness for FooterStrip (matches Header threshold:
  // > 2h = STALE; ≤ 2h = FRESH; null = unknown).
  const feedStaleness: 'FRESH' | 'STALE' | '—' = (() => {
    if (!stats?.last_snapshot_at) return '—'
    const ageSec = Math.floor(Date.now() / 1000) - stats.last_snapshot_at
    return ageSec > 7200 ? 'STALE' : 'FRESH'
  })()
  // T8: dedicated App-level state for the PoolIndexChart. We intentionally do
  // NOT hoist MoversPanel's internal `days` state — keeping its fetch loop
  // self-contained minimizes blast radius (its tests, polish tests, and
  // window-pill behavior stay untouched). The chart uses its own 30D window.
  const [moversResponse, setMoversResponse] = useState<MoversResponse | null>(null)
  const moversDays = 30
  // T12 + Plan 5 T4: SystemStatus footer — 3-tier sparkline cluster
  // (case / item-high / item-low), refreshed every 60s. Each tier is fetched
  // independently via Promise.allSettled so one failing tier doesn't stall the
  // others. Per-tier `failX` flags drive the "// ENDPOINT FAIL" muted state.
  const [cronCase, setCronCase] = useState<CronRecentRun[]>([])
  const [cronHi, setCronHi] = useState<CronRecentRun[]>([])
  const [cronLo, setCronLo] = useState<CronRecentRun[]>([])
  const [failCase, setFailCase] = useState(false)
  const [failHi, setFailHi] = useState(false)
  const [failLo, setFailLo] = useState(false)
  useEffect(() => {
    let alive = true
    const tick = async () => {
      const results = await Promise.allSettled([
        fetchCronRecent(24, 'case'),
        fetchCronRecent(24, 'item_high'),
        fetchCronRecent(24, 'item_low'),
      ])
      if (!alive) return
      if (results[0].status === 'fulfilled') { setCronCase(results[0].value.runs); setFailCase(false) }
      else { setFailCase(true) }
      if (results[1].status === 'fulfilled') { setCronHi(results[1].value.runs); setFailHi(false) }
      else { setFailHi(true) }
      if (results[2].status === 'fulfilled') { setCronLo(results[2].value.runs); setFailLo(false) }
      else { setFailLo(true) }
    }
    tick()
    const int = setInterval(tick, 60_000)
    return () => { alive = false; clearInterval(int) }
  }, [])
  useEffect(() => {
    let cancel = false
    fetchMovers(moversDays)
      .then(resp => { if (!cancel) setMoversResponse(resp) })
      .catch(() => { /* chart falls back to empty pool_index */ })
    return () => { cancel = true }
  }, [moversDays])
  // P1-#3 prep: track the snapshot timestamp captured at the most recent
  // successful market scan completion. DetailPanel uses this together with
  // the current `stats.last_snapshot_at` to gate the "from this scan" pill —
  // we only show the pill when the underlying snapshot still matches the
  // scan that produced the chip, otherwise the breadcrumb would lie.
  const [lastScanSnapshotAt, setLastScanSnapshotAt] = useState<number | null>(null)
  // Phase 4.5 Plan 3 — drives INSP empty-state "LAST SCAN · HH:MM" line.
  // Initialized from the same loadLastScan() call already used for scan-text
  // hydration on mount. Distinct from lastScanSnapshotAt (seconds, server
  // snapshot) — this is local Date.now() ms.
  // Invariant: this state and the scan-text rehydration call (later in the
  // file) read the SAME ScanRecord. Both reads observe a single persisted
  // localStorage entry. The setter (in runScan) writes Date.now() right
  // after saveScan(), keeping savedAt and the in-state value in sync.
  const [lastScanSavedAtMs, setLastScanSavedAtMs] = useState<number | null>(() => {
    const last = loadLastScan()
    return last?.savedAt ?? null
  })
  // P2-#5: AbortController shared by analyzeCase / analyzeCaseDevilsAdvocate.
  // Re-runs (button mash, selection change) abort the in-flight request so
  // we don't race two streams into the same setAnalysis().
  const analysisAbortRef = useRef<AbortController | null>(null)
  const chatRef = useRef<ChatPanelHandle>(null)

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
    setVerdict(null)
  }, [selectedId])

  // P2-#5: cancel any in-flight analysis when the selection changes (or the
  // dashboard unmounts). Without this, switching cases mid-stream would let
  // the prior analysis's onProse callback continue racing setAnalysis().
  useEffect(() => {
    return () => {
      analysisAbortRef.current?.abort()
      analysisAbortRef.current = null
    }
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

  // P2-#6: verdict-FIT divergence policy. computeDivergence is pure; cheap
  // memo so DetailPanel can render the "Model Override" / "We don't know"
  // chips without each render recomputing. Returns null until both fit and
  // verdict are available, which keeps the empty-state quiet.
  const divergence = useMemo(() => {
    if (!fit || fit.status !== 'ok' || !verdict) return null
    return computeDivergence(verdict.verdict, verdict.confidence, {
      fit: fit.fit,
      confidence: fit.confidence,
    })
  }, [fit, verdict])

  // Peer candidates — every priced case with a FitResult. PeersList itself
  // filters out the target and non-ok statuses, then sorts by Euclidean
  // distance across the six component scores.
  const peerCandidates = useMemo(() => {
    return items.flatMap(it => {
      const r = fitResults[it.id]
      return r ? [{ id: it.id, name: it.name, result: r }] : []
    })
  }, [items, fitResults])

  // Plan-2 T4: Reticle expects `{id,name,price}` peers, not PeerCandidate.
  // Derive at the App boundary so DetailPanel stays presentational. Picks the
  // 3 priced peers nearest to the selected case by FitResult distance, when
  // a fit is available; otherwise empty (Reticle hides the COMP block).
  const reticlePeers = useMemo(() => {
    if (!fit || fit.status !== 'ok' || !selected) return []
    return peerCandidates
      .filter(c => c.id !== selected.id && c.result.status === 'ok')
      .slice(0, 3)
      .flatMap(c => {
        const peerItem = items.find(i => i.id === c.id)
        const price = peerItem?.price?.lowest
        return typeof price === 'number'
          ? [{ id: c.id, name: c.name, price }]
          : []
      })
  }, [peerCandidates, fit, selected, items])

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
    // P2-#5: abort any prior in-flight analysis stream before kicking a new
    // one off. Mash-protection + clean handoff between regular ↔ devil's
    // advocate paths so they share a single cancel-token contract.
    analysisAbortRef.current?.abort()
    const controller = new AbortController()
    analysisAbortRef.current = controller
    setAnalyzing(true)
    setAnalysisError(null)
    setVerdict(null)
    // Cache hit short-circuit: if we've already paid for this exact analysis
    // (same case + same worker snapshot timestamp), serve from localStorage
    // and skip the LLM stream entirely.
    const snapshotKey = stats?.last_snapshot_at ?? 0
    const cached = loadAnalysis(selected.id, snapshotKey)
    if (cached) {
      setAnalysis(cached)
      setAnalyzing(false)
      // Cached payload (Phase 1 shape) may pre-date the verdict-aware path;
      // verdict stays null. Plan 4 could re-parse cached strings.
      return
    }
    setAnalysis('')
    try {
      const realHistory = (selected.history || []).filter(h => h.source === 'real')
      const historyBlock = formatHistoryBlock(realHistory)
      const fit = fitResults[selected.id]
      const fitContext = fit && fit.status === 'ok'
        ? `\n=== DETERMINISTIC FIT MODEL (do not contradict the math; use as input to your verdict reasoning) ===\n` +
          `liquidity=${Math.round(fit.components.liquidity.score)}, momentum=${Math.round(fit.components.momentum.score)}, ` +
          `supply_tightness=${Math.round(fit.components.supply_tightness.score)}, content_quality=${Math.round(fit.components.content_quality.score)}, ` +
          `unbox_ev_ratio=${Math.round(fit.components.unbox_ev_ratio.score)}, crowding_risk=${Math.round(fit.components.crowding_risk.score)}\n` +
          `Final FIT: ${Math.round(fit.fit)}/100 (confidence: ${fit.confidence})\n`
        : ''

      const userMsg = `Analyze this case as an investment thesis. Cover: valuation read, supply/demand from pool status, comparable cases in the dataset, key risks, and a directional view (LONG / FLAT / AVOID).

When citing trajectory or trend, use ONLY the time-series block below if it has data. If the time-series is sparse or absent, say so plainly — do not fabricate trends.

FOCUS: ${selected.name}
Pool: ${selected.pool}
Released: ${selected.released} (${selected.metrics.ageYears.toFixed(1)}y old)
Lowest: $${selected.price.lowest.toFixed(2)} | Median: $${(selected.price.median || 0).toFixed(2)}
Volume: ${selected.price.volume}
Notable: ${selected.notable}
${fitContext}
=== TIME SERIES (real D1 snapshots, this case only) ===
${historyBlock}`

      let proseAccum = ''
      const result = await streamAnalysis({
        prompt: userMsg,
        system: ANALYST_SYSTEM + '\n\n=== FULL MARKET CONTEXT ===\n' + marketContext,
        // Opts in to the sentinel-injected verdict tail (Worker T28 reads
        // this and prepends the sentinel-instruction system prompt).
        structured: true,
        signal: controller.signal,
        onProse: (delta) => {
          proseAccum += delta
          setAnalysis(proseAccum)
        },
      })

      if (result.verdict) {
        setVerdict(result.verdict)
      }
      // Only persist successful streams (prose only — verdict is in-memory).
      saveAnalysis(selected.id, snapshotKey, proseAccum)
    } catch (e: any) {
      // Aborts are user-initiated (selection change, mash) — swallow silently
      // so a benign cancel doesn't surface as a red error banner.
      if (e?.name !== 'AbortError') setAnalysisError(e.message)
    } finally {
      setAnalyzing(false)
      if (analysisAbortRef.current === controller) analysisAbortRef.current = null
    }
  }

  /**
   * P3-T38: Devil's Advocate — re-run analyzeCase with a flipped framing
   * prompt ("argue the OPPOSITE side"). Cached under a distinct localStorage
   * key so the user can flip back to the regular analysis without losing it.
   */
  async function analyzeCaseDevilsAdvocate() {
    if (!selected || !selected.price || !selected.metrics) return
    // P2-#5 + P2-#7: share the AbortController contract with analyzeCase, and
    // route through streamAnalysis(structured:true) so the contrarian path
    // also produces a verdict — previously the devil's advocate ran via raw
    // callClaudeStream and the verdict couldn't update from the contrarian
    // reasoning, leaving the badge stuck on the prior LONG/AVOID call.
    analysisAbortRef.current?.abort()
    const controller = new AbortController()
    analysisAbortRef.current = controller
    setAnalyzing(true)
    setAnalysisError(null)
    setVerdict(null)
    setAnalysis('')
    try {
      const realHistory = (selected.history || []).filter(h => h.source === 'real')
      const historyBlock = formatHistoryBlock(realHistory)
      const userMsg = `Argue the OPPOSITE side of your default reasoning on this case.
If your instinct is LONG, build the AVOID case. If AVOID, build the LONG case.
Be honest if the contrarian case is weak — say so plainly.

FOCUS: ${selected.name}
Pool: ${selected.pool}
Released: ${selected.released} (${selected.metrics.ageYears.toFixed(1)}y old)
Lowest: $${selected.price.lowest.toFixed(2)} | Median: $${(selected.price.median || 0).toFixed(2)}
Volume: ${selected.price.volume}
Notable: ${selected.notable}

=== TIME SERIES (real D1 snapshots, this case only) ===
${historyBlock}`
      let proseAccum = ''
      const result = await streamAnalysis({
        prompt: userMsg,
        system: ANALYST_SYSTEM + '\n\n=== FULL MARKET CONTEXT ===\n' + marketContext,
        structured: true,
        signal: controller.signal,
        onProse: (delta) => {
          proseAccum += delta
          setAnalysis(proseAccum)
        },
      })
      if (result.verdict) setVerdict(result.verdict)
      // Cache under a distinct key — devil's advocate output ≠ regular analysis
      const snapshotKey = stats?.last_snapshot_at ?? 0
      try { localStorage.setItem(`cs-analysis-devil:v2:${selected.id}:${snapshotKey}`, proseAccum) } catch { /* ignore */ }
    } catch (e: any) {
      if (e?.name !== 'AbortError') setAnalysisError(e.message)
    } finally {
      setAnalyzing(false)
      if (analysisAbortRef.current === controller) analysisAbortRef.current = null
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
        fetchMovers(7).then(r => r.movers).catch(() => []),
        fetchMovers(30).then(r => r.movers).catch(() => []),
        fetchMovers(90).then(r => r.movers).catch(() => []),
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
      // P1-#3: capture the snapshot the scan was computed against. DetailPanel
      // gates the "from this scan" pill on this matching the current
      // stats.last_snapshot_at — once cron rolls forward, the breadcrumb is
      // hidden so we don't claim a stale market scan as the current source.
      setLastScanSnapshotAt(stats?.last_snapshot_at ?? null)
      setLastScanSavedAtMs(Date.now())
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
      // P3-#12: keep this discoverable but inert until a case is picked.
      { id: 'action:analyze', section: 'action', label: 'Run Analysis on Selected Case', disabled: !selectedId },
      { id: 'action:refresh', section: 'action', label: 'Refresh Feed' },
      { id: 'action:logout', section: 'action', label: 'Sign Out' },
    ]
    const toggleItems: CmdKItem[] = [
      { id: 'toggle:palette', section: 'toggle', label: 'Cycle Palette Mode (STD/AMBER/GREEN)' },
    ]
    const validHypotheses = filterByItemMap(
      hypotheses.filter(h => h.resolution === null),
      items,
    )
    const hypothesisItems: CmdKItem[] = validHypotheses
      .slice()
      .sort((a, b) => a.targetDate.localeCompare(b.targetDate))
      .map(h => ({
        id: `hyp:${h.id}`,
        section: 'hypothesis' as const,
        label: `${(CASE_DB.find(c => c.id === h.caseId)?.name ?? h.caseName).toUpperCase()} ${h.comparator === 'gte' ? '≥' : '≤'} $${h.targetPrice.toFixed(2)} by ${h.targetDate}`,
        meta: `PENDING · ${h.confidence}%`,
      }))
    const today = todayLocal()
    const upcomingCatalysts = filterByItemMap(
      catalystEntries.filter(e => e.eventDate >= today),
      items,
    )
    const catalystItems: CmdKItem[] = upcomingCatalysts
      .slice()
      .sort((a, b) => a.eventDate.localeCompare(b.eventDate) || b.createdAt - a.createdAt)
      .map(c => {
        const caseName = (items.find(i => i.id === c.caseId)?.name ?? c.caseId).toUpperCase()
        return {
          id: `catalyst:${c.id}`,
          section: 'catalyst' as const,
          // Bake searchable text into label (no `keywords` mechanism — fuzzyMatch
          // operates on label only). Format: CASE  LABEL.
          label: `${caseName}  ${c.label}`,
          meta: formatShortDate(c.eventDate),
        }
      })
    return [...caseItems, ...panelItems, ...actionItems, ...toggleItems, ...hypothesisItems, ...catalystItems]
  }, [items, selectedId, hypotheses, catalystEntries])

  function handleCmdKActivate(item: CmdKItem) {
    if (item.id.startsWith('hyp:')) {
      const hypId = item.id.slice('hyp:'.length)
      const h = hypotheses.find(x => x.id === hypId)
      if (h) {
        // flushSync forces DetailPanel to commit synchronously for the new
        // selectedId BEFORE the rAF callback runs the scrollIntoView. Avoids
        // the setTimeout(N) race where the target node may not exist yet.
        flushSync(() => { setSelectedId(h.caseId) })
        requestAnimationFrame(() => {
          document.querySelector('[data-test="hypothesis-ledger-section"]')
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
      }
      setCmdkOpen(false)
      return
    }
    if (item.id.startsWith('catalyst:')) {
      const catId = item.id.slice('catalyst:'.length)
      const c = catalystEntries.find(x => x.id === catId)
      if (c) {
        flushSync(() => { setSelectedId(c.caseId) })
        requestAnimationFrame(() => {
          document.querySelector('[data-test="catalyst-journal-section"]')
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
      }
      setCmdkOpen(false)
      return
    }
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
    onSlash: () => chatRef.current?.focusInput(),
    // P1-#2: global Esc handler. CmdK takes priority — if the palette is
    // open, close it. Otherwise blur the focused element (excluding body),
    // mirroring how terminal users expect Esc to "back out" of any field.
    onEsc: () => {
      if (cmdkOpen) {
        setCmdkOpen(false)
        return
      }
      const active = document.activeElement
      if (active instanceof HTMLElement && active !== document.body) active.blur()
    },
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
          {/* WORKSPACE CANVAS — Phase 4.5 Plan 3 — outer flex, hairline borders, sticky INSP.
              Sticky containing block is the viewport scroll context (no overflow ancestor),
              so INSP stays visible past the chat region too — releases visually when the
              page bottom is in view. Practical fit for the synthesis "sticky right-rail" intent. */}
          <div
            data-test="workspace-canvas"
            className="border border-line flex flex-col lg:flex-row"
          >
            {/* LEFT: cols 1-8 (~66.67%) — MKT / CHRT / TBL stacked, hairline-divided */}
            <div className="flex-1 min-w-0 lg:border-r lg:border-line">
              <div data-test="mkt-region" className="flex border-b border-line">
                <FrameGutter number="01" label="MKT" noBorder />
                <div className="flex-1 min-w-0">
                  <div data-test="market-scan-panel">
                    <MarketScanPanel
                      items={items}
                      onScan={runScan}
                      scan={scan}
                      scanning={scanning}
                      error={scanError}
                      onSelectCase={(id) => setSelectedId(id, 'scan')}
                    />
                  </div>
                  <div data-test="movers-panel">
                    <MoversPanel onSelect={setSelectedId} earliestSnapshotAge={earliestSnapshotAge} />
                  </div>
                </div>
              </div>

              <div data-test="chart-region" className="flex border-b border-line">
                <FrameGutter number="03" label="CHRT" noBorder />
                <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-2">
                  <Suspense fallback={<Skeleton width="100%" height={240} />}>
                    <PoolIndexChart
                      poolIndex={moversResponse?.pool_index ?? { DISCONTINUED: [], RARE: [], ACTIVE: [] }}
                      days={moversDays}
                    />
                    <VolumePriceScatter items={items} onSelect={setSelectedId} selectedId={selectedId} />
                  </Suspense>
                </div>
              </div>

              <div data-test="tbl-region" className="flex">
                <FrameGutter number="04" label="TBL" noBorder />
                <div className="flex-1 min-w-0">
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
                </div>
              </div>
            </div>

            {/* RIGHT: cols 9-12 (~33.33%) — INSP, sticky over CHAT */}
            <div
              data-test="insp-region"
              className="lg:w-1/3 lg:shrink-0 lg:sticky lg:top-[var(--header-h)] lg:self-start flex bg-bg-1"
            >
              <FrameGutter number="02" label="INSP" noBorder />
              <div className="flex-1 min-w-0">
                {selected ? (
                  <div data-test="detail-panel">
                    <DetailPanel
                      item={selected}
                      onAnalyze={analyzeCase}
                      analysis={analysis}
                      analyzing={analyzing}
                      error={analysisError}
                      fit={fit}
                      peers={peerCandidates}
                      onSelectPeer={(peerId) => setSelectedId(peerId)}
                      fromScan={lastSelectionSource === 'scan'}
                      onDevilsAdvocate={analyzeCaseDevilsAdvocate}
                      verdict={verdict?.verdict}
                      confidence={verdict?.confidence}
                      divergence={divergence}
                      scanSnapshotAt={lastScanSnapshotAt}
                      currentSnapshotAt={stats?.last_snapshot_at ?? null}
                      reticlePeers={reticlePeers}
                    />
                  </div>
                ) : (
                  <InspEmptyState
                    lastScanAt={lastScanSavedAtMs ?? undefined}
                    onOpenCmdK={() => setCmdkOpen(true)}
                  />
                )}
              </div>
            </div>
          </div>

          {/* CHAT — sibling of workspace-canvas (NOT inside).
              Plan 5 will replace mobile DetailPanel.drawer with route-based detail
              per spec § 1 line 135 — drop detail-mobile + drawer test then. */}
          <div data-test="chat-region" className="flex border border-t-0 border-line">
            <FrameGutter number="05" label="CHAT" noBorder />
            <div className="flex-1 min-w-0">
              <ChatPanel
                ref={chatRef}
                marketContext={marketContext}
                cases={items.map((i) => ({ id: i.id, name: i.name }))}
              />
            </div>
          </div>
        </div>
      )}
        </main>

        {/* 06·STATUS — Phase 4.5 Plan 4 — single-row strip + sparkline cluster */}
        <footer className="border-t border-line">
          {/* Single row: cron-age · ok-count · feed · model · build · disclaimer · refresh */}
          <div data-test="footer-strip" className="px-6 py-2.5 flex items-center gap-3 text-[10px] text-ink-2 tracking-[0.1em] tabular-nums flex-wrap">
            <FrameGutter number="06" label="STATUS" noBorder />
            <span>// last cron {stats?.last_cron ? formatAge(Math.floor(Date.now() / 1000) - stats.last_cron.started_at) : '—'}</span>
            <span className="text-ink-3">·</span>
            <span>{stats?.last_cron ? `${stats.last_cron.succeeded}/${stats.last_cron.succeeded + stats.last_cron.failed} ok` : '—'}</span>
            <span className="text-ink-3">·</span>
            <span data-test="footer-feed-state">
              feed{' '}
              <span style={{ color: feedStaleness === 'FRESH' ? 'var(--accent-data)' : feedStaleness === 'STALE' ? 'var(--state-warn)' : 'var(--ink-3)' }}>
                {feedStaleness}
              </span>
            </span>
            <span className="text-ink-3">·</span>
            <span>model <span className="text-accent-data">{DISPLAYED_MODEL_ID}</span></span>
            <span className="text-ink-3">·</span>
            <span>build <span data-test="footer-build-hash" className="text-ink-1">#{import.meta.env.VITE_BUILD_HASH ?? 'dev'}</span></span>
            <span className="text-ink-3">·</span>
            <button
              type="button"
              data-test="footer-disclaimer-trigger"
              aria-expanded={disclaimerOpen}
              onClick={() => setDisclaimerOpen((v) => !v)}
              className="bg-transparent text-ink-2 hover:text-ink-1 p-0 m-0 cursor-pointer"
            >
              disclaimer {disclaimerOpen ? '▾' : '▸'}
            </button>
            <span className="ml-auto">
              <button
                type="button"
                onClick={() => fetchAll(true)}
                disabled={fetching}
                className="text-[9px] tracking-[0.15em] px-2.5 py-1 text-accent-data border border-accent-data bg-transparent disabled:opacity-50"
              >
                {fetching ? '◌ SYNCING' : '↻ REFRESH'}
              </button>
            </span>
          </div>

          {disclaimerOpen && (
            <div data-test="footer-disclaimer-content" className="px-6 pb-3 text-[10px] text-ink-2 leading-[1.6]">
              Analytical tool, not investment advice. Steam Market prices via your Cloudflare Worker proxy, stored in D1. CS2 case prices are highly speculative; Valve can change drop pool status at any time. Steam takes 15% on resale.
            </div>
          )}

          <div className="px-6 pb-6 text-[10px] text-ink-3 tracking-[0.15em]">
            <div className="mb-1">// CRON × 24</div>
            <SystemStatus
              runsCase={cronCase}
              runsHi={cronHi}
              runsLo={cronLo}
              failCase={failCase}
              failHi={failHi}
              failLo={failLo}
            />
          </div>
        </footer>
      </div>
      <CmdK open={cmdkOpen} onClose={() => setCmdkOpen(false)} items={cmdkItems} onActivate={handleCmdKActivate} />
    </>
  )
}
