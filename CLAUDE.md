# CS2 Case Terminal — Claude project memory

> Always-loaded project context for Claude Code sessions. This file is the
> condensed bedrock Claude reads before any non-trivial task on this repo —
> published here as-is because it's the actual file used to build this
> project, not a cleaned-up retelling of it.

## What this project is

Bloomberg-style market intelligence terminal for CS2 cases. React 19 +
TypeScript + Vite + Tailwind 3 frontend, Cloudflare Worker + D1 SQLite data
layer. Hourly cron sweeps Steam Market. LLM-native investment thesis
generation via OpenRouter. See the README for the full architecture and
deploy paths.

Primary user is the project owner. His lived reaction during live browser
verification is the canonical UX signal — if it looks broken, it's broken,
regardless of what the test suite says.

## Design context

Key commitments from the design doctrine that governed this build:

- **Aesthetic spine:** Precision instruments don't have decoration, they
  have signal. Terminal-true, Bloomberg-discipline, Linear-density.
- **Reference take:** Bloomberg PCFY (numeric density), TradingView (single
  canvas), Linear (Cmd+K, 36px rows), Stripe (table-as-first-class), DUNE
  (`//` comment grammar).
- **Anti-references:** "safe terminal slop", gradient chart fills, four-color
  metric rainbow, rounded corners on data, decorative `//` comments.
- **5 commitments:** no `gap-4` instead of border, no gradient charts, no
  4th heading face/radius/shadow without a doctrine update, always show data
  source + staleness, chat lives in the document, never a modal.
- **12 design rules:** 4px atomic grid · 0px radii · 1px hairline borders ·
  no data shadows · semantic color only · 6-size type scale · two faces only
  (JetBrains Mono + Bebas Neue) · mono SVG icons · zero chart gradients ·
  12-col named grid · single `// SECTION` header pattern · state always
  visible.
- **Density target:** 7/10. Row 36px. Body 12px. Tabular 11px. System meta
  10px. Never below 10.

## How this project is actually worked on

- **TDD for anything non-trivial.** Failing test first, then the minimal
  fix, then verify against the full suite — not just the new test.
- **Atomic commits.** One task per commit, commit message states the *why*,
  not just the *what*. Bug fixes get root-cause diagnosis before a fix is
  proposed, not the other way around.
- **Verification is a hard requirement, not a suggestion.** No "should work"
  claims without evidence — typecheck output, test run output, or a live
  browser trace via chrome-devtools MCP, actually read before claiming a fix
  landed. A fix that "should" work and one that's verified are treated as
  two entirely different states.
- **Falsifiable diagnosis for ambiguous bugs.** Write the hypothesis list
  with predicted/observed/verdict per hypothesis *before* touching code,
  stop at first match. Several bugs in this codebase's history turned out to
  have a more precise root cause than the first, most-obvious guess —
  writing hypotheses down before fixing catches that.
- **Type-signature changes get audited everywhere they're consumed.**
  Changing a hook's return shape means checking every mock of that hook, not
  just the call sites that were the reason for the change.
- **A/B against unmodified code before claiming "fixed a regression."**
  When a test fails after a change, rerun it against the change stashed out
  before assuming causation — flaky tests exist, and blaming the wrong
  commit wastes more time than the extra rerun costs.
- **Persistent memory across sessions.** Decisions, debugging findings, and
  reusable patterns get written to a cross-project knowledge base as they're
  discovered, not batched up at the end of a session — so the next session
  (or the next project) doesn't re-derive something already known.
- **Never `--no-verify`, never `--amend` published commits, never
  force-push without asking first** — including by Claude. (The one time
  this repo's history *was* rewritten, it was to strip a leaked file out of
  an early snapshot, and it happened only after explicit sign-off — see the
  single root commit this repo currently has.)
- **Locale correctness matters as much as logic correctness.** Numbers
  render in the convention the target audience actually reads them in; a
  correct value formatted the wrong way is still a bug.

## What NOT to do

- Don't slim the bundle "for slim's sake" — quality over an arbitrary size
  cap, decided deliberately rather than by default.
- Don't add features during a refinement pass — refinement stays refinement.
- Don't translate emotionally-honest feedback ("looks broken as shit") into
  a mechanical finding without checking back that the translation is right.
- Don't add `// COMMENT` decoration that doesn't label a region.
- Don't add gradient fills, rounded data corners, or decorative shadows.
- Don't guess at root cause from naming conventions or memory — read the
  actual code path first, every time.
