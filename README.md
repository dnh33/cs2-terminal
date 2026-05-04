# CS2 Case Terminal

A Bloomberg-style market intelligence terminal for CS2 cases. Tracks ~40 cases across active, rare, and discontinued drop pools, with LLM-native investment thesis generation, real time-series price history, and natural-language analyst chat.

**Stack:** React 19 + TypeScript + Vite + Tailwind 3 frontend on Netlify. Cloudflare Worker with D1 SQLite database for the data layer. Cron trigger sweeps Steam Market hourly; on-demand refresh covers any case staler than 10 min.

> **Prefer dashboard clicks over CLI?** See [DASHBOARD_DEPLOY.md](./DASHBOARD_DEPLOY.md) for a drag-and-drop deployment path. You'll run one local build command, then everything else is browser-based.

## Architecture

```
┌─────────────────┐         ┌──────────────────────────┐         ┌──────────────────┐
│  React frontend │  HTTPS  │ Cloudflare Worker        │  HTTPS  │ Steam Market     │
│  (Netlify)      │ ──────► │ /latest /history /movers │         │ (no CORS)        │
│                 │  reads  │ /stats  /chat  /refresh  │         └──────────────────┘
│                 │  D1     │            │             │              ▲
└─────────────────┘         │            ▼             │  hourly      │
                            │ ┌────────────────┐       │  cron        │
                            │ │ D1 SQLite      │ ◄─────┴──────────────┘
                            │ │ - cases        │   sweep writes 1 snapshot/case
                            │ │ - snapshots    │
                            │ │ - cron_runs    │       ┌──────────────────┐
                            │ └────────────────┘       │ OpenRouter API   │
                            │            ▲             │ (200+ models,    │
                            │            └──────────── │  one key)        │
                            └──────────────────────────┘                  │
                                                       └──────────────────┘
```

The frontend never touches Steam. All Steam fetches happen server-side on a schedule, respecting the rate limit. Snapshots accumulate in D1 over time, building a real historical price database. The `/movers` endpoint computes % change windows in SQL — no expensive client-side analysis needed. LLM calls go through the worker via the official `@openrouter/sdk`, so the API key stays server-side and the model is swappable with one config line.

## What's free, what's not

Everything fits the free tier:

| Resource | Free limit | Hourly cron usage | Notes |
|---|---|---|---|
| Cloudflare Workers | 100K req/day | ~960 frontend + 24 cron / day | well under |
| D1 reads | 5M / day | a few thousand | trivial |
| D1 writes | 100K / day | ~1000 / day | ~1% of limit |
| D1 storage | 5GB | ~50MB / year | will outlive you |
| Netlify | 100GB bandwidth / mo | small static site | ignore |
| OpenRouter (LLM) | pay per token | ~2K input + 1K output per analysis | provider rate + 5% |

If you want to crank to every-30-minutes cron, multiply the cron and write numbers by 2. Still free.

## Setup

You have two options:

- **Dashboard-only (no CLI)** — drag-and-drop the pre-built bundle into Cloudflare and Netlify dashboards. ~15 minutes. See [DEPLOY_DASHBOARD.md](./DEPLOY_DASHBOARD.md).
- **CLI (wrangler + git)** — what's documented below. Better for ongoing development.

### 1. Frontend dependencies

```bash
npm install
```

### 2. Worker setup

```bash
cd worker
npm install
npx wrangler login
```

### 3. Create the D1 database

```bash
npx wrangler d1 create cs2-prices
```

This prints something like:
```
[[d1_databases]]
binding = "DB"
database_name = "cs2-prices"
database_id = "abc-123-def-456-..."
```

Copy the `database_id` and paste it into `worker/wrangler.toml` (replace `REPLACE_WITH_D1_DATABASE_ID`).

### 4. Apply schema and seed cases

```bash
# Schema (tables + indexes)
npx wrangler d1 execute cs2-prices --file=schema.sql --remote

# Seed cases reference data
npx wrangler d1 execute cs2-prices --file=seed-cases.sql --remote
```

For local development, use `--local` instead of `--remote`. Local and remote databases are independent.

### 5. Set worker secrets

```bash
# OpenRouter API key — get one at https://openrouter.ai/keys
# (Add credits to your OpenRouter account; pay-per-use, no subscription)
npx wrangler secret put OPENROUTER_API_KEY

# Random token to gate /admin/snapshot-now
npx wrangler secret put ADMIN_TOKEN
```

Generate a random admin token however you like. Examples:
```bash
openssl rand -hex 32
# or
node -e "console.log(crypto.randomBytes(32).toString('hex'))"
```

#### Why OpenRouter?

The worker uses [`@openrouter/sdk`](https://www.npmjs.com/package/@openrouter/sdk) to talk to LLMs. OpenRouter is one API key for hundreds of models — Claude, GPT-5, Gemini, DeepSeek, Llama. You can switch which model the analyst uses by changing one line in `wrangler.toml`:

```toml
[vars]
OPENROUTER_MODEL = "anthropic/claude-sonnet-4.5"   # default
# OPENROUTER_MODEL = "openai/gpt-5"                 # alternative
# OPENROUTER_MODEL = "deepseek/deepseek-chat-v3"    # ~10× cheaper
```

OpenRouter charges provider rates + 5% platform fee; for this workload (occasional analyst queries) you'll spend cents per day. Browse the catalog at <https://openrouter.ai/models>.

### 6. Deploy the worker

```bash
npm run deploy
```

You'll get a URL like `https://cs2-steam-proxy.<your-account>.workers.dev`. Save it.

### 7. Trigger the first sweep

The cron will run at the next scheduled time, but for instant data:

```bash
curl -X POST https://your-worker.workers.dev/admin/snapshot-now \
  -H "X-Admin-Token: <your-admin-token>"
```

Returns immediately. The sweep runs in the background — completes in ~3 minutes. Watch progress via `wrangler tail` from the worker dir.

### 8. Verify

```bash
curl https://your-worker.workers.dev/health
```

You should see `cases_tracked: 40` (or close to it) and a recent `last_snapshot_at`.

### 9. Configure the frontend

```bash
cp .env.example .env
```

Edit `.env`:
```
VITE_WORKER_URL=https://cs2-steam-proxy.<your-account>.workers.dev
```

### 10. Run the frontend

```bash
npm run dev
```

Open http://localhost:5173 and click **LIVE — STEAM MARKET**.

### 11. Deploy frontend to Netlify

Push to GitHub, then:
- New site → Import from GitHub → pick this repo
- Build command: `npm run build`
- Publish directory: `dist`
- Environment variable: `VITE_WORKER_URL` = your worker URL
- Deploy

After Netlify gives you a URL, lock the worker CORS:

```toml
# worker/wrangler.toml
[vars]
ALLOWED_ORIGIN = "https://your-site.netlify.app"
```

`npm run deploy` again from worker dir.

## Historical backfill (recommended on day 1)

Without this step, you start with an empty database and accumulate one snapshot per cron run. With it, you import **the full daily price history** Steam has on each case (typically 5-12 years of data) in one shot, giving you immediate analytical depth.

This uses Steam's `pricehistory` endpoint, which requires you to be logged into Steam. You provide the worker with your own login cookie.

### Get your Steam login cookie

1. Log into [steamcommunity.com](https://steamcommunity.com) in your browser
2. Open DevTools (F12) → Application tab → Cookies → `https://steamcommunity.com`
3. Find the cookie named `steamLoginSecure`
4. Copy its **Value** (a long string starting with your steamID and a token, like `76561198...||eyJ0eX...`)

The cookie expires roughly every 30 days. Re-extract and update the secret when backfill starts returning auth failures.

### Set the secret and run backfill

```bash
cd worker
npx wrangler secret put STEAM_LOGIN_COOKIE
# paste the cookie value when prompted
```

Then trigger backfill (processes 20 cases per call, idempotent — safe to re-run):

```bash
curl -X POST https://your-worker.workers.dev/admin/backfill \
  -H "X-Admin-Token: <your-admin-token>"
```

Returns immediately with progress:

```json
{
  "cases_processed": 20,
  "rows_inserted": 73450,
  "failed": 0,
  "remaining": 21,
  "auth_failed": false,
  "message": "20 cases backfilled, 73450 historical rows inserted, 21 cases remaining"
}
```

Run again to process the next batch. Two calls covers all 41 cases.

After backfill completes:
- D1 will have ~150K rows of real historical price data
- The Movers panel works immediately (real % changes across 7D/30D/90D)
- Detail-panel charts show **real** trajectories (cyan), not modeled (orange)
- Claude analysis has actual time-series context to reason from

### Cookie security notes

- The cookie is sent only from your worker → Steam, server-to-server. Never exposed to the browser.
- It only authenticates your Steam session — it doesn't authorize purchases or trades. Worst case if leaked: someone could read your Steam profile/inventory data while it's valid.
- Steam's ToS technically prohibits automated scraping of market data. Realistically, occasional reads from your own session for personal analytics are at the level Steam doesn't pursue. Don't run aggressive bulk scrapes from this same cookie or you'll get a session ban.
- If you'd rather not use your cookie: skip this step. You'll just accumulate history one cron tick at a time. After 30 days of hourly cron you'll have ~720 snapshots per case — perfectly usable for medium-term analysis.

### Re-running backfill

The `cases.backfilled_at` column tracks completion. To re-backfill specific cases (e.g. after a Steam pool change):

```bash
# In wrangler d1 console:
wrangler d1 execute cs2-prices --remote --command \
  "UPDATE cases SET backfilled_at = NULL WHERE id IN ('csgo_weapon', 'operation_bravo')"
# Then call /admin/backfill again
```

## Migrations (existing deploys only)

If you deployed before the backfill feature was added, apply the migration:

```bash
cd worker
npx wrangler d1 execute cs2-prices --remote --file=migrations/001_backfilled_at.sql
```

Safe to skip on fresh deploys — the column is in `schema.sql` already.



Edit `worker/wrangler.toml`:

```toml
[triggers]
crons = ["5 * * * *"]   # default: hourly at :05
```

Common patterns:

| Cron expression | Frequency | Daily writes |
|---|---|---|
| `*/30 * * * *` | every 30 min | 1,920 |
| `5 * * * *` | every hour ← default | 960 |
| `5 */3 * * *` | every 3 hours | 320 |
| `5 */6 * * *` | every 6 hours | 160 |
| `5 */12 * * *` | every 12 hours | 80 |

Then `npm run deploy`. All options sit comfortably in the D1 free tier (100K writes/day).

## Endpoints

Data:
- `GET /health` — cron heartbeat + DB stats
- `GET /latest` — latest snapshot per case
- `GET /history?name=<n>&days=30` — time-series for one case
- `GET /movers?days=7` — biggest % movers in window
- `GET /stats` — aggregate market stats
- `POST /refresh` — refresh stale cases (>10 min old) on-demand
- `POST /admin/snapshot-now` — manual full sweep (X-Admin-Token header)
- `POST /admin/backfill?limit=20` — pull historical data from Steam pricehistory (X-Admin-Token + STEAM_LOGIN_COOKIE secret)

LLM (via `@openrouter/sdk`):
- `GET /models` — OpenRouter catalog (for a model picker UI)
- `POST /chat` — chat completion. Body parameters:
  - `messages`, `system` (required)
  - `model` (override env default)
  - `max_completion_tokens` (omit to use model's full available budget — there is no fixed numeric ceiling, the cap is `context_length - prompt_length` per model)
  - `temperature` (0–2, default 1), `top_p`, `seed`, `stop`, `response_format` (`{type:"json_object"}` or `json_schema`)
  - `verbosity` (`low | medium | high | xhigh | max` — newer Claude/OpenAI models)
  - `stream: true` returns SSE; the frontend's `callClaudeStream` helper consumes it
  - `cache_system_prompt: true` enables Anthropic prompt caching on `anthropic/*` models. ~90% cost reduction on cache reads. Silently no-op for other providers.
  - `cache_response_ttl: <seconds>` enables OpenRouter response caching (1–86400s). Cache HITS are completely free — no tokens billed, no rate limit hit. Best for repeated identical requests.
- `POST /embeddings` — for semantic search / sqlite-vec. Body:
  - `input` (string or array — built-in batching, single API call regardless of array size)
  - `model` (default: env `OPENROUTER_EMBEDDING_MODEL`)
  - `dimensions`, `encoding_format` (`float` or `base64`)

Auth (active when `AUTH_PASSWORD_HASH` is configured):
- `POST /auth/login` — body `{password}`, returns `{token, expires_at}` on success
- `GET /auth/me` — returns `{authenticated, auth_required}`. Used by the frontend on cold start to decide whether to show the login screen. When auth is disabled (no `AUTH_PASSWORD_HASH` set), every endpoint is public.

## Local development

Run worker locally:

```bash
cd worker
npm run dev
```

This starts wrangler on `http://localhost:8787` against a local D1 database. Set `VITE_WORKER_URL=http://localhost:8787` in `.env`. Cron triggers don't fire automatically in dev — use `/admin/snapshot-now` to populate data.

To inspect local D1:

```bash
npx wrangler d1 execute cs2-prices --local --command "SELECT name, lowest, fetched_at FROM price_snapshots ps JOIN cases c ON c.id = ps.case_id ORDER BY fetched_at DESC LIMIT 20"
```

## What gets stored vs. modeled

The `price_snapshots` table holds real Steam Market data. The detail-panel chart shows whichever it has:

- **Real history (cyan)** — when the worker has ≥2 actual snapshots in the requested window. Either from cron accumulation or historical backfill.
- **Modeled (orange)** — synthetic curve based on current price + pool dynamics, used as a placeholder until real data is available.

If you ran `/admin/backfill` on day 1, every case has real history immediately. Without backfill, real history accumulates one cron tick at a time and the Movers panel needs ~hours/days to populate.

## Project layout

```
.
├── src/                       # frontend
│   ├── App.tsx
│   ├── lib/
│   │   ├── cases.ts           # curated case database + demo prices
│   │   ├── metrics.ts         # spread, liquidity, scarcity, breakeven
│   │   ├── api.ts             # worker client (typed)
│   │   └── theme.ts
│   ├── components/
│   │   ├── Header.tsx         # last-sweep freshness indicator
│   │   ├── MoversPanel.tsx    # real % change windows from D1
│   │   ├── DetailPanel.tsx
│   │   ├── Charts.tsx
│   │   ├── Panels.tsx         # MarketScanPanel + ChatPanel
│   │   └── ...
│   └── hooks/useMarketData.ts
└── worker/
    ├── src/index.ts           # main worker (cron + endpoints)
    ├── schema.sql             # D1 schema
    ├── seed-cases.sql         # cases reference data
    └── wrangler.toml
```

## A note on the OpenRouter SDK

The worker uses `@openrouter/sdk@0.12.24` — pinned exactly, not with `^`. That's deliberate: OpenRouter's SDK is in beta and they explicitly warn that minor versions may include breaking changes (e.g. v0.4 renamed `completions.generate` to `chat.send`). Pinning guarantees `npm install` produces the same SDK every time. Bump it manually when you've read the changelog.

Bundle size when shipped to Cloudflare Workers: ~145 KiB gzipped, well under the 1 MiB free-tier ceiling. Verified via `wrangler deploy --dry-run`.

## OpenRouter facts worth knowing (verified against official docs)

**Token limits.** `max_tokens` is deprecated; use `max_completion_tokens`. There is no fixed numeric ceiling — the cap is `context_length - prompt_length` for whichever model you picked. Some providers enforce a minimum of 16. **Best practice:** omit it entirely unless you specifically want to truncate output, and let the model use whatever budget remains. The default model (`anthropic/claude-sonnet-4.5`) has a 200K context window, so a 5K-token prompt leaves ~195K for output.

**Streaming.** Set `stream: true` on `/chat`. The worker forwards SSE chunks straight through. The frontend's `callClaudeStream(req, onChunk, signal)` helper consumes them. Cancellation works via `AbortController` and stops billing for most providers (Anthropic, OpenAI, DeepSeek do; Google, Groq, Mistral, Bedrock do not).

**Embeddings.** Built-in batching: `input` accepts a single string or an array, single API call either way. Embeddings are deterministic — cache them in your DB indefinitely, never regenerate the same input. No streaming. Typical use: semantic search over case notes, RAG over Reddit/forum sentiment, deduplication.

**Two kinds of caching, use both.**

1. *Anthropic prompt caching* via `cache_system_prompt: true`. Marks the system prompt with `cache_control: {type: 'ephemeral'}`. ~90% reduction on cache-read tokens. Only acts on `anthropic/*` models, silently no-op elsewhere. Already enabled in the analyst chat, market scan, and per-case analysis paths.

2. *OpenRouter response caching* via `cache_response_ttl: <seconds>`. Sets `X-OpenRouter-Cache: true`. Cache **hits are completely free** — `usage.prompt_tokens` and `usage.completion_tokens` both report 0, no rate limit consumed. Best for endpoints where the same prompt produces the same answer (Market Scan, fixed-template summaries). Already enabled on Market Scan with a 5-minute TTL. Not available if your account has Zero Data Retention enforced.

**Rate limits.** No fixed numeric per-minute cap on paid models — governed globally per account. More credits = higher capacity. Free models (`:free` suffix) capped at 20 req/min and 50/day (or 1000/day with $10+ in credits). Check your live limit at any time via `GET /api/v1/key`.

**Provider routing.** You can pass a `provider` object to control which upstream serves the request: `order: ["openai", "azure"]`, `allow_fallbacks: true`, `data_collection: "deny"`, `zdr: true`, `sort: "price"`. Useful when a specific provider goes down or you want to optimize for cost. Not currently exposed in our `/chat` payload but a 5-line change to add.

## Disclaimer

Analytical tool, not investment advice. CS2 case prices are highly speculative; Valve can change drop pool status, item pools, or marketplace rules at any time.

## Where your data actually lives

D1 *is* SQLite. Same engine, same SQL, same query semantics as the `better-sqlite3` library or the `sqlite3` CLI. The only difference is *how the worker talks to it*: instead of opening a `.db` file from a Node process, the worker uses a binding (`env.DB`) that Cloudflare provides. Underneath, your data is in a real SQLite file that Cloudflare manages and replicates across their edge.

Three useful things this means:

**You can query the database directly any time.** From the dashboard: D1 → `cs2-prices` → Console tab → run any SQL. From CLI: `wrangler d1 execute cs2-prices --remote --command "SELECT * FROM cron_runs ORDER BY started_at DESC LIMIT 5"`.

**You can export the whole database to a local file.** If you want to play with your data offline, in a notebook, or migrate elsewhere:

```bash
cd worker
npx wrangler d1 export cs2-prices --remote --output=cs2-prices.sql
sqlite3 cs2-prices.db < cs2-prices.sql
# now open cs2-prices.db with any SQLite client — DBeaver, TablePlus,
# DB Browser for SQLite, sqlite3 CLI, anything
```

**Your data is never locked in.** The schema in `worker/schema.sql` is portable. If you ever want to move to a self-hosted Postgres or back to local `better-sqlite3` on a VPS, you import the SQL dump and the worker code becomes the only thing that needs changing.

What D1 *can't* do: load custom SQLite extensions (so no `sqlite-vec` for native vector search). For everything else — every price snapshot, every cron tick, every backfilled historical row — D1 is your database, and it's already wired up the moment the worker is deployed.
