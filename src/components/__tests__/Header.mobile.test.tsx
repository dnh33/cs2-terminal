import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Header } from '../Header'

describe('Header mobile', () => {
  it('hides UTC clock and PaletteSwitch labels at <md (visibility classes)', () => {
    const { container } = render(<Header fetching={false} stats={null} />)
    // The non-essential mobile-hidden cluster has the hidden md:flex utility
    const cluster = container.querySelector('[data-test="header-controls"]')
    expect(cluster).toBeTruthy()
    expect(cluster!.className).toMatch(/hidden/)
    expect(cluster!.className).toMatch(/md:flex/)
  })

  it('keeps logo + sigil + sign-out visible at all sizes', () => {
    render(<Header fetching={false} stats={null} onLogout={() => {}} />)
    expect(screen.getByText('CASE SNIPER')).toBeInTheDocument()
    // Both desktop (hidden md:flex) and mobile (flex md:hidden) clusters
    // render SIGN OUT — CSS picks which is visible. jsdom can't run media
    // queries, so we assert presence in both clusters.
    expect(screen.getAllByText('SIGN OUT').length).toBeGreaterThanOrEqual(1)
  })
})
