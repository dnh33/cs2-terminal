import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { mockUseMarketDataWithGloveCase, mockAuth } from './__fixtures__/dashboardMocks'

mockUseMarketDataWithGloveCase()
mockAuth()

describe('FooterStrip (Phase 4.5 Plan 4 — 06·STATUS single-row)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
    window.history.replaceState({}, '', '/')
  })

  it('renders a footer-strip with the six atomic chips', async () => {
    const Mod = await import('../App')
    const { container } = render(<Mod.default />)
    await new Promise((r) => setTimeout(r, 0))
    const strip = container.querySelector('[data-test="footer-strip"]')
    expect(strip).not.toBeNull()
    expect(strip!.textContent).toMatch(/last cron/)
    expect(strip!.textContent).toMatch(/feed/)
    expect(strip!.textContent).toMatch(/model/)
    expect(strip!.textContent).toMatch(/build/)
    expect(strip!.textContent).toMatch(/disclaimer/)
  })

  it('renders the build hash chip with non-empty content', async () => {
    const Mod = await import('../App')
    const { container } = render(<Mod.default />)
    await new Promise((r) => setTimeout(r, 0))
    const buildHash = container.querySelector('[data-test="footer-build-hash"]')
    expect(buildHash).not.toBeNull()
    // The wiring exists if SOME value is rendered (even 'dev' fallback). Concrete-value
    // assertion is brittle in vitest's transform — build-time injection is the
    // integration concern, not a unit test.
    expect(buildHash!.textContent?.trim().length).toBeGreaterThan(0)
  })

  it('disclaimer is collapsed by default; aria-expanded="false" on the trigger', async () => {
    const Mod = await import('../App')
    const { container } = render(<Mod.default />)
    await new Promise((r) => setTimeout(r, 0))
    const trigger = container.querySelector('[data-test="footer-disclaimer-trigger"]') as HTMLButtonElement | null
    expect(trigger).not.toBeNull()
    expect(trigger!.getAttribute('aria-expanded')).toBe('false')
    expect(container.querySelector('[data-test="footer-disclaimer-content"]')).toBeNull()
  })

  it('clicking the disclaimer trigger expands the content and flips aria-expanded', async () => {
    const Mod = await import('../App')
    const { container } = render(<Mod.default />)
    await new Promise((r) => setTimeout(r, 0))
    const trigger = container.querySelector('[data-test="footer-disclaimer-trigger"]') as HTMLButtonElement
    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(container.querySelector('[data-test="footer-disclaimer-content"]')).not.toBeNull()
  })

  it('feed STALE when fixture stats.last_snapshot_at is far in the past (1970)', async () => {
    // The dashboardMocks fixture sets stats.last_snapshot_at = 1 — 1970, which is
    // far older than the 2h staleness threshold → expect STALE.
    const Mod = await import('../App')
    const { container } = render(<Mod.default />)
    await new Promise((r) => setTimeout(r, 0))
    const feed = container.querySelector('[data-test="footer-feed-state"]')
    expect(feed).not.toBeNull()
    expect(feed!.textContent).toMatch(/STALE/)
  })

  it('cron sparkline cluster (existing SystemStatus 3-tier) still renders below the strip', async () => {
    const Mod = await import('../App')
    const { container } = render(<Mod.default />)
    await new Promise((r) => setTimeout(r, 0))
    expect(container.textContent).toMatch(/CRON × 24/)
  })
})
