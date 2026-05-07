import { fireEvent, render, screen } from '@testing-library/react'
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

describe('StatusSigil syncing arms rotation', () => {
  it('applies sigil-arms-syncing class only when status is syncing', () => {
    const { container, rerender } = render(<StatusSigil status="syncing" />)
    expect(container.querySelector('.sigil-arms-syncing')).not.toBeNull()
    rerender(<StatusSigil status="live" />)
    expect(container.querySelector('.sigil-arms-syncing')).toBeNull()
  })
})

describe('StatusSigil cron-tick pulse', () => {
  it('does NOT pulse on initial mount', () => {
    const { container } = render(<StatusSigil status="live" lastCronTick={1714989600} />)
    const dot = container.querySelector('[data-sigil-dot]')
    expect(dot?.getAttribute('data-pulse')).toBeNull()
  })

  it('triggers data-pulse on lastCronTick change', () => {
    const { container, rerender } = render(<StatusSigil status="live" lastCronTick={1714989600} />)
    rerender(<StatusSigil status="live" lastCronTick={1714993200} />)
    const dot = container.querySelector('[data-sigil-dot]')
    expect(dot?.getAttribute('data-pulse')).toBe('tick')
  })

  it('clears pulse on transition end', () => {
    const { container, rerender } = render(<StatusSigil status="live" lastCronTick={1714989600} />)
    rerender(<StatusSigil status="live" lastCronTick={1714993200} />)
    const dot = container.querySelector('[data-sigil-dot]') as HTMLElement
    fireEvent.transitionEnd(dot)
    expect(dot.getAttribute('data-pulse')).toBeNull()
  })
})
