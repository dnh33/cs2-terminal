import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { mockUseMarketDataWithGloveCase, mockAuth } from './__fixtures__/dashboardMocks'

mockUseMarketDataWithGloveCase()
mockAuth()

describe('AppDashboard workspace canvas (Phase 4.5 Plan 3)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
    window.history.replaceState({}, '', '/')
  })

  it('renders a workspace-canvas wrapping the four region markers', async () => {
    const Mod = await import('../App')
    const { container } = render(<Mod.default />)
    await new Promise((r) => setTimeout(r, 0))
    const canvas = container.querySelector('[data-test="workspace-canvas"]')
    expect(canvas).not.toBeNull()
    expect(canvas!.querySelector('[data-test="mkt-region"]')).not.toBeNull()
    expect(canvas!.querySelector('[data-test="chart-region"]')).not.toBeNull()
    expect(canvas!.querySelector('[data-test="tbl-region"]')).not.toBeNull()
    expect(canvas!.querySelector('[data-test="insp-region"]')).not.toBeNull()
  })

  it('mkt-region contains both market-scan-panel and movers-panel inner markers (descendant invariant)', async () => {
    const Mod = await import('../App')
    const { container } = render(<Mod.default />)
    await new Promise((r) => setTimeout(r, 0))
    const mkt = container.querySelector('[data-test="mkt-region"]')
    expect(mkt).not.toBeNull()
    expect(mkt!.querySelector('[data-test="market-scan-panel"]')).not.toBeNull()
    expect(mkt!.querySelector('[data-test="movers-panel"]')).not.toBeNull()
  })

  it('insp-region renders insp-empty (NOT detail-panel) when no case is selected', async () => {
    const Mod = await import('../App')
    const { container } = render(<Mod.default />)
    await new Promise((r) => setTimeout(r, 0))
    const insp = container.querySelector('[data-test="insp-region"]')
    expect(insp).not.toBeNull()
    expect(insp!.querySelector('[data-test="insp-empty"]')).not.toBeNull()
    expect(insp!.querySelector('[data-test="detail-panel"]')).toBeNull()
  })

  it('chat-region is a sibling of workspace-canvas (NOT a descendant)', async () => {
    const Mod = await import('../App')
    const { container } = render(<Mod.default />)
    await new Promise((r) => setTimeout(r, 0))
    const canvas = container.querySelector('[data-test="workspace-canvas"]')
    const chat = container.querySelector('[data-test="chat-region"]')
    expect(canvas).not.toBeNull()
    expect(chat).not.toBeNull()
    expect(canvas!.contains(chat)).toBe(false)
  })

  // F6 (sticky INSP never pinned): workspace-canvas had no align-items
  // override, so the flexbox default (stretch) forced LEFT to match
  // INSP's height whenever INSP's own content was tall, leaving zero
  // scroll slack for `sticky` to ever visibly pin over. jsdom doesn't
  // compute real flex layout, so this asserts the class that fixes it
  // rather than measured heights — see
  // docs/superpowers/specs/notes/F6-sticky-diagnosis.md for the live
  // height measurements that diagnosed it.
  it('workspace-canvas overrides flex stretch so LEFT and INSP size independently (F6)', async () => {
    const Mod = await import('../App')
    const { container } = render(<Mod.default />)
    await new Promise((r) => setTimeout(r, 0))
    const canvas = container.querySelector('[data-test="workspace-canvas"]')
    expect(canvas).not.toBeNull()
    expect(canvas!.className).toMatch(/lg:items-start/)
  })
})
