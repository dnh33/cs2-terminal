import { describe, it, expect } from 'vitest'
import { computeDivergence, type FitLike } from '../divergence'

const fit = (f: number, confidence: FitLike['confidence'] = 'high'): FitLike => ({ fit: f, confidence })

describe('computeDivergence', () => {
  describe('null handling', () => {
    it('returns null when verdict is null', () => {
      expect(computeDivergence(null, 0.9, fit(60))).toBeNull()
    })

    it('returns null when fit is null', () => {
      expect(computeDivergence('LONG', 0.9, null)).toBeNull()
    })

    it('returns null when both are null', () => {
      expect(computeDivergence(null, null, null)).toBeNull()
    })

    it('treats null verdictConfidence as 0 (lowest tier)', () => {
      // LONG with conf null → 55 (weak long tier).
      const r = computeDivergence('LONG', null, fit(55))!
      expect(r.verdictImplied).toBe(55)
      expect(r.divergence).toBe(0)
      expect(r.status).toBe('ok')
    })
  })

  describe('verdictImplied mapping', () => {
    it('FLAT anchors at 50 regardless of confidence', () => {
      expect(computeDivergence('FLAT', 0.0, fit(50))!.verdictImplied).toBe(50)
      expect(computeDivergence('FLAT', 0.5, fit(50))!.verdictImplied).toBe(50)
      expect(computeDivergence('FLAT', 1.0, fit(50))!.verdictImplied).toBe(50)
    })

    it('LONG tiers: <0.4 → 55, ≥0.4 → 65, ≥0.7 → 80', () => {
      expect(computeDivergence('LONG', 0.1, fit(50))!.verdictImplied).toBe(55)
      expect(computeDivergence('LONG', 0.4, fit(50))!.verdictImplied).toBe(65)
      expect(computeDivergence('LONG', 0.7, fit(50))!.verdictImplied).toBe(80)
      expect(computeDivergence('LONG', 0.95, fit(50))!.verdictImplied).toBe(80)
    })

    it('AVOID tiers: <0.4 → 45, ≥0.4 → 25, ≥0.7 → 10', () => {
      expect(computeDivergence('AVOID', 0.1, fit(50))!.verdictImplied).toBe(45)
      expect(computeDivergence('AVOID', 0.4, fit(50))!.verdictImplied).toBe(25)
      expect(computeDivergence('AVOID', 0.7, fit(50))!.verdictImplied).toBe(10)
      expect(computeDivergence('AVOID', 0.99, fit(50))!.verdictImplied).toBe(10)
    })

    it('clamps out-of-range confidence to [0,1]', () => {
      expect(computeDivergence('LONG', -1, fit(50))!.verdictImplied).toBe(55)
      expect(computeDivergence('LONG', 99, fit(50))!.verdictImplied).toBe(80)
    })
  })

  describe("status: 'ok' (divergence ≤ 30)", () => {
    it('returns ok when verdict and fit agree exactly', () => {
      const r = computeDivergence('FLAT', 0.5, fit(50))!
      expect(r.status).toBe('ok')
      expect(r.divergence).toBe(0)
    })

    it('returns ok at the boundary divergence === 30', () => {
      // LONG high-conf (implied 80) vs fit 50 → divergence 30 → ok (not override).
      const r = computeDivergence('LONG', 0.9, fit(50))!
      expect(r.divergence).toBe(30)
      expect(r.status).toBe('ok')
    })

    it("returns ok even at boundary when fit confidence is 'low'", () => {
      // Boundary 30 must not promote to block — block requires divergence > 50.
      const r = computeDivergence('LONG', 0.9, fit(50, 'low'))!
      expect(r.divergence).toBe(30)
      expect(r.status).toBe('ok')
    })
  })

  describe("status: 'override' (divergence > 30, not blocked)", () => {
    it('promotes to override when divergence is just over 30', () => {
      // LONG high-conf (80) vs fit 49 → 31.
      const r = computeDivergence('LONG', 0.9, fit(49))!
      expect(r.divergence).toBe(31)
      expect(r.status).toBe('override')
    })

    it('returns override at boundary divergence === 50', () => {
      // AVOID high-conf (10) vs fit 60 → divergence 50 → override (block needs >50).
      const r = computeDivergence('AVOID', 0.9, fit(60))!
      expect(r.divergence).toBe(50)
      expect(r.status).toBe('override')
    })

    it('returns override when divergence > 50 but fit confidence is high', () => {
      // AVOID high-conf (10) vs fit 80 high-conf → 70 divergence, but fit conf=high so no block.
      const r = computeDivergence('AVOID', 0.9, fit(80, 'high'))!
      expect(r.divergence).toBe(70)
      expect(r.status).toBe('override')
    })

    it('returns override when divergence > 50 but fit confidence is medium', () => {
      const r = computeDivergence('AVOID', 0.9, fit(80, 'medium'))!
      expect(r.divergence).toBe(70)
      expect(r.status).toBe('override')
    })
  })

  describe("status: 'block' (divergence > 50 AND fit.confidence === 'low')", () => {
    it('blocks when divergence is just over 50 and fit conf is low', () => {
      // LONG high-conf (80) vs fit 29 low-conf → 51 divergence → block.
      const r = computeDivergence('LONG', 0.9, fit(29, 'low'))!
      expect(r.divergence).toBe(51)
      expect(r.status).toBe('block')
    })

    it('does NOT block at exact boundary divergence === 50 even with low conf', () => {
      // AVOID high-conf (10) vs fit 60 low-conf → 50 → override (strict >).
      const r = computeDivergence('AVOID', 0.9, fit(60, 'low'))!
      expect(r.divergence).toBe(50)
      expect(r.status).toBe('override')
    })

    it('blocks aggressively-divergent low-conf cases', () => {
      // AVOID high-conf (10) vs fit 90 low-conf → 80 divergence → block.
      const r = computeDivergence('AVOID', 0.9, fit(90, 'low'))!
      expect(r.divergence).toBe(80)
      expect(r.status).toBe('block')
    })
  })

  describe('determinism / output shape', () => {
    it('is deterministic — identical inputs → identical outputs', () => {
      const a = computeDivergence('LONG', 0.8, fit(40, 'low'))
      const b = computeDivergence('LONG', 0.8, fit(40, 'low'))
      expect(a).toEqual(b)
    })

    it('emits a non-empty reason string for every status', () => {
      const ok = computeDivergence('FLAT', 0.5, fit(50))!
      const override = computeDivergence('LONG', 0.9, fit(40))!
      const block = computeDivergence('LONG', 0.9, fit(20, 'low'))!
      expect(ok.reason.length).toBeGreaterThan(0)
      expect(override.reason.length).toBeGreaterThan(0)
      expect(block.reason.length).toBeGreaterThan(0)
      expect(ok.status).toBe('ok')
      expect(override.status).toBe('override')
      expect(block.status).toBe('block')
    })

    it('divergence is always non-negative', () => {
      // AVOID strong (10) vs fit 95 → 85.
      const r = computeDivergence('AVOID', 0.9, fit(95))!
      expect(r.divergence).toBeGreaterThanOrEqual(0)
      // Symmetric: LONG strong (80) vs fit 5 → 75.
      const r2 = computeDivergence('LONG', 0.9, fit(5))!
      expect(r2.divergence).toBeGreaterThanOrEqual(0)
    })
  })
})
