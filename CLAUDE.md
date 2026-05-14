# Case Sniper — Claude project memory

> Always-loaded project context for Claude Code sessions. The synthesis spec at `docs/superpowers/specs/2026-05-04-case-sniper-ux-overhaul-synthesis.md` is the canonical source of truth for design + IA decisions. This file is the condensed bedrock that Claude reads before any non-trivial task.

## What this project is

Bloomberg-style market intelligence terminal for CS2 cases. React 19 + TypeScript + Vite + Tailwind 3 frontend on Netlify, Cloudflare Worker + D1 SQLite data layer. Hourly cron sweeps Steam Market. LLM-native investment thesis generation via OpenRouter (currently `inclusionai/ring-2.6-1t:free`). Live worker at `https://your-worker.workers.dev`. Public site at `https://your-site.netlify.app`.

Primary user is the project owner (Daniel). His lived reaction during live browser verification is the canonical UX signal.

## Status

- Phase 4.5 "The Canvas Resolves" — SHIPPED 2026-05-08, tag `phase-4-5-complete` at `a9726c1` on main.
- Phase 4.6 "The Canvas Refines" — IN PROGRESS (this session forward). 14 P0–P3 findings captured in `06-projects/case-sniper-phase-4-5-visual-refinement.md`. Refinement before Phase 5 substrate.
- Phase 5 substrate — D1 retrofit (Decision Log + Hypothesis Ledger + Catalyst Journal), Δ24h actual computation, mobile route, FIT v2.

Baseline: 537/537 tests passing (one known intra-file cmdk flake, P5.5). Bundle 121.32 kB gzip. Worker 22/22.

## Design context (synthesis spec § 0–0.9)

The full design context lives in `.impeccable.md` at project root. Key commitments:

- **Aesthetic spine:** Precision instruments don't have decoration, they have signal. Terminal-true, Bloomberg-discipline, Linear-density.
- **Reference take:** Bloomberg PCFY (numeric density), TradingView (single canvas), Linear (Cmd+K, 36px rows), Stripe (table-as-first-class), DUNE (`//` comment grammar).
- **Anti-references:** "safe terminal slop", gradient chart fills, four-color metric rainbow, rounded corners on data, decorative `//` comments.
- **5 commitments:** no `gap-4` instead of border, no gradient charts, no 4th heading face/radius/shadow without doctrine update, always show data source + staleness, Chat lives in document never modal.
- **12 design rules:** 4px atomic grid · 0px radii · 1px hairline borders · no data shadows · semantic color only · 6-size type scale · two faces only (JetBrains Mono + Bebas Neue) · mono SVG icons · zero chart gradients · 12-col named grid · single `// SECTION` header pattern · state always visible.
- **Density target:** 7/10. Row 36px. Body 12px. Tabular 11px. System meta 10px. Never below 10.

## Conventions

- **Commits:** HEREDOC with single-quoted EOF, no defensive backslash escapes. Trailer: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`. Never `--no-verify` / `--amend` / force-push.
- **Branches:** Off LOCAL `main` for each refinement plan. Tag chain `phase-4-6-plan-N-<slug>` → `phase-4-6-complete`.
- **TDD:** Use `superpowers:test-driven-development` for non-trivial features/bugs. Atomic commits (one task per commit).
- **Verification:** Iron Law — orchestrator runs verification, reads output, THEN claims PASS. No "should work" claims without evidence.
- **Subagent councils:** High-risk decisions get 2–3 round councils + 3-lens audit. Mechanical bugs get single dispatch. Council depth IS feature.
- **Locale:** Numbers in Danish/European format (`1.651` = 1,651 units). Correct, not a bug.
- **Standing rules:** Declared-files contract per task. Type-signature changes audit ALL mock sites. Save discoveries to vault SAME TURN.

## Aetherkeep vault

Persistent knowledge lives in ``. Use `aetherkeep_context` / `aetherkeep_get` MCP tools (when available) or read directly from:

- `06-projects/case-sniper-phase-4-5-visual-refinement.md` — F1–F14 findings, severity-ranked
- `06-projects/case-sniper-phase-4-5-plan.md` — what shipped
- `07-patterns/code-patterns.md` § "Phase 4.5 Plan 3 Execution Patterns" — inline ternary patterns, sticky containing-block requirements, single-quoted heredoc rules
- `04-claude/working-memory.md` — current state, M1–M8 lessons
- `04-claude/decisions-log.md` — decision rationale

Save discoveries (patterns, decisions, diagnostics) to vault in the SAME TURN you make them. Not session end.

## Live verification setup

To drive Edge against the dev server for visual verification:

1. Worker live at `https://your-worker.workers.dev` (CORS locked to Netlify; for local dev either run `wrangler dev` from `worker/` OR temporarily widen `ALLOWED_ORIGIN="*"` and redeploy — revert before session end).
2. `npm run dev` from project root (Vite on `:5173`).
3. `public/config.js` `workerUrl` → deployed URL for dev, revert before commit.
4. Login password: `your-password-here`.
5. Edge with debug port: launch with `--remote-debugging-port=9222 --user-data-dir="..."` for chrome-devtools MCP.

## What NOT to do

- Don't slim bundle "for slim's sake" — Daniel's call: quality > arbitrary size cap.
- Don't try to deploy yourself. Daniel deploys. Claude verifies.
- Don't add features in Phase 4.6 — refinement only.
- Don't translate Daniel's emotional-honest feedback ("looks broken as shit") into mechanical findings without checking back.
- Don't use `--no-verify`, `--amend`, or force-push.
- Don't add `// COMMENT` decoration that doesn't label a region.
- Don't add gradient fills, rounded data corners, or decorative shadows.
