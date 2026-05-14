// Re-export hub for chart-only consumers. The LWChart primitive lives at
// ../primitives/LWChart and is consumed widely (not just by charts). This
// module lifts chart-only helpers + provides one import point for the
// common LWC primitives so each chart file has a single shared dependency.

import type { LineWidth } from 'lightweight-charts'

export { LWChart, resolveToken } from '../primitives/LWChart'
export type { LWChartRef } from '../primitives/LWChart'

// Rule 9 (doctrine): chart lines are 1.5px. lightweight-charts types `lineWidth`
// as the integer union `1 | 2 | 3 | 4`, but canvas2D accepts floats at runtime
// and LWC threads the value straight to `ctx.lineWidth`. This typed escape lets
// us pass 1.5 (or any other doctrine-mandated stroke) without scattering casts.
export const HAIRLINE: LineWidth = 1.5 as unknown as LineWidth

// alpha-channel hex helper. Safer than string concatenation when the source
// token is non-hex (e.g. rgb()) — falls back to original. Used by PriceChart
// breakeven price line; lifted from old Charts.tsx withAlpha helper.
export function withAlpha(color: string, alpha: number): string {
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0')
  return /^#[0-9a-f]{6}$/i.test(color) ? `${color}${a}` : color
}
