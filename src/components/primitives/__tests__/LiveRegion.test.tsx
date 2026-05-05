import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { LiveRegion } from '../LiveRegion'

describe('LiveRegion', () => {
  it('renders politeness=polite by default with role=status', () => {
    render(<LiveRegion>FEED LIVE</LiveRegion>)
    const region = screen.getByRole('status')
    expect(region).toHaveAttribute('aria-live', 'polite')
    expect(region).toHaveTextContent('FEED LIVE')
  })

  it('honors politeness=assertive with role=alert', () => {
    render(<LiveRegion politeness="assertive">ERR</LiveRegion>)
    const region = screen.getByRole('alert')
    expect(region).toHaveAttribute('aria-live', 'assertive')
  })

  it('renders as a <div> when as="div"', () => {
    render(<LiveRegion as="div">x</LiveRegion>)
    expect(screen.getByRole('status').tagName).toBe('DIV')
  })
})
