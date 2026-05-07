import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CmdK, type CmdKItem } from '../CmdK'
import { filterByItemMap } from '../../lib/filterByItemMap'

const baseHypothesis: CmdKItem = {
  id: 'hyp:1',
  section: 'hypothesis',
  label: 'GLOVE ≥ $280 by 2026-06-15',
  meta: 'PENDING · 65%',
}

describe('CmdK · HYPOTHESES section', () => {
  it('renders a HYPOTHESES section header when hypothesis items present', () => {
    const onActivate = vi.fn()
    render(<CmdK open onClose={() => {}} items={[baseHypothesis]} onActivate={onActivate} />)
    expect(screen.getByText(/HYPOTHESES/i)).toBeInTheDocument()
  })

  it('does NOT render HYPOTHESES section when no hypothesis items', () => {
    const onActivate = vi.fn()
    render(<CmdK open onClose={() => {}} items={[]} onActivate={onActivate} />)
    expect(screen.queryByText(/HYPOTHESES/i)).not.toBeInTheDocument()
  })

  it('activating a hypothesis item calls onActivate with the item', () => {
    const onActivate = vi.fn()
    render(<CmdK open onClose={() => {}} items={[baseHypothesis]} onActivate={onActivate} />)
    fireEvent.click(screen.getByText(/GLOVE/))
    expect(onActivate).toHaveBeenCalledWith(expect.objectContaining({ id: 'hyp:1' }))
  })

  it('filters out orphan-caseId hypotheses (no matching item) via filterByItemMap', () => {
    // Plan 5 T5.4: hypothesisItems pre-filtered through filterByItemMap.
    // A hypothesis whose caseId is NOT in items[] is dropped before mapping to CmdKItem.
    const hypotheses = [
      { id: 'h1', caseId: 'glove-case', resolution: null, targetDate: '2026-06-15' },
      { id: 'h2', caseId: 'orphan-case', resolution: null, targetDate: '2026-07-01' },
    ]
    const items = [{ id: 'glove-case' }]
    const filtered = filterByItemMap(hypotheses, items)
    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe('h1')
  })

  it('filterByItemMap loading-state fallback returns hypotheses unchanged when items=[]', () => {
    const hypotheses = [
      { id: 'h1', caseId: 'glove-case', resolution: null, targetDate: '2026-06-15' },
    ]
    const filtered = filterByItemMap(hypotheses, [])
    expect(filtered).toHaveLength(1)
  })

  it('hypothesis items appear in section ordering after cases/panels/action/toggle', () => {
    const items: CmdKItem[] = [
      { id: 'case:glove', section: 'cases', label: 'Glove' },
      baseHypothesis,
      { id: 'panel:scan', section: 'panels', label: 'Scan' },
    ]
    const onActivate = vi.fn()
    render(<CmdK open onClose={() => {}} items={items} onActivate={onActivate} />)
    const labels = screen.getAllByRole('option').map(el => el.textContent)
    // hypothesis section appears after panels per SECTION_ORDER
    const hypIdx = labels.findIndex(l => l?.includes('GLOVE'))
    const panelIdx = labels.findIndex(l => l?.includes('Scan'))
    expect(hypIdx).toBeGreaterThan(panelIdx)
  })
})
