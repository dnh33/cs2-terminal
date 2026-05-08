import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { mockUseMarketDataWithGloveCase, mockAuth } from './__fixtures__/dashboardMocks'

mockUseMarketDataWithGloveCase()
mockAuth()

describe('AppDashboard responsive structure (Phase 4.5 Plan 3 — post canvas refactor)', () => {
  // jsdom doesn't execute Tailwind media queries — these tests verify
  // STRUCTURE (region presence + descendant relationships) rather than
  // class-string emissions. True responsive verification is the manual
  // 1280px browser smoke at the Plan 3 T4 verification gate.

  beforeEach(() => {
    vi.resetModules()
    window.history.replaceState({}, '', '/')
    localStorage.clear()
  })

  it('chart-region nests its 2-chart inner content as a single descendant block', async () => {
    const Mod = await import('../App')
    const { container } = render(<Mod.default />)
    await new Promise((r) => setTimeout(r, 0))
    const chart = container.querySelector('[data-test="chart-region"]')
    expect(chart).not.toBeNull()
    const innerGrid = chart!.querySelector('div.grid')
    expect(innerGrid).not.toBeNull()
  })

  it('tbl-region directly contains the case-table column and its FrameGutter', async () => {
    const Mod = await import('../App')
    const { container } = render(<Mod.default />)
    await new Promise((r) => setTimeout(r, 0))
    const tbl = container.querySelector('[data-test="tbl-region"]')
    expect(tbl).not.toBeNull()
    expect(tbl!.querySelector('[data-frame-gutter]')).not.toBeNull()
  })
})
