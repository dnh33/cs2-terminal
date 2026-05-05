import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { StatusSigil } from '../StatusSigil'

describe('StatusSigil', () => {
  it('renders with aria-label reflecting status (live)', () => {
    render(<StatusSigil status="live" />)
    expect(screen.getByRole('img', { name: /feed: live/i })).toBeInTheDocument()
  })

  it('renders with aria-label reflecting status (syncing)', () => {
    render(<StatusSigil status="syncing" />)
    expect(screen.getByRole('img', { name: /feed: syncing/i })).toBeInTheDocument()
  })

  it('renders with aria-label reflecting status (stale)', () => {
    render(<StatusSigil status="stale" />)
    expect(screen.getByRole('img', { name: /feed: stale/i })).toBeInTheDocument()
  })

  it('renders with aria-label reflecting status (idle)', () => {
    render(<StatusSigil status="idle" />)
    expect(screen.getByRole('img', { name: /feed: idle/i })).toBeInTheDocument()
  })

  it('applies animate-pulse-sigil class only when status is live', () => {
    const { container, rerender } = render(<StatusSigil status="live" />)
    expect(container.querySelector('.animate-pulse-sigil')).not.toBeNull()

    rerender(<StatusSigil status="syncing" />)
    expect(container.querySelector('.animate-pulse-sigil')).toBeNull()

    rerender(<StatusSigil status="stale" />)
    expect(container.querySelector('.animate-pulse-sigil')).toBeNull()

    rerender(<StatusSigil status="idle" />)
    expect(container.querySelector('.animate-pulse-sigil')).toBeNull()

    rerender(<StatusSigil status="err" />)
    expect(container.querySelector('.animate-pulse-sigil')).toBeNull()
  })
})
