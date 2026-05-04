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
    headers: { 'Content-Type': 'application/json' },
  })
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
 * Response is OpenAI-format SSE with one JSON object per chunk:
 *   data: {"choices":[{"delta":{"content":"..."}}]}
 *   data: [DONE]
 */
export async function callClaudeStream(
  req: ChatRequest,
  onChunk: (delta: string) => void,
  signal?: AbortSignal,
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

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // SSE format: events separated by blank line. Each event is `data: <json>`.
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''  // keep the last partial line in the buffer

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const payload = trimmed.slice(5).trim()
      if (payload === '[DONE]') return full
      try {
        const chunk = JSON.parse(payload)
        // Mid-stream error
        if (chunk.error) {
          throw new Error(chunk.error.message || 'stream error')
        }
        const delta = chunk.choices?.[0]?.delta?.content
        if (delta) {
          full += delta
          onChunk(delta)
        }
      } catch (e) {
        // ignore non-JSON keepalive comments (": OPENROUTER PROCESSING")
        if (payload.startsWith(':')) continue
        throw e
      }
    }
  }
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
