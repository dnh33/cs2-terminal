import { describe, it, expect } from 'vitest'

// WCAG 2.x relative luminance per https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
function relativeLuminance(hex: string): number {
  const m = hex.replace('#', '').match(/.{2}/g)
  if (!m) throw new Error(`Bad hex: ${hex}`)
  const [r, g, b] = m.map((c) => parseInt(c, 16) / 255)
  const transform = (c: number): number =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  return 0.2126 * transform(r) + 0.7152 * transform(g) + 0.0722 * transform(b)
}

function contrastRatio(fg: string, bg: string): number {
  const L1 = relativeLuminance(fg)
  const L2 = relativeLuminance(bg)
  const [lighter, darker] = L1 > L2 ? [L1, L2] : [L2, L1]
  return (lighter + 0.05) / (darker + 0.05)
}

// Tokens scraped at plan-time from src/index.css. Tests will fail until lifted.
const palettes = {
  std: {
    'bg-0': '#070809',
    'bg-1': '#0c0f13',
    'ink-2': '#7e8a99',
    'ink-3': '#7a8597',
    'delta-up': '#34c271',
    'delta-dn': '#e05c5c',
  },
  amber: {
    'bg-0': '#080600',
    'bg-1': '#0e0c00',
    'ink-2': '#c49e3c',
    'ink-3': '#b89a4f',
    'delta-up': '#f5c842',
    'delta-dn': '#d05a3a',
  },
  green: {
    'bg-0': '#010a01',
    'bg-1': '#041004',
    'ink-2': '#40c640',
    'ink-3': '#26a826',
    'delta-up': '#39e239',
    'delta-dn': '#c25656',
  },
} as const

describe('palette contrast — WCAG AA at 10/11px', () => {
  for (const [name, p] of Object.entries(palettes)) {
    describe(`${name} palette`, () => {
      it('ink-3 on bg-0 ≥ 5.0 (AA + buffer)', () => {
        expect(contrastRatio(p['ink-3'], p['bg-0'])).toBeGreaterThanOrEqual(5.0)
      })
      it('ink-2 on bg-1 ≥ 4.5 (AA)', () => {
        expect(contrastRatio(p['ink-2'], p['bg-1'])).toBeGreaterThanOrEqual(4.5)
      })
      it('delta-up distinguishable from delta-dn (Δhue, not Δluminance)', () => {
        // Crude hue separation: if both tokens have nearly identical RGB ratios,
        // they read as same-hue and fail F16 colour-blind / semantic test.
        const up = p['delta-up'].replace('#', '')
        const dn = p['delta-dn'].replace('#', '')
        // Different first byte = different red channel = different hue family.
        expect(up.slice(0, 2)).not.toBe(dn.slice(0, 2))
      })
    })
  }
})
