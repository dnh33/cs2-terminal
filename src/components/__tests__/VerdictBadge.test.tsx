import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VerdictBadge } from '../VerdictBadge'

describe('VerdictBadge', () => {
  it('renders Analyzing pill when loading and no verdict yet', () => {
    render(<VerdictBadge loading verdict={undefined} confidence={undefined} />)
    expect(screen.getByText(/analyzing/i)).toBeInTheDocument()
  })

  it('renders nothing when not loading and no verdict', () => {
    const { container } = render(<VerdictBadge loading={false} verdict={undefined} confidence={undefined} />)
    expect(container.textContent).toBe('')
  })

  it('renders LONG verdict with confidence', () => {
    render(<VerdictBadge loading={false} verdict="LONG" confidence={0.78} />)
    expect(screen.getByText(/LONG/)).toBeInTheDocument()
    expect(screen.getByText(/78%/)).toBeInTheDocument()
  })

  it('renders AVOID with err tone', () => {
    const { container } = render(<VerdictBadge loading={false} verdict="AVOID" confidence={0.62} />)
    expect(container.querySelector('[data-tone="err"]')).toBeInTheDocument()
  })

  it('renders FLAT with warn tone', () => {
    const { container } = render(<VerdictBadge loading={false} verdict="FLAT" confidence={0.5} />)
    expect(container.querySelector('[data-tone="warn"]')).toBeInTheDocument()
  })

  it('renders LONG with up tone', () => {
    const { container } = render(<VerdictBadge loading={false} verdict="LONG" confidence={0.9} />)
    expect(container.querySelector('[data-tone="up"]')).toBeInTheDocument()
  })
})
