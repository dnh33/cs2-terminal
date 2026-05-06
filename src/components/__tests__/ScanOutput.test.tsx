import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScanOutput } from '../ScanOutput'

const cases = [
  { id: 'glove-case', name: 'Glove Case' },
  { id: 'gallery-case', name: 'Gallery Case' },
  { id: 'kilowatt-case', name: 'Kilowatt Case' },
]

describe('ScanOutput', () => {
  it('replaces case names with chips', () => {
    render(<ScanOutput text="Buy Glove Case now." cases={cases} onSelect={() => {}} />)
    expect(screen.getByRole('button', { name: 'Glove Case' })).toBeInTheDocument()
  })

  it('preserves non-case text around chips', () => {
    const { container } = render(<ScanOutput text="Buy Glove Case now." cases={cases} onSelect={() => {}} />)
    expect(container.textContent).toContain('Buy ')
    expect(container.textContent).toContain(' now.')
  })

  it('replaces multiple instances of the same case', () => {
    render(<ScanOutput text="Glove Case is up. Glove Case again." cases={cases} onSelect={() => {}} />)
    expect(screen.getAllByRole('button', { name: 'Glove Case' })).toHaveLength(2)
  })

  it('matches longest first (Gallery Case before Glove)', () => {
    render(<ScanOutput text="Compare Gallery Case to Glove Case." cases={cases} onSelect={() => {}} />)
    expect(screen.getByRole('button', { name: 'Gallery Case' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Glove Case' })).toBeInTheDocument()
  })

  it('case-insensitive match (preserves display name)', () => {
    render(<ScanOutput text="GLOVE CASE rocks" cases={cases} onSelect={() => {}} />)
    expect(screen.getByRole('button', { name: 'Glove Case' })).toBeInTheDocument()
  })

  it('does not double-replace overlapping matches', () => {
    render(<ScanOutput text="Kilowatt Case Kilowatt Case" cases={cases} onSelect={() => {}} />)
    expect(screen.getAllByRole('button', { name: 'Kilowatt Case' })).toHaveLength(2)
  })
})
