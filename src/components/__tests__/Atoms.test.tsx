import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MiniSparkline } from '../Atoms'

describe('MiniSparkline a11y', () => {
  it('exposes aria-label with direction (real, up)', () => {
    render(<MiniSparkline data={[10, 11, 12, 13]} windowLabel="90-day" />)
    const img = screen.getByRole('img')
    expect(img.getAttribute('aria-label')).toMatch(/real/i)
    expect(img.getAttribute('aria-label')).toMatch(/up/i)
    expect(img.getAttribute('aria-label')).toMatch(/30/) // ~30% trend
    // Up glyph rendered (visually hidden from a11y tree but present in DOM)
    expect(img.textContent).toMatch(/▲/)
  })

  it('exposes aria-label with direction (real, down)', () => {
    render(<MiniSparkline data={[20, 18, 15, 10]} />)
    const img = screen.getByRole('img')
    expect(img.getAttribute('aria-label')).toMatch(/down/i)
    expect(img.textContent).toMatch(/▼/)
  })

  it('renders MODEL badge and dashed stroke when modeled', () => {
    const { container } = render(<MiniSparkline data={[10, 11, 12]} modeled />)
    const img = screen.getByRole('img')
    expect(img.getAttribute('aria-label')).toMatch(/modeled/i)
    expect(img.textContent).toMatch(/MODEL/)
    const polyline = container.querySelector('polyline')
    expect(polyline?.getAttribute('stroke-dasharray')).toBe('4 2')
  })

  it('does not render MODEL badge or dashed stroke when real', () => {
    const { container } = render(<MiniSparkline data={[10, 11, 12]} />)
    expect(screen.queryByText('MODEL')).toBeNull()
    const polyline = container.querySelector('polyline')
    expect(polyline?.getAttribute('stroke-dasharray')).toBeFalsy()
  })
})
