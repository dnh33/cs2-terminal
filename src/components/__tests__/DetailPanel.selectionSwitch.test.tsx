import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { DetailPanel } from '../DetailPanel'
import type { ItemFull } from '../CaseTable'

const gloveCase: ItemFull = {
  id: 'glove-case', name: 'Glove Case', released: '2016-11-28', pool: 'rare',
  rare: 'Gloves', hasGloves: true, notable: 'gloves',
  price: { lowest: 247.50, median: 250, volume: 12 },
  metrics: { ageDays: 3287, ageYears: 9, spread: 2.5, spreadPct: 1, breakeven: 290, liquidity: 60, scarcity: 80, poolMul: 1.2 },
  history: [],
}

const fractureCase: ItemFull = {
  id: 'fracture-case', name: 'Fracture Case', released: '2020-08-06', pool: 'active',
  rare: 'Knife', hasGloves: false, notable: '',
  price: { lowest: 0.81, median: 0.81, volume: 22669 },
  metrics: { ageDays: 2190, ageYears: 6, spread: 0, spreadPct: 0, breakeven: 0.93, liquidity: 90, scarcity: 20, poolMul: 1 },
  history: [],
}

// This mirrors App.tsx's actual usage exactly: DetailPanel keyed on the
// selected case's id, since that's the mechanism under test (F: selection
// re-animates numbers).
function Harness({ item }: { item: ItemFull }) {
  return (
    <DetailPanel
      key={item.id}
      item={item} onAnalyze={() => {}} analysis={null} analyzing={false} error={null}
      fit={undefined} peers={[]} onSelectPeer={() => {}}
    />
  )
}

// Same as Harness but WITHOUT the key — this is what App.tsx looked like
// before the fix, and reproduces the reported bug directly.
function HarnessNoKey({ item }: { item: ItemFull }) {
  return (
    <DetailPanel
      item={item} onAnalyze={() => {}} analysis={null} analyzing={false} error={null}
      fit={undefined} peers={[]} onSelectPeer={() => {}}
    />
  )
}

describe('DetailPanel selection switch (reported: numbers re-animate on opening a different case)', () => {
  it('BUG REPRODUCTION — without a key, switching cases DOES trigger a flash (proves the mechanism)', () => {
    const { container, rerender } = render(<HarnessNoKey item={gloveCase} />)
    rerender(<HarnessNoKey item={fractureCase} />)
    // No key means React reuses the same DetailPanel instance across the
    // prop change, so every NumberFlip inside it sees a "previous value"
    // from the old case and animates as if a live price tick happened.
    const flashed = container.querySelectorAll('[data-flash]')
    expect(flashed.length).toBeGreaterThan(0)
  })

  it('does NOT leave a flash/flip animation active immediately after switching to a different case', () => {
    const { container, rerender } = render(<Harness item={gloveCase} />)
    rerender(<Harness item={fractureCase} />)
    // A real remount (forced by the key change) means NumberFlip's own
    // "first render, no previous value" branch runs — no data-flash should
    // ever be set on mount, regardless of how different the new value is
    // from the previous case's value.
    const flashed = container.querySelectorAll('[data-flash]')
    expect(flashed.length).toBe(0)
  })

  it('still shows the new case\'s values immediately (not stuck on the old case)', () => {
    const { container, rerender } = render(<Harness item={gloveCase} />)
    rerender(<Harness item={fractureCase} />)
    expect(container.textContent).toMatch(/0\.81/)
    expect(container.textContent).not.toMatch(/247\.50/)
  })
})
