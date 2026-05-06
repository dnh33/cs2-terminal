import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CmdK, type CmdKItem } from '../CmdK'

const cases: CmdKItem[] = [
  { id: 'glove-case', section: 'cases', label: 'Glove Case', tier: 'rare' },
  { id: 'kilowatt-case', section: 'cases', label: 'Kilowatt Case', tier: 'active' },
]
const actions: CmdKItem[] = [
  { id: 'run-scan', section: 'action', label: 'Run Market Scan' },
  { id: 'sign-out', section: 'action', label: 'Sign Out' },
]
const toggles: CmdKItem[] = [
  { id: 'palette', section: 'toggle', label: 'Cycle Palette Mode', meta: 'STD' },
]

describe('CmdK', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<CmdK open={false} onClose={() => {}} items={[...cases, ...actions, ...toggles]} onActivate={() => {}} />)
    expect(container.textContent).toBe('')
  })

  it('renders all items when open and input is empty', () => {
    render(<CmdK open onClose={() => {}} items={[...cases, ...actions, ...toggles]} onActivate={() => {}} />)
    expect(screen.getByText('Glove Case')).toBeInTheDocument()
    expect(screen.getByText('Run Market Scan')).toBeInTheDocument()
    expect(screen.getByText('Cycle Palette Mode')).toBeInTheDocument()
  })

  it('filters by typed query (fuzzy)', () => {
    render(<CmdK open onClose={() => {}} items={[...cases, ...actions]} onActivate={() => {}} />)
    const input = screen.getByPlaceholderText(/Aim/i) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'glov' } })
    expect(screen.getByText('Glove Case')).toBeInTheDocument()
    expect(screen.queryByText('Run Market Scan')).not.toBeInTheDocument()
  })

  it('Enter activates the selected option', () => {
    const onActivate = vi.fn()
    render(<CmdK open onClose={() => {}} items={[...cases]} onActivate={onActivate} />)
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onActivate).toHaveBeenCalledTimes(1)
    expect(onActivate).toHaveBeenCalledWith(cases[0])
  })

  it('arrow down moves selection', () => {
    render(<CmdK open onClose={() => {}} items={[...cases]} onActivate={() => {}} />)
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    const input = screen.getByPlaceholderText(/Aim/i) as HTMLInputElement
    expect(input.getAttribute('aria-activedescendant')).toContain('kilowatt-case')
  })

  it('Esc calls onClose', () => {
    const onClose = vi.fn()
    render(<CmdK open onClose={onClose} items={[...cases]} onActivate={() => {}} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders section headers CASES / ACTION / TOGGLE', () => {
    render(<CmdK open onClose={() => {}} items={[...cases, ...actions, ...toggles]} onActivate={() => {}} />)
    expect(screen.getByText('CASES')).toBeInTheDocument()
    expect(screen.getByText('ACTION')).toBeInTheDocument()
    expect(screen.getByText('TOGGLE')).toBeInTheDocument()
  })
})
