import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CmdK, type CmdKItem } from '../CmdK'

const baseCatalyst: CmdKItem = {
  id: 'catalyst:1',
  section: 'catalyst',
  label: 'GLOVE CASE  IEM Katowice',
  meta: 'May 31',
}

describe('CmdK · CATALYSTS section', () => {
  it('renders a CATALYSTS section header when catalyst items present', () => {
    const onActivate = vi.fn()
    render(<CmdK open onClose={() => {}} items={[baseCatalyst]} onActivate={onActivate} />)
    expect(screen.getByText(/CATALYSTS/i)).toBeInTheDocument()
  })

  it('does NOT render CATALYSTS section when no catalyst items', () => {
    const onActivate = vi.fn()
    render(<CmdK open onClose={() => {}} items={[]} onActivate={onActivate} />)
    expect(screen.queryByText(/CATALYSTS/i)).not.toBeInTheDocument()
  })

  it('activating a catalyst item calls onActivate with the item', () => {
    const onActivate = vi.fn()
    render(<CmdK open onClose={() => {}} items={[baseCatalyst]} onActivate={onActivate} />)
    fireEvent.click(screen.getByText(/IEM Katowice/))
    expect(onActivate).toHaveBeenCalledWith(expect.objectContaining({ id: 'catalyst:1' }))
  })

  it('catalyst items appear in section ordering after hypotheses', () => {
    const items: CmdKItem[] = [
      { id: 'case:glove', section: 'cases', label: 'Glove' },
      baseCatalyst,
      { id: 'hyp:1', section: 'hypothesis', label: 'GLOVE ≥ $280 by 2026-06-15', meta: 'PENDING · 65%' },
      { id: 'panel:scan', section: 'panels', label: 'Scan' },
    ]
    const onActivate = vi.fn()
    render(<CmdK open onClose={() => {}} items={items} onActivate={onActivate} />)
    const labels = screen.getAllByRole('option').map(el => el.textContent)
    const catIdx = labels.findIndex(l => l?.includes('IEM Katowice'))
    const hypIdx = labels.findIndex(l => l?.includes('≥'))
    const panelIdx = labels.findIndex(l => l?.includes('Scan'))
    expect(catIdx).toBeGreaterThan(hypIdx)
    expect(hypIdx).toBeGreaterThan(panelIdx)
  })

  it('catalyst label is searchable case-insensitively', () => {
    const onActivate = vi.fn()
    render(<CmdK open onClose={() => {}} items={[baseCatalyst]} onActivate={onActivate} />)
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'iem' } })
    expect(screen.getByText(/IEM Katowice/)).toBeInTheDocument()
  })

  it('catalyst label is searchable by case name baked into label', () => {
    const onActivate = vi.fn()
    render(<CmdK open onClose={() => {}} items={[baseCatalyst]} onActivate={onActivate} />)
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'glove' } })
    expect(screen.getByText(/IEM Katowice/)).toBeInTheDocument()
  })

  it('section visible when query is empty', () => {
    const onActivate = vi.fn()
    render(<CmdK open onClose={() => {}} items={[baseCatalyst]} onActivate={onActivate} />)
    expect(screen.getByText(/CATALYSTS/i)).toBeInTheDocument()
    expect(screen.getByText(/IEM Katowice/)).toBeInTheDocument()
  })

  it('catalyst meta (eventDate short format) renders', () => {
    const onActivate = vi.fn()
    render(<CmdK open onClose={() => {}} items={[baseCatalyst]} onActivate={onActivate} />)
    expect(screen.getByText('May 31')).toBeInTheDocument()
  })
})
