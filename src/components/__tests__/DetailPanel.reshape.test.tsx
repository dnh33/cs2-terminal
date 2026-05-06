import { describe, it, expect, vi } from 'vitest'
import { render, within, fireEvent } from '@testing-library/react'
import { DetailPanel } from '../DetailPanel'
import type { ItemFull } from '../CaseTable'
import type { FitResult } from '../../lib/fitScore'

const item: ItemFull = {
  id: 'glove-case', name: 'Glove Case', released: '2016-11-28', pool: 'rare',
  rare: 'Gloves', hasGloves: true, notable: 'gloves',
  price: { lowest: 247.50, median: 250, volume: 12 },
  metrics: { ageDays: 3287, ageYears: 9, spread: 2.5, spreadPct: 1, breakeven: 290, liquidity: 60, scarcity: 80, poolMul: 1.2 },
  history: [],
}

const fitOk: FitResult = {
  case_id: 'glove-case', fit: 73, status: 'ok', confidence: 'high',
  components: {
    liquidity: { raw: 0, score: 62 },
    momentum: { raw: 0, score: 78 },
    supply_tightness: { raw: 0, score: 91 },
    content_quality: { raw: 0, score: 75 },
    unbox_ev_ratio: { raw: 0, score: 52 },
    crowding_risk: { raw: 0, score: 68 },
    catalyst: null,
  },
  weights: {}, weights_version: 'v1', algo_version: 'fit-1.0.0',
  inputs_hash: 'abc', as_of: 0, snapshot_at: 0, pool_size: 41,
}

// Per P2-T27, DetailPanel renders both a desktop inline wrapper and a mobile
// Drawer wrapper; jsdom mounts both simultaneously. Scope queries to the
// desktop wrapper so we assert on a single subtree.
function renderDesktop() {
  const { container } = render(
    <DetailPanel
      item={item} onAnalyze={() => {}} analysis={null} analyzing={false} error={null}
      fit={fitOk} peers={[]} onSelectPeer={() => {}}
    />,
  )
  const desktop = container.querySelector('[data-test="detail-desktop"]') as HTMLElement
  return { container, desktop }
}

describe('DetailPanel reshape', () => {
  it('renders FIT block when fit prop is provided', () => {
    const { desktop } = renderDesktop()
    expect(within(desktop).getByText('// FIT')).toBeInTheDocument()
  })

  it('renders PEERS section', () => {
    const { desktop } = renderDesktop()
    expect(within(desktop).getByText('// PEERS')).toBeInTheDocument()
  })

  it('renders ROI calc', () => {
    const { desktop } = renderDesktop()
    expect(within(desktop).getByText('// ROI CALC')).toBeInTheDocument()
  })

  it('does NOT render legacy SIGNALS metric bars', () => {
    const { desktop } = renderDesktop()
    expect(within(desktop).queryByText('// SIGNALS')).not.toBeInTheDocument()
    expect(within(desktop).queryByText(/POOL APPRECIATION BIAS/)).not.toBeInTheDocument()
  })

  it('vertical order: FIT before chart before PEERS — wait, FIT before PEERS before chart', () => {
    const { desktop } = renderDesktop()
    const text = desktop.textContent ?? ''
    const fitIdx = text.indexOf('// FIT')
    const peersIdx = text.indexOf('// PEERS')
    const chartIdx = text.indexOf('// PRICE TRAJECTORY')
    const roiIdx = text.indexOf('// ROI CALC')
    expect(fitIdx).toBeLessThan(peersIdx)
    expect(peersIdx).toBeLessThan(chartIdx)
    expect(chartIdx).toBeLessThan(roiIdx)
  })
})

describe('DetailPanel — Decision Log', () => {
  // Per P2-T27, DetailPanel renders both desktop + mobile (Drawer) wrappers in jsdom,
  // so unscoped queries find duplicates. Scope to the desktop subtree, mirroring
  // the renderDesktop() pattern above. (Deviation from plan T30 step 1's literal
  // test code, which assumed single-render — incompatible with T27.)
  function renderWithVerdict() {
    const { container } = render(
      <DetailPanel
        item={item} onAnalyze={() => {}} analysis={null} analyzing={false} error={null}
        fit={fitOk} peers={[]} onSelectPeer={() => {}}
        verdict="LONG" confidence={0.78}
      />,
    )
    const desktop = container.querySelector('[data-test="detail-desktop"]') as HTMLElement
    return { desktop }
  }

  it('renders DECISION LOG section', () => {
    const { desktop } = renderWithVerdict()
    expect(within(desktop).getByText('// DECISION LOG')).toBeInTheDocument()
  })

  it('Decision Log COMMIT button is enabled when verdict is provided', () => {
    const { desktop } = renderWithVerdict()
    expect(within(desktop).getByRole('button', { name: /commit/i })).toBeEnabled()
  })
})

describe('DetailPanel — from-scan pill (T36)', () => {
  it('renders "From this scan" pill when fromScan is true', () => {
    const { container } = render(
      <DetailPanel
        item={item} onAnalyze={() => {}} analysis={null} analyzing={false} error={null}
        fit={fitOk} peers={[]} onSelectPeer={() => {}}
        fromScan
      />,
    )
    const desktop = container.querySelector('[data-test="detail-desktop"]') as HTMLElement
    expect(within(desktop).getByText(/from this scan/i)).toBeInTheDocument()
  })

  it('does not render pill when fromScan is false/undefined', () => {
    const { container } = render(
      <DetailPanel
        item={item} onAnalyze={() => {}} analysis={null} analyzing={false} error={null}
        fit={fitOk} peers={[]} onSelectPeer={() => {}}
      />,
    )
    const desktop = container.querySelector('[data-test="detail-desktop"]') as HTMLElement
    expect(within(desktop).queryByText(/from this scan/i)).not.toBeInTheDocument()
  })
})

// P3-T38: Devil's Advocate button. Per T27, both desktop and mobile mounts
// render simultaneously in jsdom — scope to the desktop subtree to avoid
// duplicate-match errors (deviation from plan T38 step 1, mirrors T30's pattern).
describe('DetailPanel — Devil\'s Advocate', () => {
  it('renders the DEVIL\'S ADVOCATE button when analysis is present', () => {
    const { container } = render(
      <DetailPanel
        item={item} onAnalyze={() => {}} analysis="some prose" analyzing={false} error={null}
        fit={fitOk} peers={[]} onSelectPeer={() => {}}
        onDevilsAdvocate={() => {}}
      />,
    )
    const desktop = container.querySelector('[data-test="detail-desktop"]') as HTMLElement
    expect(within(desktop).getByRole('button', { name: /devil/i })).toBeInTheDocument()
  })

  it('calls onDevilsAdvocate when clicked', () => {
    const fn = vi.fn()
    const { container } = render(
      <DetailPanel
        item={item} onAnalyze={() => {}} analysis="prose" analyzing={false} error={null}
        fit={fitOk} peers={[]} onSelectPeer={() => {}}
        onDevilsAdvocate={fn}
      />,
    )
    const desktop = container.querySelector('[data-test="detail-desktop"]') as HTMLElement
    fireEvent.click(within(desktop).getByRole('button', { name: /devil/i }))
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('does NOT render Devil\'s Advocate button when analysis is empty/null', () => {
    const { container } = render(
      <DetailPanel
        item={item} onAnalyze={() => {}} analysis={null} analyzing={false} error={null}
        fit={fitOk} peers={[]} onSelectPeer={() => {}}
        onDevilsAdvocate={() => {}}
      />,
    )
    const desktop = container.querySelector('[data-test="detail-desktop"]') as HTMLElement
    expect(within(desktop).queryByRole('button', { name: /devil/i })).not.toBeInTheDocument()
  })
})

// P3-T40: VerdictBadge wired into DetailPanel near // LLM-NATIVE THESIS
// header. With T27 dual-mount (desktop + mobile Drawer), unscoped queries
// would hit duplicates — but `screen.getByText` would also fail on duplicates
// here. The plan's literal test code uses screen.getByText which works
// because the mobile Drawer is rendered via a portal-ish overlay that the
// jsdom render still mounts inline; dedup via desktop scoping for safety.
describe('DetailPanel — verdict badge wiring', () => {
  it('renders VerdictBadge when verdict prop is set', () => {
    const { container } = render(
      <DetailPanel
        item={item} onAnalyze={() => {}} analysis="x" analyzing={false} error={null}
        fit={fitOk} peers={[]} onSelectPeer={() => {}}
        verdict="LONG" confidence={0.78}
      />,
    )
    const desktop = container.querySelector('[data-test="detail-desktop"]') as HTMLElement
    expect(within(desktop).getByText(/LONG/)).toBeInTheDocument()
    expect(within(desktop).getByText(/78%/)).toBeInTheDocument()
  })

  it('VerdictBadge enables DecisionLog COMMIT button', () => {
    const { container } = render(
      <DetailPanel
        item={item} onAnalyze={() => {}} analysis="x" analyzing={false} error={null}
        fit={fitOk} peers={[]} onSelectPeer={() => {}}
        verdict="LONG" confidence={0.78}
      />,
    )
    const desktop = container.querySelector('[data-test="detail-desktop"]') as HTMLElement
    const commitBtn = within(desktop).getByRole('button', { name: /commit/i })
    expect(commitBtn).toBeEnabled()
  })
})
