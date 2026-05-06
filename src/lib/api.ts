import type { PriceData, PricePoint } from './metrics'
import type { Pool } from './cases'

// Worker URL precedence:
//   1. window.__CS2_CONFIG__.workerUrl  — runtime config from /config.js
//      (lets you drag-and-drop the same dist/ to any host without rebuilding)
//   2. import.meta.env.VITE_WORKER_URL  — Vite build-time env var
//   3. Localhost fallback                — dev default
declare global {
  interface Window {
    __CS2_CONFIG__?: { workerUrl?: string }
  }
}

const WORKER_URL =
  (typeof window !== 'undefined' && window.__CS2_CONFIG__?.workerUrl) ||
  import.meta.env.VITE_WORKER_URL ||
  'http://localhost:8787'

// ─── types matching worker responses ────────────────────────────────────────

export interface LatestRow {
  id: string
  name: string
  released: string
  pool: Pool
  rare_type: 'Knife' | 'Gloves'
  has_gloves: number
  notable: string | null
  fetched_at: number | null
  lowest: number | null
  median: number | null
  volume: number | null
}

export interface HistoryRow {
  fetched_at: number
  lowest: number | null
  median: number | null
  volume: number | null
}

export interface MoverRow {
  id: string
  name: string
  pool: Pool
  first_price: number
  last_price: number
  last_at: number
  pct_change: number
}

export interface MarketStats {
  cases_tracked: number
  total_cases: number
  total_volume_24h: number
  total_market_cap: number
  last_snapshot_at: number | null
  last_cron: {
    started_at: number
    finished_at: number
    succeeded: number
    failed: number
    error: string | null
  } | null
}

// ─── client ─────────────────────────────────────────────────────────────────

// ─── Auth (single shared password, HMAC session token) ─────────────────────

const TOKEN_KEY = 'cs2-terminal-auth-token'

/**
 * Custom error so the UI can detect "needs login" specifically.
 * The store layer catches this and bumps the user back to the login screen.
 */
export class AuthRequiredError extends Error {
  constructor() {
    super('authentication required')
    this.name = 'AuthRequiredError'
  }
}

export function getStoredToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}

export function setStoredToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch { /* private mode etc. */ }
}

function authHeaders(): Record<string, string> {
  const token = getStoredToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/** Asks the worker whether auth is required and whether our current token is valid. */
export async function checkAuth(): Promise<{ authenticated: boolean; auth_required: boolean }> {
  const res = await fetch(`${WORKER_URL}/auth/me`, { headers: authHeaders() })
  if (!res.ok) {
    // Network error or worker down — let the UI decide what to show.
    throw new Error(`auth check failed: ${res.status}`)
  }
  return res.json()
}

/** Submit the password. On success, store the token and resolve. */
export async function login(password: string): Promise<void> {
  const res = await fetch(`${WORKER_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  if (!res.ok) {
    if (res.status === 401) throw new Error('Wrong password')
    if (res.status === 400) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || 'Login not configured on the worker')
    }
    throw new Error(`Login failed: ${res.status}`)
  }
  const data = await res.json()
  if (!data.token) throw new Error('Worker did not return a token')
  setStoredToken(data.token)
}

export function logout() {
  setStoredToken(null)
}

/**
 * Called when the worker rejects our token mid-session. Wipes the token and
 * fires a window event so AppGate can swap back to the login screen instantly,
 * without waiting for the next route render.
 */
function handleAuthExpired() {
  setStoredToken(null)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cs2-auth-required'))
  }
}

// ─── HTTP helpers (with auth headers + 401 handling) ────────────────────────

async function jsonGet<T>(path: string): Promise<T> {
  const res = await fetch(`${WORKER_URL}${path}`, { headers: authHeaders() })
  if (res.status === 401) {
    handleAuthExpired()
    throw new AuthRequiredError()
  }
  if (!res.ok) throw new Error(`${path} → ${res.status}`)
  return res.json()
}

async function jsonPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${WORKER_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  })
  if (res.status === 401) {
    handleAuthExpired()
    throw new AuthRequiredError()
  }
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${path} → ${res.status}: ${text.slice(0, 180)}`)
  }
  return res.json()
}

/** Fetch latest snapshot for every case. Single round-trip. */
export async function fetchLatest(): Promise<LatestRow[]> {
  const data = await jsonGet<{ cases: LatestRow[] }>('/latest')
  return data.cases
}

/** Fetch full time-series for one case. */
export async function fetchHistory(name: string, days = 30): Promise<PricePoint[]> {
  const data = await jsonGet<{ history: HistoryRow[] }>(
    `/history?name=${encodeURIComponent(name)}&days=${days}`,
  )
  return data.history
    .filter(h => h.lowest != null)
    .map(h => ({
      date: new Date(h.fetched_at * 1000).toISOString().slice(0, 10),
      price: h.lowest as number,
      source: 'real' as const,
    }))
}

/** Fetch top movers in a window. */
export async function fetchMovers(days = 7): Promise<MoverRow[]> {
  const data = await jsonGet<{ movers: MoverRow[] }>(`/movers?days=${days}`)
  return data.movers
}

/** Fetch aggregate market stats. */
export async function fetchStats(): Promise<MarketStats> {
  return jsonGet<MarketStats>('/stats')
}

/** Trigger an on-demand refresh of any stale cases. */
export async function refreshStale(): Promise<{ refreshed: number; failed?: number; attempted?: number; remaining?: number; message?: string; freshDeploy?: boolean }> {
  const res = await fetch(`${WORKER_URL}/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
  })
  if (res.status === 401) {
    handleAuthExpired()
    throw new AuthRequiredError()
  }
  const data = await res.json()
  // 503 = "too many stale, run admin snapshot" — we surface this distinctly
  if (res.status === 503) return { ...data, freshDeploy: true }
  if (!res.ok) throw new Error(`refresh → ${res.status}`)
  return data
}

/** Convert a LatestRow to the PriceData shape used by the metrics module. */
export function priceFromLatest(row: LatestRow): PriceData | null {
  if (row.lowest == null) return null
  return {
    lowest: row.lowest,
    median: row.median,
    volume: row.volume ?? 0,
  }
}

// ─── Claude proxy ───────────────────────────────────────────────────────────

interface ChatRequest {
  messages: { role: 'user' | 'assistant'; content: string }[]
  system: string
  model?: string
  max_completion_tokens?: number
  temperature?: number
  top_p?: number
  seed?: number
  stop?: string[]
  verbosity?: 'low' | 'medium' | 'high' | 'xhigh' | 'max'
  /** Anthropic prompt caching for the system prompt (~90% cost reduction on cache reads). */
  cache_system_prompt?: boolean
  /** OpenRouter response cache TTL in seconds — cache HITS are free. */
  cache_response_ttl?: number
  /**
   * Tells the worker to inject the sentinel-instruction system prompt prefix
   * so Claude appends a [[CASE_SNIPER_VERDICT]] tail with structured JSON.
   * Plan 2 T28 reads this server-side; streamAnalysis (T20) wires it through
   * for the analyze-case path. Other callers leave it false/unset.
   */
  structured?: boolean
}

/** Non-streaming chat completion. */
export async function callClaude(req: ChatRequest): Promise<string> {
  const data = await jsonPost<{ text?: string; error?: string; model?: string; usage?: unknown }>(
    '/chat',
    req,
  )
  if (data.error) throw new Error(data.error)
  return data.text || ''
}

/**
 * Streaming chat completion. Calls onChunk for each delta, returns the final
 * concatenated text. The signal lets the caller cancel mid-stream.
 *
 * Response is OpenAI-format SSE. Default-event records carry one JSON chunk:
 *   data: {"choices":[{"delta":{"content":"..."}}]}
 *   data: [DONE]
 *
 * The Worker may also emit named events (Plan-2 structured contract) at the
 * end of a structured stream, e.g.:
 *   event: validated
 *   data: {"verdict":"LONG","confidence":0.7,...}
 *
 *   event: invalid
 *   data: {"reason":"sentinel_missing"}
 *
 * Parsing follows the WHATWG SSE dispatch model: an `event:` line sets the
 * pending event name; a blank line dispatches the buffered record (default
 * name is "message"); the event name resets to default after dispatch.
 *
 * Default-event records are passed to onChunk as before (callers that don't
 * need named events leave `onEvent` unset and behave unchanged). Named
 * events are surfaced through the optional `onEvent(name, parsedData)`
 * callback — they're parsed as JSON; non-JSON named-event payloads are
 * delivered as a `{ raw: string }` shape so the caller can decide.
 */
export async function callClaudeStream(
  req: ChatRequest,
  onChunk: (delta: string) => void,
  signal?: AbortSignal,
  onEvent?: (name: string, data: unknown) => void,
): Promise<string> {
  const res = await fetch(`${WORKER_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ ...req, stream: true }),
    signal,
  })
  if (res.status === 401) {
    handleAuthExpired()
    throw new AuthRequiredError()
  }
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`/chat → ${res.status}: ${text.slice(0, 180)}`)
  }
  if (!res.body) throw new Error('no response body')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''
  let sawDone = false

  // SSE record state (per WHATWG SSE spec): event name persists across
  // multiple lines until the dispatch boundary (blank line).
  let currentEventName = 'message'
  let dataBuffer = ''
  let hasData = false

  // Dispatch the currently buffered record. Mirrors the spec's
  // "dispatch the event" step: data is the joined buffer (newline-separated
  // for multi-line `data:` fields), event name defaults to "message".
  const dispatch = () => {
    if (!hasData) {
      // blank line with no data → still resets the event name per spec.
      currentEventName = 'message'
      return
    }
    const payload = dataBuffer
    const name = currentEventName
    // Reset for next record BEFORE invoking callbacks so re-entrancy is safe.
    dataBuffer = ''
    hasData = false
    currentEventName = 'message'

    if (name === 'message') {
      if (payload === '[DONE]') { sawDone = true; return }
      try {
        const chunk = JSON.parse(payload)
        if (chunk.error) {
          throw new Error(chunk.error.message || 'stream error')
        }
        const delta = chunk.choices?.[0]?.delta?.content
        if (delta) {
          full += delta
          onChunk(delta)
        }
      } catch (e) {
        // OpenRouter sends ": OPENROUTER PROCESSING" keepalives as comments;
        // those are stripped at the line-parser level and never reach here.
        // Anything else that fails to parse is a real error.
        throw e
      }
    } else {
      // Named event — surface to caller. Try JSON first (worker contract);
      // fall back to raw string for forward-compat.
      if (!onEvent) return
      try {
        onEvent(name, JSON.parse(payload))
      } catch {
        onEvent(name, { raw: payload })
      }
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // SSE line splitting: per spec, lines end with \n, \r, or \r\n. Worker
    // emits \n only, so split on \n is correct. Keep the last partial line
    // in `buffer` for the next chunk.
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const rawLine of lines) {
      // Strip trailing \r (in case of \r\n line endings).
      const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine
      if (line === '') {
        // dispatch boundary
        dispatch()
        if (sawDone) return full
        continue
      }
      // Comment line (per spec: starts with ':') — ignore.
      if (line.startsWith(':')) continue

      // Field parsing: "field" or "field: value" or "field:value".
      const colonIdx = line.indexOf(':')
      let field: string
      let valueRaw: string
      if (colonIdx === -1) {
        field = line
        valueRaw = ''
      } else {
        field = line.slice(0, colonIdx)
        valueRaw = line.slice(colonIdx + 1)
      }
      // Per spec: if value starts with a single space, drop it.
      const value = valueRaw.startsWith(' ') ? valueRaw.slice(1) : valueRaw

      if (field === 'event') {
        currentEventName = value
      } else if (field === 'data') {
        // Per spec: multiple data: lines join with \n.
        dataBuffer = hasData ? `${dataBuffer}\n${value}` : value
        hasData = true
      }
      // other fields (id, retry) are ignored — worker doesn't emit them.
    }
  }
  // Stream ended without an explicit blank-line dispatch for the trailing
  // record. Flush whatever's pending.
  if (hasData) dispatch()
  return full
}

// ─── Embeddings (for semantic search / sqlite-vec) ──────────────────────────

export interface EmbeddingsRequest {
  input: string | string[]
  model?: string
  dimensions?: number
}

export interface EmbeddingsResult {
  model: string
  data: { index: number; embedding: number[] }[]
  usage: unknown
}

export async function fetchEmbeddings(req: EmbeddingsRequest): Promise<EmbeddingsResult> {
  return jsonPost<EmbeddingsResult>('/embeddings', req)
}

// Re-export streamAnalysis types so consumers can import the structured
// analysis surface from the same module they already use for callClaude.
// Implementation lives in ./streamAnalysis to keep api.ts focused on
// transport. Re-export only — no logic change here.
export type {
  AnalysisVerdict,
  ParseError,
  ParsedStream,
  StreamAnalysisOptions,
  StreamAnalysisResult,
} from './streamAnalysis'

export const ANALYST_SYSTEM = `You are a senior CS2 case market analyst. Write like a Bloomberg analyst who plays Counter-Strike — direct, numerate, no hype.

Hard rules:
- Use ONLY data the user provides. Never invent prices, dates, or volumes.
- Cite specific numbers from the dataset.
- Acknowledge uncertainty briefly.
- Skip "I'm an AI" or long disclaimers — one short line at end max.
- Be punchy. Long enough to be useful, short enough to read on a trading screen.

Domain knowledge:
- Active drop pool = ongoing supply = price ceiling. Discontinued cases historically appreciate as supply burns through openings.
- Steam takes 15% on resale. Flips need ~17.65% gross gain to break even.
- Operation cases with knives/gloves historically outperform standard cases.
- Volume = liquidity. Low volume = hard to exit.
- Cases under ~$0.50 face demand suppression because openers prefer trading up.
- "Discontinued pump" pattern: meaningful appreciation 1-3 years after leaving active pool.

Format with terminal headers (//) and tight bullets. Use $ amounts and % changes.`
