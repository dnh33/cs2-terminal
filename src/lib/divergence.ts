// Verdict-FIT divergence policy (audit P2-#6).
//
// Pure utility — no React, no hooks, no clock reads, no side effects.
// Mirrors the contract guarantees of `fitScore.ts`: deterministic,
// idempotent, identical inputs → identical outputs.
//
// See project design docs for the full "Verdict-FIT divergence policy" spec.
//
// Locked rules (DO NOT silently change — these have UI contracts):
//   - divergence = |verdictImplied - fit.fit|
//   - divergence <= 30                            → 'ok'
//   - divergence >  30                            → 'override'  (DetailPanel "Model Override" chip)
//   - divergence >  50 AND fit.confidence='low'   → 'block'     (replace COMMIT button with "we don't know" badge)
//
// `null` is returned when either verdict or fit input is missing — callers
// render the neutral state in that case (no chip, no block). This keeps the
// streaming-analysis happy path clean: we may render a row before Claude's
// verdict has streamed in.

export type DivergenceStatus = 'ok' | 'override' | 'block'

export interface DivergenceResult {
  status: DivergenceStatus
  divergence: number          // |verdictImplied - fit| in 0..100 space
  verdictImplied: number      // 0..100 — the verdict translated to fit-space
  reason: string              // human-readable, suitable for tooltip / debug log
}

export interface FitLike {
  fit: number
  confidence: 'low' | 'medium' | 'high'
}

export type Verdict = 'LONG' | 'FLAT' | 'AVOID'

// ─── verdictImplied mapping ────────────────────────────────────────────────
//
// The spec defines `divergence = |verdict_implied_score - fit|` but does NOT
// define `verdict_implied_score` numerically — this util establishes it.
//
// Anchor reasoning:
//   - FIT 0-100 with thresholds: white ≥70 (high conviction long), accent-sel
//     50-69 (constructive), friction-yellow <50 (avoid). FLAT in verdict
//     terms is "no edge" — anchor at 50, the policy-neutral midpoint.
//   - LONG/AVOID are Claude's directional opinion; their distance from 50
//     should scale with verdictConfidence (0..1 from streamAnalysis).
//
// Mapping (matches the suggestion in the audit task — keep stable for tests):
//   LONG, conf >= 0.7  → 80   strong long
//   LONG, conf >= 0.4  → 65   moderate long
//   LONG, conf <  0.4  → 55   weak long
//   FLAT, any conf      → 50   neutral
//   AVOID, conf < 0.4  → 45   weak avoid
//   AVOID, conf >= 0.4  → 25   moderate avoid
//   AVOID, conf >= 0.7  → 10   strong avoid
//
// `verdictConfidence === null` is treated as 0 (lowest tier), matching how
// streamAnalysis surfaces "no confidence reported yet".
//
// Consequence for the policy:
//   A high-confidence LONG (80) against a FIT of 30 yields divergence 50 —
//   triggers 'override'. Push FIT to 25 (low-confidence FIT) and divergence
//   becomes 55 → 'block'. That matches the framework's intended behavior:
//   loud disagreement + low data trust = "we don't know".
function mapVerdictToImplied(verdict: Verdict, conf: number): number {
  const c = Number.isFinite(conf) ? Math.max(0, Math.min(1, conf)) : 0
  if (verdict === 'FLAT') return 50
  if (verdict === 'LONG') {
    if (c >= 0.7) return 80
    if (c >= 0.4) return 65
    return 55
  }
  // AVOID
  if (c >= 0.7) return 10
  if (c >= 0.4) return 25
  return 45
}

// ─── Public API ────────────────────────────────────────────────────────────

export function computeDivergence(
  verdict: Verdict | null,
  verdictConfidence: number | null,
  fit: FitLike | null,
): DivergenceResult | null {
  if (verdict === null || fit === null) return null

  const conf = verdictConfidence ?? 0
  const verdictImplied = mapVerdictToImplied(verdict, conf)
  const divergence = Math.abs(verdictImplied - fit.fit)

  // Order matters: 'block' is the strictest gate and must win over 'override'.
  // The boundary semantics are locked: 30 is OK (≤), 50 is override-only (≤),
  // strictly greater triggers each next tier.
  if (divergence > 50 && fit.confidence === 'low') {
    return {
      status: 'block',
      divergence,
      verdictImplied,
      reason:
        `Severe divergence (${divergence.toFixed(0)}) between ${verdict} verdict ` +
        `(implied ${verdictImplied}) and FIT ${fit.fit.toFixed(0)} on low-confidence data — ` +
        `block trade UI.`,
    }
  }
  if (divergence > 30) {
    return {
      status: 'override',
      divergence,
      verdictImplied,
      reason:
        `Model override: ${verdict} verdict (implied ${verdictImplied}) diverges ` +
        `${divergence.toFixed(0)} points from FIT ${fit.fit.toFixed(0)}.`,
    }
  }
  return {
    status: 'ok',
    divergence,
    verdictImplied,
    reason:
      `Verdict ${verdict} (implied ${verdictImplied}) within ${divergence.toFixed(0)} ` +
      `points of FIT ${fit.fit.toFixed(0)}.`,
  }
}
