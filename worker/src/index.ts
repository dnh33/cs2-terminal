/**
 * CS2 Case Terminal — D1-backed Cloudflare Worker
 *
 * Architecture:
 *   - Cron trigger (default hourly) sweeps Steam Market for all cases,
 *     writing one snapshot row per case per run into D1.
 *   - On-demand /refresh endpoint refreshes any case whose latest snapshot
 *     is older than the freshness threshold.
 *   - Frontend never touches Steam — only reads from D1 via /latest, /history,
 *     /movers, /stats.
 *   - LLM calls go through /chat using the official @openrouter/sdk, so the
 *     API key never reaches the browser and you can swap models with one env var.
 *
 * Endpoints:
 *   GET  /                        Help page
 *   GET  /health                  Cron heartbeat + DB stats
 *   GET  /latest                  Latest snapshot for every case (single query)
 *   GET  /history?name=X&days=30  Time-series for one case
 *   GET  /movers?days=7           Biggest % movers in window
 *   GET  /stats                   Aggregate market stats
 *   GET  /models                  Available OpenRouter models (catalog passthrough)
 *   POST /refresh                 Refresh stale cases on-demand
 *   POST /chat                    LLM call via OpenRouter
 *   POST /admin/snapshot-now      Manually trigger a full sweep (admin token required)
 *   POST /admin/backfill          Pull historical Steam pricehistory data (admin + steam cookie)
 *
 * Cron handler runs `scheduled()` — invoked by Cloudflare on the wrangler.toml
 * cron schedule.
 */

import { OpenRouter } from '@openrouter/sdk'

export interface Env {
  DB: D1Database
  OPENROUTER_API_KEY: string
  OPENROUTER_MODEL: string                            // e.g. "anthropic/claude-sonnet-4.5"
  OPENROUTER_EMBEDDING_MODEL?: string                 // e.g. "openai/text-embedding-3-small"
  OPENROUTER_APP_NAME: string                         // shown on OpenRouter leaderboards
  OPENROUTER_APP_URL: string                          // your deployed frontend URL
  ADMIN_TOKEN: string
  ALLOWED_ORIGIN: string
  STEAM_REQUEST_SPACING_MS: string
  STEAM_LOGIN_COOKIE?: string                         // optional, gates /admin/backfill
  // ─── Password gate (single shared password) ───────────────────────────────
  // PBKDF2 hash of the password, formatted as: <iterations>.<salt_b64>.<hash_b64>
  // Generate with tools/hash-password.html (open it locally in a browser).
  // If unset, the gate is DISABLED and all endpoints are public.
  AUTH_PASSWORD_HASH?: string
  // HMAC key used to sign session tokens. Any random string ≥32 chars.
  // Generate with: openssl rand -hex 32
  // (or any online random-string generator, or just type 64 random characters)
  AUTH_SESSION_SECRET?: string
}

interface SteamPriceResponse {
  success?: boolean
  lowest_price?: string
  median_price?: string
  volume?: string
}

interface ChatRequest {
  messages: { role: 'user' | 'assistant'; content: string }[]
  system: string
  /** Per-request model override; falls back to env OPENROUTER_MODEL. */
  model?: string
  /**
   * Maximum tokens to generate. The hard ceiling is (context_length - prompt_length)
   * for the chosen model — there is no fixed numeric cap. Omit to let the model
   * generate up to its own remaining context budget.
   */
  max_completion_tokens?: number
  /** 0–2, default 1. Lower = more deterministic; 0 = greedy. */
  temperature?: number
  /** 0–1, default 1. Nucleus sampling. Lower = more focused. */
  top_p?: number
  /** Deterministic outputs across runs when supported by the provider. */
  seed?: number
  /** Up to 4 stop sequences. */
  stop?: string[]
  /** Force structured output. {type:'json_object'} or json_schema for strict schemas. */
  response_format?: { type: 'json_object' } | { type: 'json_schema'; json_schema: unknown }
  /**
   * Anthropic / OpenAI Responses API only: low | medium | high | xhigh | max.
   * Controls how concise vs detailed the response is. Maps to Anthropic's `effort`.
   */
  verbosity?: 'low' | 'medium' | 'high' | 'xhigh' | 'max'
  /** Stream the response token-by-token. Returns an SSE response from the worker. */
  stream?: boolean
  /**
   * Anthropic prompt caching breakpoint. Enables ~90% cost reduction on cache reads
   * for the static prefix (our system prompt + market dataset).
   * Only applied when the chosen model is anthropic/* — silently ignored otherwise.
   */
  cache_system_prompt?: boolean
  /**
   * Set X-OpenRouter-Cache headers to enable OpenRouter response caching.
   * Cache HITS are completely free (no tokens billed). Best for repeated
   * identical requests like the Market Scan endpoint.
   */
  cache_response_ttl?: number          // seconds, 1–86400
}

const STALE_THRESHOLD_SECONDS = 600              // refresh on-demand if >10min old
const STEAM_RATE_LIMIT_BACKOFF_MS = 60_000        // wait on 429
const FETCH_TIMEOUT_MS = 12_000

// ─── helpers ────────────────────────────────────────────────────────────────

function corsHeaders(env: Env): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token, Authorization, X-Auth-Token',
    'Access-Control-Max-Age': '86400',
  }
}

function jsonResponse(body: unknown, env: Env, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(env), 'Content-Type': 'application/json' },
  })
}

function parsePrice(s: string | undefined | null): number | null {
  if (!s) return null
  const m = String(s).match(/[\d,]+\.?\d*/)
  if (!m) return null
  return parseFloat(m[0].replace(/,/g, ''))
}

function parseVolume(s: string | undefined | null): number {
  if (!s) return 0
  return parseInt(String(s).replace(/,/g, ''), 10) || 0
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ─── steam fetch ────────────────────────────────────────────────────────────

interface FetchResult {
  ok: boolean
  status: 'success' | 'rate_limited' | 'no_data' | 'error'
  lowest?: number | null
  median?: number | null
  volume?: number
  error?: string
}

async function fetchSteamPrice(name: string): Promise<FetchResult> {
  const url = `https://steamcommunity.com/market/priceoverview/?country=US&currency=1&appid=730&market_hash_name=${encodeURIComponent(name)}`
  const ctrl = new AbortController()
  const tid = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 CaseTerminal/1.0',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })

    if (res.status === 429) return { ok: false, status: 'rate_limited' }
    if (!res.ok) return { ok: false, status: 'error', error: `http ${res.status}` }

    const data: SteamPriceResponse = await res.json()
    if (!data.success) return { ok: false, status: 'no_data' }

    const lowest = parsePrice(data.lowest_price)
    if (lowest == null) return { ok: false, status: 'no_data' }

    return {
      ok: true,
      status: 'success',
      lowest,
      median: parsePrice(data.median_price),
      volume: parseVolume(data.volume),
    }
  } catch (e: any) {
    return { ok: false, status: 'error', error: e.message || 'fetch failed' }
  } finally {
    clearTimeout(tid)
  }
}

// ─── sweep ──────────────────────────────────────────────────────────────────

interface SweepOptions {
  caseFilter?: string[]      // limit to these case ids (for /refresh)
  spacingMs?: number
}

interface SweepResult {
  succeeded: number
  failed: number
  rateLimited: boolean
}

/**
 * Fetch every case (or a filtered subset), spacing requests to respect
 * Steam's rate limit, and write snapshots to D1.
 */
async function sweep(env: Env, opts: SweepOptions = {}): Promise<SweepResult> {
  const spacing = opts.spacingMs ?? parseInt(env.STEAM_REQUEST_SPACING_MS, 10) ?? 4000

  // Pull case list from D1 (single source of truth)
  const where = opts.caseFilter && opts.caseFilter.length > 0
    ? `WHERE id IN (${opts.caseFilter.map(() => '?').join(',')})`
    : ''
  const caseRows = await env.DB
    .prepare(`SELECT id, name FROM cases ${where} ORDER BY name`)
    .bind(...(opts.caseFilter ?? []))
    .all<{ id: string; name: string }>()

  const cases = caseRows.results || []
  if (cases.length === 0) return { succeeded: 0, failed: 0, rateLimited: false }

  const now = Math.floor(Date.now() / 1000)
  let succeeded = 0
  let failed = 0
  let rateLimited = false

  // Batch inserts for efficiency — D1 handles bound statements well
  const inserts: Promise<unknown>[] = []

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i]
    const result = await fetchSteamPrice(c.name)

    if (result.status === 'rate_limited') {
      rateLimited = true
      console.warn(`[sweep] 429 on ${c.name}, backing off ${STEAM_RATE_LIMIT_BACKOFF_MS}ms`)
      await sleep(STEAM_RATE_LIMIT_BACKOFF_MS)
      // retry once
      const retry = await fetchSteamPrice(c.name)
      if (retry.ok) {
        inserts.push(insertSnapshot(env, c.id, now, retry))
        succeeded++
      } else {
        failed++
      }
    } else if (result.ok) {
      inserts.push(insertSnapshot(env, c.id, now, result))
      succeeded++
    } else {
      console.warn(`[sweep] ${c.name}: ${result.status} ${result.error || ''}`)
      failed++
    }

    // Spacing between requests (skip on the last one)
    if (i < cases.length - 1) await sleep(spacing)
  }

  await Promise.all(inserts)
  return { succeeded, failed, rateLimited }
}

function insertSnapshot(env: Env, caseId: string, fetchedAt: number, r: FetchResult) {
  return env.DB
    .prepare(
      `INSERT OR REPLACE INTO price_snapshots (case_id, fetched_at, lowest, median, volume)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(caseId, fetchedAt, r.lowest ?? null, r.median ?? null, r.volume ?? 0)
    .run()
}

// ─── historical backfill (Steam pricehistory endpoint, requires login cookie) ─

interface HistoryPoint {
  fetched_at: number   // unix seconds
  price: number
  volume: number
}

/**
 * Parse Steam's date format from pricehistory responses.
 * Format: "MMM DD YYYY HH: +0" e.g. "Sep 19 2013 01: +0"
 */
function parseSteamDate(s: string): number {
  const m = s.match(/^(\w{3})\s+(\d{1,2})\s+(\d{4})\s+(\d{1,2}):/)
  if (!m) return 0
  const [, mon, day, year, hour] = m
  const d = new Date(`${mon} ${day} ${year} ${hour}:00:00 UTC`)
  const ts = Math.floor(d.getTime() / 1000)
  return isNaN(ts) ? 0 : ts
}

/**
 * Fetch the full price history for one case from Steam's pricehistory endpoint.
 * Requires a valid steamLoginSecure cookie. Returns null on auth failure or
 * malformed response.
 */
async function fetchSteamPriceHistory(name: string, cookie: string): Promise<HistoryPoint[] | null> {
  const url = `https://steamcommunity.com/market/pricehistory/?country=US&currency=1&appid=730&market_hash_name=${encodeURIComponent(name)}`
  const ctrl = new AbortController()
  const tid = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 CaseTerminal/1.0',
        'Accept': 'application/json',
        'Cookie': `steamLoginSecure=${cookie}`,
      },
    })
    if (res.status === 401 || res.status === 403) {
      console.warn(`[backfill] auth failure on ${name} (${res.status}) — cookie may be expired`)
      return null
    }
    if (!res.ok) return null
    const data: { success?: boolean; prices?: [string, number, string][] } = await res.json()
    if (!data.success || !Array.isArray(data.prices)) return null
    return data.prices
      .map(([dateStr, price, volStr]): HistoryPoint => ({
        fetched_at: parseSteamDate(dateStr),
        price: typeof price === 'number' ? price : parseFloat(String(price)) || 0,
        volume: parseInt(String(volStr), 10) || 0,
      }))
      .filter(p => p.fetched_at > 0 && p.price > 0)
  } catch (e: any) {
    console.warn(`[backfill] ${name}: fetch error ${e.message}`)
    return null
  } finally {
    clearTimeout(tid)
  }
}

interface BackfillResult {
  cases_processed: number
  rows_inserted: number
  failed: number
  remaining: number
  auth_failed: boolean
}

/**
 * Process up to N cases that haven't been backfilled yet. Pulls full Steam
 * price history (auth'd) and inserts via INSERT OR IGNORE so re-runs are safe.
 */
async function runBackfill(env: Env, limit: number): Promise<BackfillResult> {
  if (!env.STEAM_LOGIN_COOKIE) {
    return { cases_processed: 0, rows_inserted: 0, failed: 0, remaining: 0, auth_failed: true }
  }

  // Pick cases that haven't been backfilled yet
  const pending = await env.DB
    .prepare(`SELECT id, name FROM cases WHERE backfilled_at IS NULL ORDER BY released ASC LIMIT ?`)
    .bind(limit)
    .all<{ id: string; name: string }>()
  const cases = pending.results || []

  if (cases.length === 0) {
    return { cases_processed: 0, rows_inserted: 0, failed: 0, remaining: 0, auth_failed: false }
  }

  let rowsInserted = 0
  let failed = 0
  let authFailed = false
  const insertStmt = env.DB.prepare(
    `INSERT OR IGNORE INTO price_snapshots (case_id, fetched_at, lowest, median, volume) VALUES (?, ?, ?, ?, ?)`,
  )
  const markStmt = env.DB.prepare(
    `UPDATE cases SET backfilled_at = ? WHERE id = ?`,
  )

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i]
    const history = await fetchSteamPriceHistory(c.name, env.STEAM_LOGIN_COOKIE)

    if (history === null) {
      failed++
      // If first case fails with auth-flavored failure, stop entire batch — cookie likely bad
      if (i === 0) {
        authFailed = true
        console.warn(`[backfill] aborting batch — first case ${c.name} returned null (cookie?)`)
        break
      }
    } else if (history.length === 0) {
      // Mark as backfilled even with no data (delisted item, e.g.) so we don't keep retrying
      await markStmt.bind(Math.floor(Date.now() / 1000), c.id).run()
    } else {
      // Batch insert all history points for this case
      const batch = history.map(h => insertStmt.bind(c.id, h.fetched_at, h.price, h.price, h.volume))
      await env.DB.batch(batch)
      await markStmt.bind(Math.floor(Date.now() / 1000), c.id).run()
      rowsInserted += history.length
      console.log(`[backfill] ${c.name}: ${history.length} historical points`)
    }

    // Steam rate-limits authed traffic too — be polite
    if (i < cases.length - 1) await sleep(5000)
  }

  // Count remaining
  const remainingRow = await env.DB
    .prepare(`SELECT COUNT(*) AS n FROM cases WHERE backfilled_at IS NULL`)
    .first<{ n: number }>()

  return {
    cases_processed: cases.length - failed,
    rows_inserted: rowsInserted,
    failed,
    remaining: remainingRow?.n ?? 0,
    auth_failed: authFailed,
  }
}

// ─── read endpoints ─────────────────────────────────────────────────────────

interface LatestRow {
  id: string
  name: string
  released: string
  pool: string
  rare_type: string
  has_gloves: number
  notable: string | null
  fetched_at: number | null
  lowest: number | null
  median: number | null
  volume: number | null
}

async function getLatest(env: Env) {
  // For each case, get the latest snapshot. Subquery picks max(fetched_at) per case.
  const result = await env.DB.prepare(`
    SELECT
      c.id, c.name, c.released, c.pool, c.rare_type, c.has_gloves, c.notable,
      ps.fetched_at, ps.lowest, ps.median, ps.volume
    FROM cases c
    LEFT JOIN price_snapshots ps ON ps.case_id = c.id
    WHERE ps.fetched_at IS NULL OR ps.fetched_at = (
      SELECT MAX(fetched_at) FROM price_snapshots WHERE case_id = c.id
    )
    ORDER BY c.name
  `).all<LatestRow>()

  return result.results || []
}

async function getHistory(env: Env, name: string, days: number) {
  const since = Math.floor(Date.now() / 1000) - days * 86400
  const result = await env.DB.prepare(`
    SELECT ps.fetched_at, ps.lowest, ps.median, ps.volume
    FROM price_snapshots ps
    JOIN cases c ON c.id = ps.case_id
    WHERE c.name = ? AND ps.fetched_at >= ?
    ORDER BY ps.fetched_at ASC
  `).bind(name, since).all<{ fetched_at: number; lowest: number; median: number; volume: number }>()
  return result.results || []
}

async function getMovers(env: Env, days: number) {
  const now = Math.floor(Date.now() / 1000)
  const since = now - days * 86400
  // For each case: latest price vs first price in window. Compute % change.
  // Exclude cases with only one snapshot in the window (no real movement to report).
  const result = await env.DB.prepare(`
    WITH window_data AS (
      SELECT
        c.id, c.name, c.pool,
        FIRST_VALUE(ps.lowest) OVER (PARTITION BY c.id ORDER BY ps.fetched_at ASC)  AS first_price,
        FIRST_VALUE(ps.lowest) OVER (PARTITION BY c.id ORDER BY ps.fetched_at DESC) AS last_price,
        FIRST_VALUE(ps.fetched_at) OVER (PARTITION BY c.id ORDER BY ps.fetched_at DESC) AS last_at,
        COUNT(*) OVER (PARTITION BY c.id) AS snap_count
      FROM cases c
      JOIN price_snapshots ps ON ps.case_id = c.id
      WHERE ps.fetched_at >= ? AND ps.lowest IS NOT NULL
    )
    SELECT DISTINCT
      id, name, pool, first_price, last_price, last_at,
      CAST(((last_price - first_price) * 100.0 / NULLIF(first_price, 0)) AS REAL) AS pct_change
    FROM window_data
    WHERE first_price > 0 AND snap_count >= 2
    ORDER BY ABS(pct_change) DESC
    LIMIT 20
  `).bind(since).all<{
    id: string; name: string; pool: string;
    first_price: number; last_price: number; last_at: number; pct_change: number;
  }>()
  return result.results || []
}

async function getStats(env: Env) {
  const latest = await getLatest(env)
  const withPrice = latest.filter(r => r.lowest != null)
  const totalVolume = withPrice.reduce((s, r) => s + (r.volume || 0), 0)
  const totalCap = withPrice.reduce((s, r) => s + (r.lowest || 0) * (r.volume || 0), 0)
  const lastSweep = withPrice.reduce((max, r) => Math.max(max, r.fetched_at || 0), 0)

  // Last cron run
  const cronRow = await env.DB
    .prepare(`SELECT started_at, finished_at, succeeded, failed, error FROM cron_runs ORDER BY started_at DESC LIMIT 1`)
    .first<{ started_at: number; finished_at: number; succeeded: number; failed: number; error: string | null }>()

  return {
    cases_tracked: withPrice.length,
    total_cases: latest.length,
    total_volume_24h: totalVolume,
    total_market_cap: totalCap,
    last_snapshot_at: lastSweep || null,
    last_cron: cronRow,
  }
}

async function getStaleCases(env: Env): Promise<string[]> {
  const cutoff = Math.floor(Date.now() / 1000) - STALE_THRESHOLD_SECONDS
  const result = await env.DB.prepare(`
    SELECT c.id
    FROM cases c
    LEFT JOIN (
      SELECT case_id, MAX(fetched_at) AS latest FROM price_snapshots GROUP BY case_id
    ) latest ON latest.case_id = c.id
    WHERE latest.latest IS NULL OR latest.latest < ?
  `).bind(cutoff).all<{ id: string }>()
  return (result.results || []).map(r => r.id)
}

// ─── auth (single shared password gate) ────────────────────────────────────
//
// Design:
//   - Password is stored only as a PBKDF2 hash in env.AUTH_PASSWORD_HASH.
//     Format: "<iterations>.<salt_b64>.<hash_b64>". 200K iterations.
//     Plaintext never touches disk — generate the hash client-side via
//     tools/hash-password.html and paste only the hash into Cloudflare.
//   - On successful login the worker returns a stateless HMAC session token:
//     "<expires_unix>.<hmac_b64>" where the HMAC is over the expiry timestamp,
//     keyed by env.AUTH_SESSION_SECRET. Tokens expire after 30 days.
//   - Frontend stores the token in localStorage and sends it on every request
//     as the Authorization: Bearer header. No server-side session table needed,
//     so this works fine for the "me + a friend" case — each browser has its
//     own token, both verify against the same secret.
//   - If AUTH_PASSWORD_HASH is unset, the gate is disabled (development mode).

const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60          // 30 days

function authEnabled(env: Env): boolean {
  return Boolean(env.AUTH_PASSWORD_HASH && env.AUTH_SESSION_SECRET)
}

function bytesToB64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

/**
 * Verify a plaintext password against a stored "<iters>.<salt_b64>.<hash_b64>"
 * record. Returns true on match, false otherwise. Constant-time comparison.
 */
async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('.')
  if (parts.length !== 3) return false
  const iterations = parseInt(parts[0], 10)
  if (!Number.isFinite(iterations) || iterations < 1000) return false

  let salt: Uint8Array
  let expected: Uint8Array
  try {
    salt = b64ToBytes(parts[1])
    expected = b64ToBytes(parts[2])
  } catch {
    return false
  }

  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  )
  const derived = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
      keyMaterial,
      expected.length * 8,
    ),
  )

  // Constant-time comparison
  if (derived.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < derived.length; i++) diff |= derived[i] ^ expected[i]
  return diff === 0
}

async function hmacSign(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(message)))
  return bytesToB64(sig)
}

async function issueSessionToken(env: Env): Promise<string> {
  const expires = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  const sig = await hmacSign(env.AUTH_SESSION_SECRET!, String(expires))
  return `${expires}.${sig}`
}

async function verifySessionToken(env: Env, token: string): Promise<boolean> {
  const dot = token.indexOf('.')
  if (dot < 1) return false
  const expiresStr = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expires = parseInt(expiresStr, 10)
  if (!Number.isFinite(expires)) return false
  if (expires < Math.floor(Date.now() / 1000)) return false       // expired

  const expected = await hmacSign(env.AUTH_SESSION_SECRET!, expiresStr)
  // Constant-time compare
  if (expected.length !== sig.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i)
  return diff === 0
}

/**
 * Pull the bearer token from the Authorization header (or x-auth-token,
 * for environments that strip Authorization).
 */
function extractToken(request: Request): string | null {
  const auth = request.headers.get('Authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim()
  const x = request.headers.get('X-Auth-Token')
  if (x) return x.trim()
  return null
}

// ─── LLM proxy (OpenRouter) ─────────────────────────────────────────────────

const DEFAULT_MODEL = 'anthropic/claude-sonnet-4.5'

/**
 * Lazily construct the OpenRouter client per request. The SDK is cheap to
 * instantiate; sharing an instance across requests in a Worker is risky because
 * env can differ in dev/staging/prod and Workers reuse globals across requests.
 */
function makeOpenRouterClient(env: Env): OpenRouter {
  return new OpenRouter({
    apiKey: env.OPENROUTER_API_KEY,
    httpReferer: env.OPENROUTER_APP_URL || undefined,
    appTitle: env.OPENROUTER_APP_NAME || 'CS2 Case Terminal',
  })
}

/**
 * Build the messages array, optionally tagging the system prompt with
 * Anthropic cache_control for prompt caching. OpenRouter accepts cache_control
 * markers per-message; only the Anthropic provider acts on them. For other
 * providers, the markers are silently ignored.
 *
 * https://openrouter.ai/docs/guides/best-practices/prompt-caching
 */
function buildMessages(req: ChatRequest, model: string) {
  const isAnthropic = model.startsWith('anthropic/')
  const cache = req.cache_system_prompt && isAnthropic

  // System message: optionally split into a content array with cache_control
  // on the last (and only) text part. Plain string is fine for non-cached.
  const systemMsg = cache
    ? {
        role: 'system' as const,
        content: [
          {
            type: 'text' as const,
            text: req.system,
            cache_control: { type: 'ephemeral' as const },
          },
        ],
      }
    : { role: 'system' as const, content: req.system }

  return [systemMsg, ...req.messages]
}

/**
 * Non-streaming chat completion. Returns text + actual model used (after any
 * provider fallback) + usage stats including any cache savings.
 */
async function callLLM(
  env: Env,
  req: ChatRequest,
): Promise<
  | { text: string; model: string; usage: unknown }
  | { error: string; status: number }
> {
  if (!env.OPENROUTER_API_KEY) {
    return { error: 'OPENROUTER_API_KEY not set on worker (run: wrangler secret put OPENROUTER_API_KEY)', status: 500 }
  }

  const model = req.model || env.OPENROUTER_MODEL || DEFAULT_MODEL
  const messages = buildMessages(req, model)

  // Build the chatRequest object only including parameters the user actually set —
  // omitting an optional parameter is different from sending null/undefined for many providers.
  const chatRequest: Record<string, unknown> = {
    model,
    messages,
    stream: false,
  }
  if (req.max_completion_tokens != null) chatRequest.maxCompletionTokens = req.max_completion_tokens
  if (req.temperature != null)           chatRequest.temperature = req.temperature
  if (req.top_p != null)                 chatRequest.topP = req.top_p
  if (req.seed != null)                  chatRequest.seed = req.seed
  if (req.stop?.length)                  chatRequest.stop = req.stop
  if (req.response_format)               chatRequest.responseFormat = req.response_format
  if (req.verbosity)                     chatRequest.verbosity = req.verbosity

  // OpenRouter response-caching headers. Free cache hits when the same identical
  // request comes in within the TTL window.
  const requestOptions: { fetchOptions?: { headers: Record<string, string> } } = {}
  if (req.cache_response_ttl && req.cache_response_ttl > 0) {
    const ttl = Math.min(86400, Math.max(1, Math.floor(req.cache_response_ttl)))
    requestOptions.fetchOptions = {
      headers: {
        'X-OpenRouter-Cache': 'true',
        'X-OpenRouter-Cache-TTL': String(ttl),
      },
    }
  }

  try {
    const client = makeOpenRouterClient(env)
    const result = await client.chat.send({ chatRequest } as any, requestOptions as any)

    const r = result as any
    const text = r.choices?.[0]?.message?.content || ''
    const actualModel = r.model || model
    const usage = r.usage
    return { text, model: actualModel, usage }
  } catch (e: any) {
    const status = e?.statusCode ?? e?.status ?? 500
    const message = e?.message || e?.body || String(e)
    return { error: message.slice(0, 300), status }
  }
}

/**
 * Streaming chat completion. Returns an SSE-formatted ReadableStream that the
 * worker can pass straight back to the client. Each chunk is a JSON line with
 * the OpenAI delta shape: { choices: [{ delta: { content: "..." } }] }.
 *
 * The frontend can consume this with EventSource or fetch+ReadableStream.
 */
async function callLLMStream(env: Env, req: ChatRequest): Promise<Response> {
  if (!env.OPENROUTER_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'OPENROUTER_API_KEY not set' }),
      { status: 500, headers: { ...corsHeaders(env), 'Content-Type': 'application/json' } },
    )
  }

  const model = req.model || env.OPENROUTER_MODEL || DEFAULT_MODEL
  const messages = buildMessages(req, model)

  const chatRequest: Record<string, unknown> = {
    model,
    messages,
    stream: true,
  }
  if (req.max_completion_tokens != null) chatRequest.maxCompletionTokens = req.max_completion_tokens
  if (req.temperature != null)           chatRequest.temperature = req.temperature
  if (req.top_p != null)                 chatRequest.topP = req.top_p
  if (req.seed != null)                  chatRequest.seed = req.seed
  if (req.stop?.length)                  chatRequest.stop = req.stop
  if (req.response_format)               chatRequest.responseFormat = req.response_format
  if (req.verbosity)                     chatRequest.verbosity = req.verbosity

  const requestOptions: { fetchOptions?: { headers: Record<string, string> } } = {}
  if (req.cache_response_ttl && req.cache_response_ttl > 0) {
    const ttl = Math.min(86400, Math.max(1, Math.floor(req.cache_response_ttl)))
    requestOptions.fetchOptions = {
      headers: {
        'X-OpenRouter-Cache': 'true',
        'X-OpenRouter-Cache-TTL': String(ttl),
      },
    }
  }

  const client = makeOpenRouterClient(env)

  // The SDK's stream:true overload returns an EventStream<ChatStreamChunk>.
  // We adapt it into an SSE response the browser can consume directly.
  const sdkStream = (await client.chat.send(
    { chatRequest } as any,
    requestOptions as any,
  )) as unknown as AsyncIterable<any>

  const encoder = new TextEncoder()
  const sseStream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of sdkStream) {
          // Forward as standard SSE: one JSON event per chunk, plus a [DONE] terminator.
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
        }
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
      } catch (e: any) {
        // Mid-stream error: emit as final SSE error event per OpenRouter spec.
        const errEvent = {
          error: { code: 'stream_error', message: e?.message || String(e) },
          choices: [{ index: 0, delta: { content: '' }, finish_reason: 'error' }],
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(errEvent)}\n\n`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(sseStream, {
    headers: {
      ...corsHeaders(env),
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

// ─── embeddings (for sqlite-vec / RAG) ──────────────────────────────────────

interface EmbeddingsRequest {
  /** Single string OR array of strings (built-in batching, single API call). */
  input: string | string[]
  /**
   * Embedding model id. Defaults to env OPENROUTER_EMBEDDING_MODEL or
   * 'openai/text-embedding-3-small' (1536 dim, fast, cheap, good baseline).
   * Browse: https://openrouter.ai/models?fmt=cards&output_modalities=embeddings
   */
  model?: string
  /** Some models support reduced dimensions. Useful for compact vector storage. */
  dimensions?: number
  /** float (default) or base64. base64 is ~4x smaller over the wire. */
  encoding_format?: 'float' | 'base64'
}

interface EmbeddingsResult {
  model: string
  data: { index: number; embedding: number[] | string }[]
  usage: unknown
}

const DEFAULT_EMBEDDING_MODEL = 'openai/text-embedding-3-small'

/**
 * Generate embeddings for one or many inputs in a single call. Embeddings are
 * deterministic for the same input — cache the results in your DB and reuse.
 *
 * Common starter models:
 *   openai/text-embedding-3-small   1536 dim, fast, cheap (default)
 *   openai/text-embedding-3-large   3072 dim, higher quality
 *   qwen/qwen3-embedding-0.6b       small, multilingual
 *   voyage/voyage-3                 strong on retrieval benchmarks
 */
async function callEmbeddings(
  env: Env,
  req: EmbeddingsRequest,
): Promise<EmbeddingsResult | { error: string; status: number }> {
  if (!env.OPENROUTER_API_KEY) {
    return { error: 'OPENROUTER_API_KEY not set', status: 500 }
  }

  const model = req.model || env.OPENROUTER_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL
  const inputs = Array.isArray(req.input) ? req.input : [req.input]

  if (inputs.length === 0) {
    return { error: 'input must be a non-empty string or array', status: 400 }
  }

  try {
    const client = makeOpenRouterClient(env)
    const result = await client.embeddings.generate({
      requestBody: {
        model,
        input: inputs,
        ...(req.dimensions != null ? { dimensions: req.dimensions } : {}),
        ...(req.encoding_format ? { encodingFormat: req.encoding_format } : {}),
      },
    })

    const r = result as any
    return {
      model: r.model || model,
      data: r.data || [],
      usage: r.usage,
    }
  } catch (e: any) {
    const status = e?.statusCode ?? e?.status ?? 500
    return { error: e?.message?.slice(0, 300) || String(e), status }
  }
}

// ─── help page ──────────────────────────────────────────────────────────────

const HELP_PAGE = `CS2 CASE TERMINAL — Cloudflare Worker (D1-backed)

Data endpoints:
  GET  /health                   Cron heartbeat + DB stats
  GET  /latest                   Latest snapshot for every case
  GET  /history?name=X&days=30   Time-series for one case
  GET  /movers?days=7            Biggest % movers in window
  GET  /stats                    Aggregate market stats
  POST /refresh                  Refresh stale cases on-demand
  POST /admin/snapshot-now       Manually trigger sweep (X-Admin-Token header)
  POST /admin/backfill?limit=20  Pull historical Steam pricehistory data
                                 (requires X-Admin-Token + STEAM_LOGIN_COOKIE secret)

LLM endpoints (via @openrouter/sdk):
  GET  /models                   OpenRouter model catalog passthrough
  POST /chat                     Chat completion. Body params:
                                   messages, system           (required)
                                   model                      (default: env OPENROUTER_MODEL)
                                   max_completion_tokens      (omit to let model use full context budget)
                                   temperature, top_p, seed, stop, response_format
                                   verbosity                  ('low'|'medium'|'high'|'xhigh'|'max')
                                   stream                     (true returns SSE stream)
                                   cache_system_prompt        (anthropic/* only — ~90% cost reduction)
                                   cache_response_ttl         (seconds, 1-86400; cache HITS are free)
  POST /embeddings               Generate embeddings for sqlite-vec / semantic search:
                                   input    (string or array — built-in batching)
                                   model    (default: env OPENROUTER_EMBEDDING_MODEL)
                                   dimensions, encoding_format

Cron: see wrangler.toml [triggers] crons. Default hourly at :05.
`

// ─── main handler ───────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(env) })
    }

    try {
      // ─── Auth endpoints (always public, even when gate is enabled) ────────

      // POST /auth/login { password } → { token, expires_at }
      if (url.pathname === '/auth/login' && request.method === 'POST') {
        if (!authEnabled(env)) {
          return jsonResponse({ error: 'auth not configured on this worker' }, env, 400)
        }
        let body: { password?: string }
        try { body = await request.json() } catch { body = {} }
        const password = (body.password || '').trim()
        if (!password) {
          return jsonResponse({ error: 'password required' }, env, 400)
        }
        // Small constant-time delay to discourage timing-based brute-force.
        // For a single-user gate this is overkill but it's free.
        const ok = await verifyPassword(password, env.AUTH_PASSWORD_HASH!)
        if (!ok) {
          // Sleep ~250ms before responding to slow down online brute force.
          await new Promise((r) => setTimeout(r, 250))
          return jsonResponse({ error: 'invalid password' }, env, 401)
        }
        const token = await issueSessionToken(env)
        const expires_at = parseInt(token.split('.')[0], 10)
        return jsonResponse({ token, expires_at }, env)
      }

      // GET /auth/me → { authenticated: bool, auth_required: bool }
      // Lets the frontend decide whether to show a login screen on cold start.
      if (url.pathname === '/auth/me' && request.method === 'GET') {
        if (!authEnabled(env)) {
          return jsonResponse({ authenticated: true, auth_required: false }, env)
        }
        const token = extractToken(request)
        if (!token) {
          return jsonResponse({ authenticated: false, auth_required: true }, env)
        }
        const valid = await verifySessionToken(env, token)
        return jsonResponse({ authenticated: valid, auth_required: true }, env)
      }

      // ─── Auth gate ────────────────────────────────────────────────────────
      // If a password is configured, every other endpoint requires a valid
      // session token. Admin endpoints have a second layer (X-Admin-Token)
      // checked further down — that defends against a leaked session token
      // burning DB rows or running mass-sweep operations.
      if (authEnabled(env)) {
        const token = extractToken(request)
        if (!token || !(await verifySessionToken(env, token))) {
          return jsonResponse(
            { error: 'authentication required', auth_required: true },
            env,
            401,
          )
        }
      }

      // Help
      if (url.pathname === '/' || url.pathname === '') {
        return new Response(HELP_PAGE, {
          headers: { ...corsHeaders(env), 'Content-Type': 'text/plain; charset=utf-8' },
        })
      }

      // Health
      if (url.pathname === '/health' && request.method === 'GET') {
        const stats = await getStats(env)
        const now = Math.floor(Date.now() / 1000)
        const ageSec = stats.last_snapshot_at ? now - stats.last_snapshot_at : null
        return jsonResponse({
          ok: true,
          last_snapshot_age_seconds: ageSec,
          ...stats,
        }, env)
      }

      // Latest
      if (url.pathname === '/latest' && request.method === 'GET') {
        const rows = await getLatest(env)
        return jsonResponse({ cases: rows }, env)
      }

      // History
      if (url.pathname === '/history' && request.method === 'GET') {
        const name = url.searchParams.get('name')
        const days = Math.min(365, parseInt(url.searchParams.get('days') || '30', 10) || 30)
        if (!name) return jsonResponse({ error: 'missing name' }, env, 400)
        const rows = await getHistory(env, name, days)
        return jsonResponse({ name, days, history: rows }, env)
      }

      // Movers
      if (url.pathname === '/movers' && request.method === 'GET') {
        const days = Math.min(90, parseInt(url.searchParams.get('days') || '7', 10) || 7)
        const rows = await getMovers(env, days)
        return jsonResponse({ days, movers: rows }, env)
      }

      // Stats
      if (url.pathname === '/stats' && request.method === 'GET') {
        const stats = await getStats(env)
        return jsonResponse(stats, env)
      }

      // Refresh stale on-demand
      if (url.pathname === '/refresh' && request.method === 'POST') {
        const stale = await getStaleCases(env)
        if (stale.length === 0) {
          return jsonResponse({ refreshed: 0, message: 'all fresh' }, env)
        }
        // If >20 stale cases, this looks like a fresh deploy — refuse and direct
        // the caller to /admin/snapshot-now which runs async in the background.
        if (stale.length > 20) {
          return jsonResponse({
            refreshed: 0,
            stale: stale.length,
            message: 'too many stale cases (likely fresh deploy) — run POST /admin/snapshot-now or wait for the next cron',
          }, env, 503)
        }
        // Otherwise refresh up to 5 synchronously with tight spacing (~10s).
        const limited = stale.slice(0, 5)
        const result = await sweep(env, { caseFilter: limited, spacingMs: 2000 })
        return jsonResponse({
          refreshed: result.succeeded,
          failed: result.failed,
          attempted: limited.length,
          remaining: stale.length - limited.length,
        }, env)
      }

      // Chat — non-streaming or streaming based on body.stream
      if (url.pathname === '/chat' && request.method === 'POST') {
        const body: ChatRequest = await request.json()
        if (!body.messages || !Array.isArray(body.messages)) {
          return jsonResponse({ error: 'messages required' }, env, 400)
        }
        if (body.stream) {
          return await callLLMStream(env, body)
        }
        const result = await callLLM(env, body)
        if ('error' in result) return jsonResponse({ error: result.error }, env, result.status)
        return jsonResponse(result, env)
      }

      // Embeddings — for sqlite-vec / semantic search use cases
      if (url.pathname === '/embeddings' && request.method === 'POST') {
        const body: EmbeddingsRequest = await request.json()
        if (!body.input || (Array.isArray(body.input) && body.input.length === 0)) {
          return jsonResponse({ error: 'input required (string or non-empty array)' }, env, 400)
        }
        const result = await callEmbeddings(env, body)
        if ('error' in result) return jsonResponse({ error: result.error }, env, result.status)
        return jsonResponse(result, env)
      }

      // Models — passes through OpenRouter's catalog for the frontend's model picker
      if (url.pathname === '/models' && request.method === 'GET') {
        if (!env.OPENROUTER_API_KEY) {
          return jsonResponse({ error: 'OPENROUTER_API_KEY not set' }, env, 500)
        }
        try {
          const client = makeOpenRouterClient(env)
          const list = await client.models.list()
          // Slim payload for the frontend dropdown
          const slim = (list.data || []).map((m: any) => ({
            id: m.id,
            name: m.name,
            context_length: m.context_length,
            pricing: m.pricing,
          }))
          return jsonResponse({ models: slim, current: env.OPENROUTER_MODEL || DEFAULT_MODEL }, env)
        } catch (e: any) {
          const status = e?.statusCode ?? e?.status ?? 500
          return jsonResponse({ error: e?.message || 'failed to fetch models' }, env, status)
        }
      }

      // Admin: synchronous batched sweep. Workers' waitUntil() only gets ~30s of
      // post-invocation runtime on workers.dev, so a 41-case sweep (164s+) gets
      // killed mid-run. Instead we sweep ?limit= cases per call (default 5,
      // ~20s wall time @ 4s spacing), return progress, and let the caller poll.
      // The hourly cron handler has a 15-min budget and can do the full sweep
      // in one go — this endpoint is just for "I want data NOW" usage.
      if (url.pathname === '/admin/snapshot-now' && request.method === 'POST') {
        const provided = request.headers.get('x-admin-token')
        if (!env.ADMIN_TOKEN || provided !== env.ADMIN_TOKEN) {
          return jsonResponse({ error: 'unauthorized' }, env, 401)
        }
        const limit = Math.min(8, Math.max(1, parseInt(url.searchParams.get('limit') || '5', 10) || 5))
        const stale = await getStaleCases(env)
        if (stale.length === 0) {
          return jsonResponse({ done: true, processed: 0, succeeded: 0, failed: 0, remaining_stale: 0, message: 'all cases fresh' }, env)
        }
        const batch = stale.slice(0, limit)
        const result = await sweep(env, { caseFilter: batch, spacingMs: 4000 })
        const remaining = stale.length - batch.length
        return jsonResponse({
          done: remaining === 0,
          processed: batch.length,
          succeeded: result.succeeded,
          failed: result.failed,
          remaining_stale: remaining,
          rate_limited: result.rateLimited,
          message: remaining === 0
            ? `swept ${batch.length} cases — all stale cases now covered`
            : `swept ${batch.length} cases, ${remaining} still stale — call again to continue`,
        }, env)
      }

      // Admin: backfill historical data via Steam pricehistory (requires login cookie)
      if (url.pathname === '/admin/backfill' && request.method === 'POST') {
        const provided = request.headers.get('x-admin-token')
        if (!env.ADMIN_TOKEN || provided !== env.ADMIN_TOKEN) {
          return jsonResponse({ error: 'unauthorized' }, env, 401)
        }
        if (!env.STEAM_LOGIN_COOKIE) {
          return jsonResponse({
            error: 'STEAM_LOGIN_COOKIE secret not set',
            hint: 'wrangler secret put STEAM_LOGIN_COOKIE — see README for how to grab it',
          }, env, 400)
        }
        const limit = Math.min(40, parseInt(url.searchParams.get('limit') || '20', 10) || 20)
        const result = await runBackfill(env, limit)
        const status = result.auth_failed ? 401 : 200
        return jsonResponse({
          ...result,
          message: result.auth_failed
            ? 'Steam auth failed — cookie likely expired. Re-extract from browser and update secret.'
            : `${result.cases_processed} cases backfilled, ${result.rows_inserted} historical rows inserted, ${result.remaining} cases remaining`,
        }, env, status)
      }

      return jsonResponse({ error: 'not found' }, env, 404)
    } catch (e: any) {
      console.error('[handler] error:', e)
      return jsonResponse({ error: e.message || 'internal error' }, env, 500)
    }
  },

  /**
   * Cron trigger handler. Cloudflare invokes this on the schedule defined in
   * wrangler.toml [triggers] crons. We get a 15-minute execution budget.
   */
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runSweepWithLog(env, 'cron'))
  },
}

async function runSweepWithLog(env: Env, source: 'cron' | 'admin'): Promise<void> {
  const startedAt = Math.floor(Date.now() / 1000)
  console.log(`[${source}] sweep starting at ${new Date().toISOString()}`)

  let succeeded = 0
  let failed = 0
  let error: string | null = null

  try {
    const result = await sweep(env)
    succeeded = result.succeeded
    failed = result.failed
    if (result.rateLimited) error = 'rate-limited (recovered)'
  } catch (e: any) {
    error = e.message || 'unknown error'
    console.error(`[${source}] sweep failed:`, e)
  }

  const finishedAt = Math.floor(Date.now() / 1000)
  console.log(`[${source}] sweep done: ${succeeded} ok, ${failed} failed, ${finishedAt - startedAt}s`)

  // Log to cron_runs table for observability
  try {
    await env.DB
      .prepare(`INSERT INTO cron_runs (started_at, finished_at, succeeded, failed, error) VALUES (?, ?, ?, ?, ?)`)
      .bind(startedAt, finishedAt, succeeded, failed, error)
      .run()
  } catch (e: any) {
    console.error('[log] failed to record cron run:', e)
  }
}
