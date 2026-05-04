# Dashboard Deployment (No CLI)

For when you'd rather click than type. Walks you through deploying the entire stack — Cloudflare Worker + D1 + Netlify frontend — using only the web dashboards.

Total time: ~15 minutes if everything goes smoothly.

## What you'll do

1. Create a D1 database in the Cloudflare dashboard
2. Paste the schema and seed SQL into the D1 web console
3. Create a Worker in the dashboard, paste the bundled `worker.js`
4. Bind the worker to D1 and add secrets via the dashboard UI
5. Drag-and-drop the `dist/` folder onto Netlify
6. Edit one line of `config.js` on Netlify to point at the worker

## What's in the `deploy-bundle/` folder

```
deploy-bundle/
├── worker.js              ← upload this to Cloudflare Workers
├── frontend/              ← drag this folder to Netlify
│   ├── index.html
│   ├── config.js          ← edit after deploy to set worker URL
│   ├── favicon.svg
│   └── assets/...
├── tools/
│   └── hash-password.html ← open in your browser to hash your password
├── schema.sql             ← paste into D1 web console (creates tables)
└── seed-cases.sql         ← paste into D1 web console (loads 41 cases)
```

The repo also contains the source code if you ever want to modify and rebuild.

---

## Step 1 — Create the D1 database

1. Go to https://dash.cloudflare.com → **Workers & Pages** → **D1 SQL Database**
2. Click **Create database**
3. Name: `cs2-prices` (or anything; remember what you pick)
4. Region: pick whichever is closest to you
5. **Save the Database ID** that appears — you'll need it in step 3

## Step 2 — Apply the schema and seed

1. Click into your new `cs2-prices` database
2. Go to the **Console** tab
3. Open `deploy-bundle/schema.sql` in a text editor, copy the entire contents
4. Paste it into the console, click **Execute**
5. Should see no errors and the `cases` / `price_snapshots` / `cron_runs` tables in the **Tables** tab
6. Now open `deploy-bundle/seed-cases.sql`, copy, paste, execute
7. Verify in the console:
   ```sql
   SELECT COUNT(*) FROM cases;
   ```
   Should return `41`.

## Step 3 — Create the Worker

1. Go to **Workers & Pages** → **Create application** → **Create Worker**
2. Name it `cs2-steam-proxy` (or anything)
3. Click **Deploy** to create a placeholder, then **Edit code**
4. In the editor, **delete the default code**
5. Open `deploy-bundle/worker.js` in a text editor, copy the entire contents
6. Paste it into the Cloudflare editor (it's one big file — don't worry, that's expected, it's the bundled output)
7. Click **Save and deploy**
8. **Copy your worker URL** — looks like `https://cs2-steam-proxy.<your-account>.workers.dev`. Save it somewhere; you'll need it twice more.

## Step 4 — Configure the Worker

Still in the Worker, click **Settings** → **Variables and Secrets**.

### 4a. Bind the D1 database

1. Find the **D1 Database Bindings** section
2. Click **Add binding**
3. Variable name: `DB`
4. D1 database: select `cs2-prices`
5. Save

### 4b. Set environment variables (non-secret)

In the **Environment Variables** section, add these one at a time. **Type: Plaintext** for all of them:

| Name | Value |
|---|---|
| `ALLOWED_ORIGIN` | `*` (lock down to your Netlify URL after step 5) |
| `STEAM_REQUEST_SPACING_MS` | `4000` |
| `OPENROUTER_MODEL` | `anthropic/claude-sonnet-4.5` |
| `OPENROUTER_EMBEDDING_MODEL` | `openai/text-embedding-3-small` |
| `OPENROUTER_APP_NAME` | `CS2 Case Terminal` |
| `OPENROUTER_APP_URL` | (leave empty for now; fill in after Netlify) |

### 4c. Set secrets (encrypted)

Same section, but for these click **Add secret** instead of variable. **Type: Secret**:

| Name | Value |
|---|---|
| `OPENROUTER_API_KEY` | Your key from https://openrouter.ai/keys |
| `ADMIN_TOKEN` | Any random string you make up. Use https://www.uuidgenerator.net or just type 30+ random characters. **Save it** — you'll need it for admin endpoints. |
| `STEAM_LOGIN_COOKIE` | (optional — only needed for historical backfill, see Step 7) |

**Important security note:** if you previously pasted any API key into a chat or screenshot, treat that key as compromised. Generate a fresh one at https://openrouter.ai/keys, delete the old one. Add credits at https://openrouter.ai/settings/credits — even $5 will cover months of dev usage.

### 4d. Password-protect the app (recommended)

By default, anyone who finds your worker URL can read prices and burn your OpenRouter credits via `/chat`. To keep randos out, set up the shared password gate.

1. **Open `deploy-bundle/tools/hash-password.html` in your browser.** Just double-click the file — it runs entirely in the browser, no server, no internet. Verify by checking the URL bar shows `file://...` or your dev server.
2. Type a password you'll share with your friend. Confirm it. Click **Generate**.
3. Copy the two values it produces:
   - `AUTH_PASSWORD_HASH` — a long string starting with `200000.`
   - `AUTH_SESSION_SECRET` — a 44-character base64 string
4. In Cloudflare Worker → Variables and Secrets, add **two more secrets** (Type: Secret):

| Name | Value |
|---|---|
| `AUTH_PASSWORD_HASH` | (paste the first value from the hasher) |
| `AUTH_SESSION_SECRET` | (paste the second value) |

5. Save the **plaintext password** in your password manager. **Save it** before closing the hasher tab — once it's gone you'd have to regenerate.
6. Share the password with your friend out-of-band (text it, write it down, don't post it anywhere).

If you skip this step, the gate is disabled and the app is public. You can add or remove the gate at any time by adding or deleting these two secrets — no redeploy needed.

### 4e. Configure the cron trigger

1. Settings → **Triggers** → **Cron Triggers** → **Add cron trigger**
2. Cron expression: `5 * * * *` (every hour at :05)
3. Save

### 4f. Verify

In a new browser tab, visit:
```
https://your-worker-url.workers.dev/health
```

You should see JSON like:
```json
{
  "ok": true,
  "cases_tracked": 0,
  "total_cases": 41,
  "last_snapshot_at": null,
  "last_cron": null
}
```

`cases_tracked: 0` is correct — no prices yet. `total_cases: 41` confirms the seed worked.

If you see a different error, check that the D1 binding is named exactly `DB` and the schema ran cleanly.

## Step 5 — Deploy the frontend to Netlify

1. Go to https://app.netlify.com
2. **Add new site** → **Deploy manually**
3. **Drag the `deploy-bundle/frontend/` folder** onto the upload area
4. Wait ~30 seconds for it to deploy
5. **Copy your Netlify URL** (e.g. `https://random-name-123456.netlify.app`)

## Step 6 — Tell the frontend where the worker is

This is the one tricky bit. The frontend was built without knowing your worker URL, so you need to tell it post-deploy.

1. In Netlify, click **Site configuration** → **Asset directory** (or use the **Edit file** option in deploys if available)
2. Find `config.js` and edit it
3. Replace the empty string with your worker URL:
   ```js
   window.__CS2_CONFIG__ = {
     workerUrl: "https://cs2-steam-proxy.<your-account>.workers.dev"
   };
   ```
4. Save

If Netlify's UI doesn't let you edit the file post-deploy on the free tier, an alternative: edit `config.js` locally in `deploy-bundle/frontend/`, then re-drag the folder onto Netlify.

Open the Netlify URL in a browser — you should see the terminal load. The first time, click **LIVE — STEAM MARKET**. Without any prices in the DB yet, you'll see "Worker has no price data yet" — that's expected, you'll fix it in Step 7.

## Step 7 — Load some price data

You have two options.

### Option A — Wait for the cron (free, easy)

The hourly cron will fire at the next `:05` past the hour and start populating data. After 24 hours you'll have 24 snapshots per case. After a week, the Movers panel will have meaningful data. After a month, you have a real dataset.

### Option B — Trigger a sweep manually + historical backfill (recommended)

Open a terminal (any terminal — your laptop, a phone SSH client, whatever can run `curl`):

```bash
# Replace these with your actual values:
WORKER=https://cs2-steam-proxy.<your-account>.workers.dev
TOKEN=<your-ADMIN_TOKEN-from-step-4c>

# Trigger a current-price sweep (returns immediately, runs in background ~3 min)
curl -X POST $WORKER/admin/snapshot-now -H "X-Admin-Token: $TOKEN"

# Wait 3 minutes, then verify:
curl $WORKER/health
# Should show cases_tracked ≥ 35
```

For the **historical backfill** (5–12 years of daily data per case, ~150K rows total):

1. You need a Steam login cookie. Log into https://steamcommunity.com in your browser
2. Open DevTools (F12) → **Application** tab → **Cookies** → `https://steamcommunity.com`
3. Find `steamLoginSecure`, copy its **Value** (long string)
4. Back in the Cloudflare Worker dashboard → Variables and Secrets → Add secret:
   - Name: `STEAM_LOGIN_COOKIE`
   - Value: (paste the cookie value)
5. Click **Save and deploy**
6. Trigger the backfill twice (processes 20 cases per call):
   ```bash
   curl -X POST $WORKER/admin/backfill -H "X-Admin-Token: $TOKEN"
   # Wait ~2 minutes, then again:
   curl -X POST $WORKER/admin/backfill -H "X-Admin-Token: $TOKEN"
   ```
7. Verify: `curl $WORKER/health` → should show `last_snapshot_at` from years ago and a much higher row count

After this, refresh the Netlify URL — you'll see real Movers, real charts, real history.

## Step 8 (optional) — Lock down CORS

Right now `ALLOWED_ORIGIN=*` means any website can call your worker. Once you've confirmed the Netlify URL works, tighten this:

1. Cloudflare Worker → Variables and Secrets
2. Edit `ALLOWED_ORIGIN`, change `*` to your Netlify URL (no trailing slash)
3. Also set `OPENROUTER_APP_URL` to the Netlify URL (gets you onto OpenRouter rankings)
4. **Save and deploy**

---

## Maintenance

**Steam cookie expires.** Roughly every 30 days. If `/admin/backfill` starts returning `auth_failed: true`, re-extract the cookie from your browser and update the `STEAM_LOGIN_COOKIE` secret. The hourly cron uses the public `priceoverview` endpoint and doesn't need the cookie.

**Watch the cron.** Cloudflare's worker logs are at Workers → your worker → **Logs**. Or query the cron history:

In the D1 console:
```sql
SELECT
  datetime(started_at, 'unixepoch') AS started,
  succeeded, failed, error,
  finished_at - started_at AS duration_seconds
FROM cron_runs
ORDER BY started_at DESC
LIMIT 10;
```

**Update the model.** Want to try GPT-5 or DeepSeek? Cloudflare Worker → Variables → edit `OPENROUTER_MODEL`. Save and deploy. No code change needed.

**Update the cron schedule.** Cloudflare Worker → Triggers → edit the cron expression.

**Update the worker code.** If you change the worker source and want to redeploy: rebuild with `npx wrangler deploy --dry-run --outdir=dist` from `worker/`, then paste the new `dist/index.js` over the dashboard editor's contents and click Save and deploy.

## When this approach falls short

The dashboard flow works for everything we need. The only things you can't do via dashboard:

- **Apply schema migrations** beyond the initial setup — you'd paste new SQL into the D1 console, which is fine but error-prone for complex changes.
- **Tail logs in real time** — the dashboard log viewer is fine for spot-checking but `wrangler tail` is nicer for active debugging.
- **Bulk-import lots of files** — for a single-file worker like this it doesn't matter.

If those become annoying later, the CLI is one `npm install -g wrangler` away and the project is fully wrangler-compatible.
