import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CaseChip } from '../CaseChip'

describe('CaseChip', () => {
  it('renders the case name', () => {
    render(<CaseChip caseId="glove-case" caseName="Glove Case" onSelect={() => {}} />)
    expect(screen.getByText('Glove Case')).toBeInTheDocument()
  })

  it('calls onSelect with caseId on click', () => {
    const onSelect = vi.fn()
    render(<CaseChip caseId="glove-case" caseName="Glove Case" onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onSelect).toHaveBeenCalledWith('glove-case')
  })

  it('activates on Enter and Space', () => {
    const onSelect = vi.fn()
    render(<CaseChip caseId="x" caseName="X" onSelect={onSelect} />)
    const btn = screen.getByRole('button')
    fireEvent.keyDown(btn, { key: 'Enter' })
    fireEvent.keyDown(btn, { key: ' ' })
    expect(onSelect).toHaveBeenCalledTimes(2)
  })
})
